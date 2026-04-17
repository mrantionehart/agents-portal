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

    const body = await request.json()
    const {
      type,
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
      notes,
    } = body

    // Validate required fields
    if (!type) return NextResponse.json({ error: 'Transaction type is required' }, { status: 400 })
    if (!property_address?.trim()) return NextResponse.json({ error: 'Property address is required' }, { status: 400 })

    const validTypes = ['buyer', 'seller', 'lease', 'referral', 'wholesale', 'double_close']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
    }

    // Insert transaction
    const { data: transaction, error } = await admin
      .from('transactions')
      .insert({
        agent_id: user.id,
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

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (err) {
    console.error('Create transaction error:', err)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}

function getDocRequirements(type: string) {
  const common = [
    { label: 'Brokerage Relationship Disclosure', folder: 'disclosures', required: true, signatureRequired: true },
    { label: 'Wire Fraud Notice', folder: 'disclosures', required: true, signatureRequired: true },
    { label: 'Compliance Acknowledgment', folder: 'compliance', required: true, signatureRequired: true },
  ]

  const typeSpecific: Record<string, any[]> = {
    seller: [
      { label: 'Listing Agreement', folder: 'contracts', required: true, signatureRequired: true },
      { label: 'Seller Disclosure', folder: 'disclosures', required: true, signatureRequired: true },
      { label: 'Purchase Agreement', folder: 'contracts', required: false, signatureRequired: true },
      { label: 'Lead Paint/No Lead Paint Disclosure', folder: 'disclosures', required: true, signatureRequired: true },
      { label: 'Permission to Advertise', folder: 'marketing', required: false, signatureRequired: true },
      { label: 'Marketing Authorization', folder: 'marketing', required: false, signatureRequired: true },
      { label: 'Closing Disclosure', folder: 'closing', required: false, signatureRequired: true },
    ],
    buyer: [
      { label: 'Buyer Representation Agreement', folder: 'contracts', required: true, signatureRequired: true },
      { label: 'Purchase Agreement', folder: 'contracts', required: false, signatureRequired: true },
      { label: 'Pre-Approval Letter', folder: 'financing', required: true, signatureRequired: false },
      { label: 'Lead Paint/No Lead Paint Disclosure', folder: 'disclosures', required: true, signatureRequired: true },
      { label: 'Home Inspection Report', folder: 'inspections', required: false, signatureRequired: false },
      { label: 'Closing Disclosure', folder: 'closing', required: false, signatureRequired: true },
    ],
    lease: [
      { label: 'Lease Agreement', folder: 'contracts', required: true, signatureRequired: true },
      { label: 'Lead Paint/No Lead Paint Disclosure', folder: 'disclosures', required: true, signatureRequired: true },
      { label: 'Tenant Application', folder: 'applications', required: false, signatureRequired: false },
    ],
    referral: [
      { label: 'Referral Agreement', folder: 'contracts', required: true, signatureRequired: true },
      { label: 'Commission Agreement', folder: 'commissions', required: true, signatureRequired: true },
      { label: 'Cooperating Broker Compensation Agreement', folder: 'commissions', required: false, signatureRequired: true },
    ],
    wholesale: [
      { label: 'Purchase Agreement', folder: 'contracts', required: true, signatureRequired: true },
      { label: 'Assignment Agreement', folder: 'contracts', required: true, signatureRequired: true },
      { label: 'Proof of Funds', folder: 'financing', required: true, signatureRequired: false },
    ],
    double_close: [
      { label: 'Purchase Agreement', folder: 'contracts', required: true, signatureRequired: true },
      { label: 'Assignment Agreement', folder: 'contracts', required: true, signatureRequired: true },
      { label: 'Proof of Funds', folder: 'financing', required: true, signatureRequired: false },
      { label: 'Closing Disclosure', folder: 'closing', required: false, signatureRequired: true },
    ],
  }

  return [...common, ...(typeSpecific[type] || [])]
}
