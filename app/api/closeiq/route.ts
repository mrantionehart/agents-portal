// ---------------------------------------------------------------------------
// CloseIQ API — /api/closeiq
// CRUD for buyers, offers, risk flags, approvals, and offer mode presets
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ---------------------------------------------------------------------------
// Auth helper (supports Bearer token from EASE + SSR cookie from portal)
// ---------------------------------------------------------------------------
async function getAuthedUser(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
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

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ---------------------------------------------------------------------------
// Readiness score calculator
// ---------------------------------------------------------------------------
function calcReadinessScore(buyer: any): number {
  let score = 0
  if (buyer.preapproval_status === 'approved') score += 20
  if (buyer.proof_of_funds_uploaded) score += 20
  if (buyer.id_verified) score += 10
  if (buyer.earnest_money_ready) score += 15
  const cp = buyer.contingency_preferences || {}
  if (cp.inspection !== undefined && cp.appraisal !== undefined && cp.financing !== undefined) score += 10
  if (buyer.target_close_window) score += 10
  if (buyer.preapproval_amount) score += 10
  if (buyer.notes && buyer.notes.length > 10) score += 5
  return Math.min(100, score)
}

function readinessLabel(score: number): string {
  if (score >= 90) return 'Strong'
  if (score >= 75) return 'Ready'
  if (score >= 60) return 'Weak'
  return 'Not Ready'
}

// ---------------------------------------------------------------------------
// Risk scanner (rules-based MVP)
// ---------------------------------------------------------------------------
interface RiskFlag { flag_type: string; severity: string; title: string; description: string; recommended_action: string }

function scanOfferRisks(offer: any, buyer: any): RiskFlag[] {
  const flags: RiskFlag[] = []

  // Appraisal gap risk
  if (offer.property_list_price && offer.offer_price > offer.property_list_price * 1.05) {
    flags.push({
      flag_type: 'appraisal_gap', severity: 'high',
      title: 'Appraisal Gap Risk',
      description: `Offer price ($${offer.offer_price?.toLocaleString()}) is ${Math.round(((offer.offer_price / offer.property_list_price) - 1) * 100)}% above list price.`,
      recommended_action: 'Consider appraisal gap coverage or reduce offer price.',
    })
  }

  // No inspection
  if (offer.inspection_days === 0 || offer.inspection_days === null) {
    flags.push({
      flag_type: 'no_inspection', severity: 'moderate',
      title: 'No Inspection Period',
      description: 'Offer waives the inspection contingency.',
      recommended_action: 'Confirm buyer understands they accept the property as-is.',
    })
  }

  // Missing buyer docs
  if (buyer && buyer.preapproval_status !== 'approved') {
    flags.push({
      flag_type: 'missing_preapproval', severity: 'high',
      title: 'Missing Pre-Approval',
      description: 'Buyer does not have a current pre-approval letter.',
      recommended_action: 'Obtain pre-approval before submitting offer.',
    })
  }

  if (buyer && !buyer.proof_of_funds_uploaded && offer.financing_type === 'cash') {
    flags.push({
      flag_type: 'missing_pof', severity: 'high',
      title: 'Missing Proof of Funds',
      description: 'Cash offer but no proof of funds uploaded.',
      recommended_action: 'Upload proof of funds document.',
    })
  }

  if (buyer && !buyer.earnest_money_ready) {
    flags.push({
      flag_type: 'earnest_money', severity: 'moderate',
      title: 'Earnest Money Not Confirmed',
      description: 'Buyer has not confirmed earnest money availability.',
      recommended_action: 'Verify earnest money is ready for deposit.',
    })
  }

  // Waiving both appraisal + financing contingency with non-cash
  if (!offer.appraisal_contingency && !offer.financing_contingency && offer.financing_type !== 'cash') {
    flags.push({
      flag_type: 'contingency_risk', severity: 'high',
      title: 'All Contingencies Waived (Non-Cash)',
      description: 'Both appraisal and financing contingencies waived on a financed offer.',
      recommended_action: 'High risk — buyer could lose earnest money if financing falls through.',
    })
  }

  // High concessions
  if (offer.concessions_requested && offer.offer_price && offer.concessions_requested / offer.offer_price > 0.03) {
    flags.push({
      flag_type: 'high_concessions', severity: 'low',
      title: 'High Concessions Requested',
      description: `Concessions (${((offer.concessions_requested / offer.offer_price) * 100).toFixed(1)}%) may weaken offer.`,
      recommended_action: 'Consider reducing concessions in competitive market.',
    })
  }

  // Tight close date
  if (offer.close_date) {
    const daysToClose = Math.ceil((new Date(offer.close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysToClose < 14 && offer.financing_type !== 'cash') {
      flags.push({
        flag_type: 'tight_close', severity: 'moderate',
        title: 'Tight Closing Timeline',
        description: `Only ${daysToClose} days to close with financing — lender may not clear in time.`,
        recommended_action: 'Verify with lender that timeline is achievable.',
      })
    }
  }

  return flags
}

// ---------------------------------------------------------------------------
// Commission preview calculator
// ---------------------------------------------------------------------------
function calcCommissionPreview(offerPrice: number, splitPct = 3, capRemaining?: number) {
  const grossCommission = offerPrice * (splitPct / 100)
  const brokerageSplit = grossCommission * 0.3 // 70/30 default
  const agentNet = grossCommission - brokerageSplit
  const afterCap = capRemaining !== undefined ? Math.min(brokerageSplit, capRemaining) : brokerageSplit
  return {
    offer_price: offerPrice,
    commission_pct: splitPct,
    gross_commission: Math.round(grossCommission * 100) / 100,
    brokerage_split: Math.round(afterCap * 100) / 100,
    agent_net: Math.round((grossCommission - afterCap) * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// GET /api/closeiq?entity=buyers|offers|presets|approvals
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()
    const { searchParams } = new URL(request.url)
    const entity = searchParams.get('entity') || 'offers'
    const id = searchParams.get('id')

    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || 'agent'
    const isBroker = role === 'broker' || role === 'admin'

    switch (entity) {
      case 'buyers': {
        let q = db.from('buyers').select('*').order('updated_at', { ascending: false })
        if (!isBroker) q = q.eq('agent_id', user.id)
        if (id) q = q.eq('id', id).single()
        const { data, error } = await q
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(id ? data : { buyers: data })
      }

      case 'offers': {
        let q = db.from('offers').select('*, buyers(first_name, last_name, readiness_score, preapproval_status), offer_risk_flags(*), offer_approvals(*)').order('updated_at', { ascending: false })
        if (!isBroker) q = q.eq('agent_id', user.id)
        const statusFilter = searchParams.get('status')
        if (statusFilter) q = q.eq('status', statusFilter)
        if (id) q = q.eq('id', id).single()
        const { data, error } = await q
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(id ? data : { offers: data })
      }

      case 'presets': {
        const { data, error } = await db.from('offer_mode_presets').select('*').eq('active', true).order('sort_order')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ presets: data })
      }

      case 'approvals': {
        if (!isBroker) return NextResponse.json({ error: 'broker role required' }, { status: 403 })
        const { data, error } = await db
          .from('offer_approvals')
          .select('*, offers(*, buyers(first_name, last_name, readiness_score), offer_risk_flags(*))')
          .eq('approval_status', 'pending')
          .order('created_at', { ascending: true })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ approvals: data })
      }

      case 'commission': {
        const price = Number(searchParams.get('price') || 0)
        const split = Number(searchParams.get('split') || 3)
        const cap = searchParams.get('cap') ? Number(searchParams.get('cap')) : undefined
        return NextResponse.json(calcCommissionPreview(price, split, cap))
      }

      default:
        return NextResponse.json({ error: 'invalid entity' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('CloseIQ GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/closeiq — create buyer, offer, or approval action
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()
    const body = await request.json()
    const entity = body.entity

    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || 'agent'

    switch (entity) {
      case 'buyer': {
        const buyer = { ...body.data, agent_id: user.id }
        buyer.readiness_score = calcReadinessScore(buyer)
        const { data, error } = await db.from('buyers').insert(buyer).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ buyer: data, readiness: { score: data.readiness_score, label: readinessLabel(data.readiness_score) } })
      }

      case 'offer': {
        const offer = { ...body.data, agent_id: user.id }

        // Insert the offer
        const { data: newOffer, error } = await db.from('offers').insert(offer).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Run risk scan
        let buyer = null
        if (newOffer.buyer_id) {
          const { data: b } = await db.from('buyers').select('*').eq('id', newOffer.buyer_id).single()
          buyer = b
        }
        const risks = scanOfferRisks(newOffer, buyer)

        // Save risk flags
        if (risks.length > 0) {
          await db.from('offer_risk_flags').insert(risks.map(r => ({ ...r, offer_id: newOffer.id })))
        }

        // Calculate risk score (0-100)
        const riskScore = Math.min(100, risks.reduce((s, r) => s + (r.severity === 'high' ? 30 : r.severity === 'moderate' ? 15 : 5), 0))
        await db.from('offers').update({ risk_score: riskScore }).eq('id', newOffer.id)

        // Commission preview
        const commission = calcCommissionPreview(newOffer.offer_price)

        return NextResponse.json({
          offer: { ...newOffer, risk_score: riskScore },
          risks,
          commission,
        })
      }

      case 'submit_for_approval': {
        const offerId = body.offer_id
        if (!offerId) return NextResponse.json({ error: 'offer_id required' }, { status: 400 })

        // Update offer status
        await db.from('offers').update({ status: 'pending_approval' }).eq('id', offerId).eq('agent_id', user.id)

        // Find a broker to assign (first broker in profiles)
        const { data: brokers } = await db.from('profiles').select('id').in('role', ['broker', 'admin']).limit(1)
        const brokerId = brokers?.[0]?.id || user.id

        const { data: approval, error } = await db.from('offer_approvals').insert({
          offer_id: offerId,
          broker_id: brokerId,
          approval_status: 'pending',
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ approval, status: 'pending_approval' })
      }

      case 'broker_action': {
        if (role !== 'broker' && role !== 'admin') return NextResponse.json({ error: 'broker role required' }, { status: 403 })
        const { approval_id, action, notes } = body
        if (!approval_id || !action) return NextResponse.json({ error: 'approval_id and action required' }, { status: 400 })

        const statusMap: Record<string, string> = {
          approve: 'approved', revise: 'revision_requested', reject: 'rejected', escalate: 'escalated',
        }
        const newStatus = statusMap[action]
        if (!newStatus) return NextResponse.json({ error: 'invalid action' }, { status: 400 })

        const updates: any = { approval_status: newStatus, notes }
        if (action === 'approve') updates.approved_at = new Date().toISOString()
        await db.from('offer_approvals').update(updates).eq('id', approval_id)

        // Also update offer status
        const { data: appr } = await db.from('offer_approvals').select('offer_id').eq('id', approval_id).single()
        if (appr) {
          const offerStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'draft'
          await db.from('offers').update({ status: offerStatus }).eq('id', appr.offer_id)
        }

        return NextResponse.json({ success: true, approval_status: newStatus })
      }

      default:
        return NextResponse.json({ error: 'invalid entity' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('CloseIQ POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/closeiq — update buyer or offer
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = adminClient()
    const body = await request.json()
    const entity = body.entity

    switch (entity) {
      case 'buyer': {
        const { id, ...updates } = body.data
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        if (updates.preapproval_status !== undefined || updates.proof_of_funds_uploaded !== undefined ||
            updates.id_verified !== undefined || updates.earnest_money_ready !== undefined) {
          // Recalculate readiness on relevant field changes
          const { data: existing } = await db.from('buyers').select('*').eq('id', id).single()
          const merged = { ...existing, ...updates }
          updates.readiness_score = calcReadinessScore(merged)
        }
        const { data, error } = await db.from('buyers').update(updates).eq('id', id).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ buyer: data, readiness: { score: data.readiness_score, label: readinessLabel(data.readiness_score) } })
      }

      case 'offer': {
        const { id, ...updates } = body.data
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        const { data, error } = await db.from('offers').update(updates).eq('id', id).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ offer: data })
      }

      default:
        return NextResponse.json({ error: 'invalid entity' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('CloseIQ PATCH error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
