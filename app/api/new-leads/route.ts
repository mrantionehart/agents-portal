import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireAuth, userClient } from '@/lib/security'

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
//
// SEC.3A (2026-06-25) — cross-tenant containment. The "Anyone can view
// leads" RLS policy let agents see leads posted by users in any tenant.
// Until new_leads gets a tenant_id column (deferred to SEC.3B), we
// resolve tenant via posted_by → profiles.tenant_id and filter at the
// application layer. The platform super-admin (mrhart@hartfeltmg.com)
// retains cross-tenant visibility, matching the SEC.2 contract. All
// other callers see only leads in their own tenant.

const PLATFORM_SUPER_ADMIN_EMAIL = 'mrhart@hartfeltmg.com'

/** Look up the caller's tenant + super-admin flag. Returns null if the
 *  caller has no profile row (fail-closed). */
async function getCallerScope(userId: string): Promise<
  | { tenantId: string | null; isPlatformSuperAdmin: boolean; email: string | null }
  | null
> {
  const svc = adminClient('sec3a-new-leads-tenant-scope', { userId, context: '/api/new-leads' })
  const { data } = await svc
    .from('profiles')
    .select('email, tenant_id')
    .eq('id', userId)
    .single()
  if (!data) return null
  return {
    tenantId: (data.tenant_id as string | null) ?? null,
    isPlatformSuperAdmin: data.email === PLATFORM_SUPER_ADMIN_EMAIL,
    email: data.email as string | null,
  }
}

/** Return the set of user IDs in the given tenant. Used to filter
 *  new_leads.posted_by + new_leads.claimed_by. */
async function getTenantUserIds(tenantId: string, userId: string): Promise<string[]> {
  const svc = adminClient('sec3a-new-leads-tenant-scope', { userId })
  const { data } = await svc.from('profiles').select('id').eq('tenant_id', tenantId)
  return (data ?? []).map((r: { id: string }) => r.id as string)
}

/**
 * GET /api/new-leads?filter=available|mine|all
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    const filter = request.nextUrl.searchParams.get('filter') || 'available'

    // SEC.3A — resolve caller's tenant + super-admin status before the
    // pool query. Fail closed if neither resolves (no tenantless reads).
    const scope = await getCallerScope(user.id)
    if (!scope) {
      return NextResponse.json({ leads: [] })
    }

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

    // SEC.3A — tenant scope (on top of RLS). Without this, agents in
    // any tenant saw leads posted by any other tenant because the
    // RLS policy is "Anyone can view leads / USING (true)".
    if (!scope.isPlatformSuperAdmin) {
      if (!scope.tenantId) {
        return NextResponse.json({ leads: [] })
      }
      const tenantUserIds = await getTenantUserIds(scope.tenantId, user.id)
      if (tenantUserIds.length === 0) {
        return NextResponse.json({ leads: [] })
      }
      // A row belongs to the caller's tenant if posted_by OR claimed_by
      // resolves to a user in that tenant. `filter=mine` is naturally
      // tenant-isolated (user IDs unique), but we apply the filter
      // uniformly for defense-in-depth.
      const ids = tenantUserIds.join(',')
      query = query.or(`posted_by.in.(${ids}),claimed_by.in.(${ids})`)
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
      // SEC.3A — resolve caller scope + target lead's posted_by, verify
      // they share a tenant before any UPDATE. Without this, an agent
      // in tenant A could claim a lead posted by tenant B.
      const scope = await getCallerScope(user.id)
      if (!scope) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }
      const { data: check } = await supabase
        .from('new_leads')
        .select('claimed_by, posted_by')
        .eq('id', leadId)
        .single()

      if (!check) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }
      // SEC.3A — tenant check runs BEFORE the "already claimed" check
      // so a cross-tenant lead returns 404 (existence-safe) rather than
      // 409 (which would confirm the lead exists in another tenant).
      if (!scope.isPlatformSuperAdmin) {
        if (!scope.tenantId) {
          return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
        }
        const tenantUserIds = new Set(await getTenantUserIds(scope.tenantId, user.id))
        if (!check.posted_by || !tenantUserIds.has(check.posted_by)) {
          return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
        }
      }
      if (check.claimed_by) {
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
