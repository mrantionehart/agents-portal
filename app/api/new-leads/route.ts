import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Sprint 8B Phase 2B: converted from service-role to anon-key + user JWT.
// Policy anchors verified in Sprint 8B Phase 2A (Sprint 2B's original
// row-aware policies still present in production):
//   new_leads / Anyone can view leads / SELECT / {authenticated} / true
//   new_leads / Claim unclaimed leads / UPDATE / qual=(claimed_by IS NULL)
//                                       WITH CHECK (claimed_by = auth.uid())
//   new_leads / Owner can edit claimed leads / UPDATE /
//                qual=(claimed_by = auth.uid())
//                WITH CHECK ((claimed_by = auth.uid()) OR (claimed_by IS NULL))
// The route's explicit ownership checks + `.is('claimed_by', null)` /
// `.eq('claimed_by', user.id)` filters remain as belt-and-braces guards.

/**
 * GET /api/new-leads?filter=available|mine|all
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const filter = request.nextUrl.searchParams.get('filter') || 'available'

    const supabase = userClient(request)

    let query = supabase
      .from('new_leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter === 'available') {
      query = query.is('claimed_by', null)
    } else if (filter === 'mine') {
      query = query.eq('claimed_by', user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error('New leads fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }

    return NextResponse.json({ leads: data || [] })
  } catch (error) {
    console.error('New leads GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/new-leads
 *   { action: 'claim',   leadId: string }
 *   { action: 'unclaim', leadId: string }
 *
 * Sprint 3: 'unclaim' added so that app/lead-distribution/page.tsx can stop
 * issuing direct anon-key UPDATEs against public.new_leads. Authorization is
 * enforced server-side AND by RLS (Sprint 2B migration 001g).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const body = await request.json()
    const { action, leadId } = body

    if (!leadId || (action !== 'claim' && action !== 'unclaim')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = userClient(request)

    if (action === 'claim') {
      // Check if still available
      const { data: check } = await supabase
        .from('new_leads')
        .select('claimed_by')
        .eq('id', leadId)
        .single()

      if (check?.claimed_by) {
        return NextResponse.json({ error: 'Lead already claimed' }, { status: 409 })
      }

      // Get agent name (own-row read via profiles_select)
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Claim it — RLS "Claim unclaimed leads" gates UPDATE: qual checks
      // claimed_by IS NULL, WITH CHECK enforces claimed_by = auth.uid().
      const { error } = await supabase
        .from('new_leads')
        .update({
          claimed_by: user.id,
          claimed_by_name: profile?.full_name || user.email,
          claimed_at: new Date().toISOString(),
          status: 'claimed',
        })
        .eq('id', leadId)
        .is('claimed_by', null) // Double-check atomicity

      if (error) {
        console.error('Claim error:', error)
        return NextResponse.json({ error: 'Failed to claim lead' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // action === 'unclaim'
    // Fetch the target lead to verify ownership.
    const { data: lead, error: fetchError } = await supabase
      .from('new_leads')
      .select('claimed_by')
      .eq('id', leadId)
      .single()

    if (fetchError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (!lead.claimed_by) {
      // Idempotent: already unclaimed.
      return NextResponse.json({ success: true })
    }

    if (lead.claimed_by !== user.id) {
      console.warn(
        `[security:new-leads] cross-user unclaim denied caller=${user.id} lead=${leadId} owner=${lead.claimed_by}`
      )
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Release the claim. RLS "Owner can edit claimed leads" gates UPDATE:
    // qual checks claimed_by = auth.uid(), WITH CHECK allows either own
    // or NULL (the new value). The .eq('claimed_by', user.id) filter
    // remains as a belt-and-braces guard.
    const { error: unclaimError } = await supabase
      .from('new_leads')
      .update({
        claimed_by: null,
        claimed_by_name: null,
        claimed_at: null,
        status: 'available',
      })
      .eq('id', leadId)
      .eq('claimed_by', user.id)

    if (unclaimError) {
      console.error('Unclaim error:', unclaimError)
      return NextResponse.json({ error: 'Failed to unclaim lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('New leads POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
