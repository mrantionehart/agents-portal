import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getAuthedUser(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) return null
      return data.user
    } catch { return null }
  }
  try {
    const stubResponse = NextResponse.json({})
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { stubResponse.cookies.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { stubResponse.cookies.delete(name) },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch { return null }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'agent'

    const body = await request.json()
    const {
      type,
      agent_id: assignedAgentId,
      property_address,
      city,
      state,
      zip,
      client_name,
      client_email,
      client_phone,
      other_party_name,
      other_party_agent,
      other_party_brokerage,
      contract_price,
      earnest_money,
      closing_date,
      contract_date,
      lease_term_months,
      assignment_fee,
      referral_fee_pct,
      referral_party,
      commission_rate_pct,
      agent_split_pct,
      notes,
    } = body

    // Validate required fields
    if (!type) return NextResponse.json({ error: 'Transaction type is required' }, { status: 400 })
    if (!property_address?.trim()) return NextResponse.json({ error: 'Property address is required' }, { status: 400 })

    const validTypes = ['buyer', 'seller', 'lease', 'referral', 'wholesale', 'double_close']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
    }

    // Determine agent_id: broker/admin can assign to any agent
    let targetAgentId = user.id
    if (['broker', 'admin'].includes(userRole) && assignedAgentId) {
      // Verify the agent exists
      const { data: agentProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('id', assignedAgentId)
        .eq('is_active', true)
        .single()

      if (agentProfile) {
        targetAgentId = assignedAgentId
      }
    }

    // Insert transaction
    const { data: transaction, error } = await admin
      .from('transactions')
      .insert({
        agent_id: targetAgentId,
        type,
        status: 'draft',
        property_address: property_address.trim(),
        city: city?.trim() || '',
        state: state?.trim() || '',
        zip: zip?.trim() || '',
        client_name: client_name?.trim() || '',
        client_email: client_email?.trim() || null,
        client_phone: client_phone?.trim() || null,
        other_party_name: other_party_name?.trim() || null,
        other_party_agent: other_party_agent?.trim() || null,
        other_party_brokerage: other_party_brokerage?.trim() || null,
        contract_price: contract_price ? parseFloat(contract_price) : null,
        earnest_money: earnest_money ? parseFloat(earnest_money) : null,
        closing_date: closing_date || null,
        contract_date: contract_date || null,
        lease_term_months: lease_term_months ? parseInt(lease_term_months) : null,
        assignment_fee: assignment_fee ? parseFloat(assignment_fee) : null,
        referral_fee_pct: referral_fee_pct ? parseFloat(referral_fee_pct) : null,
        referral_party: referral_party?.trim() || null,
        notes: notes?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Transaction create error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Auto-generate doc requirements based on type
    const docRequirements = getDocRequirements(type)
    if (docRequirements.length > 0) {
      await admin
        .from('transaction_doc_requirements')
        .insert(
          docRequirements.map((doc, idx) => ({
            transaction_id: transaction.id,
            doc_label: doc.label,
            folder: doc.folder,
            required: doc.required,
            signature_required: doc.signatureRequired,
            sort_order: idx,
          }))
        )
    }

    // Auto-create commission record if contract price is provided
    const price = contract_price ? parseFloat(contract_price) : 0
    if (price > 0) {
      const commRate = commission_rate_pct ? parseFloat(commission_rate_pct) : 3.0
      const agentSplit = agent_split_pct ? parseFloat(agent_split_pct) : 70.0
      const grossComm = price * (commRate / 100)
      const agentAmt = grossComm * (agentSplit / 100)
      const brokerageAmt = grossComm - agentAmt
      const referralAmt = referral_fee_pct ? grossComm * (parseFloat(referral_fee_pct) / 100) : 0

      await admin
        .from('commissions')
        .insert({
          transaction_id: transaction.id,
          agent_id: targetAgentId,
          gross_commission: Math.round(grossComm * 100) / 100,
          commission_rate_pct: commRate,
          agent_split_pct: agentSplit,
          agent_amount: Math.round(agentAmt * 100) / 100,
          brokerage_amount: Math.round(brokerageAmt * 100) / 100,
          referral_fee_amount: referralAmt > 0 ? Math.round(referralAmt * 100) / 100 : null,
        })
    }

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (err) {
    console.error('Create transaction error:', err)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}

function getDocRequirements(type: string) {
  // ── Florida-specific compliance document requirements ──────────
  // Phases: listing_intake → under_contract → pre_closing → closing → compliance
  // Based on Florida real estate statutes and HartFelt brokerage standards

  // Common disclosures required for ALL Florida transaction types
  const common = [
    { label: 'Brokerage Relationship Disclosure', folder: 'listing_intake', required: true, signatureRequired: true },
    { label: 'Wire Fraud Notice', folder: 'listing_intake', required: true, signatureRequired: true },
    { label: 'Compliance Acknowledgment', folder: 'compliance', required: true, signatureRequired: true },
  ]

  const typeSpecific: Record<string, any[]> = {
    seller: [
      // ── Listing Intake (Listing-Side) ──
      { label: 'Listing Agreement', folder: 'listing_intake', required: true, signatureRequired: true },
      { label: 'Seller Disclosure', folder: 'listing_intake', required: true, signatureRequired: true },
      { label: 'Lead Paint Disclosure (Pre-1978)', folder: 'listing_intake', required: true, signatureRequired: true },
      { label: 'Permission to Advertise', folder: 'listing_intake', required: false, signatureRequired: true },
      { label: 'Marketing Authorization', folder: 'listing_intake', required: false, signatureRequired: true },
      { label: 'HOA/Condo Association Disclosure', folder: 'listing_intake', required: false, signatureRequired: false },
      // ── Under Contract ──
      { label: 'Purchase Agreement (As-Is or FAR/BAR)', folder: 'under_contract', required: true, signatureRequired: true },
      { label: 'Buyer Pre-Approval / Proof of Funds', folder: 'under_contract', required: true, signatureRequired: false },
      { label: 'Proof of Earnest Money Delivered', folder: 'under_contract', required: true, signatureRequired: false },
      { label: 'Amendments / Addenda', folder: 'under_contract', required: false, signatureRequired: true },
      // ── Pre-Closing ──
      { label: 'Home Inspection Report', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Appraisal Report', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Title Commitment / Search', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Survey', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Clear to Close', folder: 'pre_closing', required: false, signatureRequired: false },
      // ── Closing ──
      { label: 'ALTA Settlement Statement / HUD-1', folder: 'closing', required: true, signatureRequired: true },
      { label: 'Commission Disbursement Authorization (CDA)', folder: 'closing', required: true, signatureRequired: true },
      { label: 'Closing Disclosure', folder: 'closing', required: true, signatureRequired: true },
    ],
    buyer: [
      // ── Listing Intake (Buyer-Side) ──
      { label: 'Buyer Representation Agreement', folder: 'listing_intake', required: true, signatureRequired: true },
      { label: 'Pre-Approval Letter / Proof of Funds', folder: 'listing_intake', required: true, signatureRequired: false },
      // ── Under Contract ──
      { label: 'Purchase Agreement (As-Is or FAR/BAR)', folder: 'under_contract', required: true, signatureRequired: true },
      { label: 'Lead Paint Disclosure (Pre-1978)', folder: 'under_contract', required: true, signatureRequired: true },
      { label: 'Seller Disclosure (received)', folder: 'under_contract', required: true, signatureRequired: false },
      { label: 'HOA/Condo Association Disclosure', folder: 'under_contract', required: false, signatureRequired: false },
      { label: 'Proof of Earnest Money Delivered', folder: 'under_contract', required: true, signatureRequired: false },
      { label: 'Amendments / Addenda', folder: 'under_contract', required: false, signatureRequired: true },
      // ── Pre-Closing ──
      { label: 'Home Inspection Report', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Appraisal Report', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Title Commitment / Search', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Survey', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Homeowners Insurance Binder', folder: 'pre_closing', required: false, signatureRequired: false },
      { label: 'Clear to Close', folder: 'pre_closing', required: false, signatureRequired: false },
      // ── Closing ──
      { label: 'ALTA Settlement Statement / HUD-1', folder: 'closing', required: true, signatureRequired: true },
      { label: 'Commission Disbursement Authorization (CDA)', folder: 'closing', required: true, signatureRequired: true },
      { label: 'Closing Disclosure', folder: 'closing', required: true, signatureRequired: true },
    ],
    lease: [
      // ── Listing Intake ──
      { label: 'Lease Agreement', folder: 'listing_intake', required: true, signatureRequired: true },
      { label: 'Lead Paint Disclosure (Pre-1978)', folder: 'listing_intake', required: true, signatureRequired: true },
      { label: 'Tenant Application', folder: 'listing_intake', required: false, signatureRequired: false },
      // ── Compliance ──
      { label: 'Security Deposit Receipt', folder: 'compliance', required: false, signatureRequired: false },
    ],
    referral: [
      // ── Listing Intake ──
      { label: 'Referral Agreement', folder: 'listing_intake', required: true, signatureRequired: true },
      { label: 'Commission Agreement', folder: 'listing_intake', required: true, signatureRequired: true },
      { label: 'Cooperating Broker Compensation Agreement', folder: 'listing_intake', required: false, signatureRequired: true },
      // ── Closing ──
      { label: 'Commission Disbursement Authorization (CDA)', folder: 'closing', required: true, signatureRequired: true },
    ],
    wholesale: [
      // ── Under Contract ──
      { label: 'Purchase Agreement', folder: 'under_contract', required: true, signatureRequired: true },
      { label: 'Assignment Agreement', folder: 'under_contract', required: true, signatureRequired: true },
      { label: 'Proof of Funds', folder: 'under_contract', required: true, signatureRequired: false },
      { label: 'Proof of Earnest Money Delivered', folder: 'under_contract', required: true, signatureRequired: false },
      // ── Closing ──
      { label: 'ALTA Settlement Statement / HUD-1', folder: 'closing', required: true, signatureRequired: true },
      { label: 'Commission Disbursement Authorization (CDA)', folder: 'closing', required: true, signatureRequired: true },
    ],
    double_close: [
      // ── Under Contract ──
      { label: 'Purchase Agreement (A-B)', folder: 'under_contract', required: true, signatureRequired: true },
      { label: 'Purchase Agreement (B-C)', folder: 'under_contract', required: true, signatureRequired: true },
      { label: 'Proof of Funds', folder: 'under_contract', required: true, signatureRequired: false },
      { label: 'Proof of Earnest Money Delivered', folder: 'under_contract', required: true, signatureRequired: false },
      // ── Closing ──
      { label: 'ALTA Settlement Statement / HUD-1 (A-B)', folder: 'closing', required: true, signatureRequired: true },
      { label: 'ALTA Settlement Statement / HUD-1 (B-C)', folder: 'closing', required: true, signatureRequired: true },
      { label: 'Commission Disbursement Authorization (CDA)', folder: 'closing', required: true, signatureRequired: true },
      { label: 'Closing Disclosure', folder: 'closing', required: true, signatureRequired: true },
    ],
  }

  return [...common, ...(typeSpecific[type] || [])]
}
