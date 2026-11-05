// ============================================================================
// Agent Portal — Broker-authorized, READ-ONLY Agent Portal preview
// GET /api/broker/agent-portal-preview?agentId=<uuid>
// ============================================================================
// Lets a broker/admin see WHAT a selected agent's Portal shell would expose —
// the role-derived sidebar nav and the current tenant-wide feature-flag
// posture — WITHOUT ever authenticating as that agent or touching any of the
// agent's own data.
//
// Fail-closed contract (what this route guarantees):
//   • Authorization is the EXISTING broker gate, `requireAdminRole` from
//     lib/server-auth.ts (admits ONLY 'broker' | 'admin'). No new allowlist is
//     introduced and the gate is not widened — office_manager, agent, and
//     unauthenticated callers all receive the gate's own 401/403.
//   • The response is computed purely from the agent's ROLE
//     (`visibleNavItems(role)`) and from this deployment's build-time env
//     flags. It NEVER uses the agent's session/token and NEVER calls any
//     agent-token-scoped endpoint.
//   • Cross-tenant reads are impossible to observe: if the selected agent is
//     not in the caller broker's tenant, the route returns 404 — the SAME
//     code as a genuinely missing agent — so a cross-tenant row is never
//     revealed, not even by status-code differential.
//   • The ONLY state change this route may perform is the preview-access
//     audit record below. Everything else is read-only.
//
// What is intentionally OMITTED (and why): any agent-session-only surface —
// training/HartFelt-Ready progress, Matrix readiness/attempts, The Ring
// progress, clients, follow-ups, transactions, meetings, notifications. Those
// require the agent's own session/token to fetch and are NEVER retrieved with
// the broker's credentials. Omission is deliberate (fail closed), not a TODO.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/server-auth'
import { adminClient } from '@/lib/security'
import { visibleNavItems } from '@/src/portal/nav-config'
import { matrixSimulatorEnabled } from '@/app/(portal)/the-matrix/_lib/matrix-flags'
import {
  assessmentEntryEnabled,
  voicePracticeEnabled,
} from '@/app/(portal)/the-ring/_lib/ring-flags'

export const dynamic = 'force-dynamic'

/** Minimal UUID v1–v5 shape guard — rejects obviously malformed input before
 *  it ever reaches the database. Not an authorization control. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** The agent-session-only surfaces this endpoint refuses to fetch with a
 *  broker's credentials. Returned to the caller so the contract is explicit in
 *  the payload itself, not just in docs. */
const SESSION_SCOPED_OMITTED = [
  'training/HartFelt-Ready progress',
  'Matrix readiness/attempts',
  'The Ring progress',
  'clients',
  'follow-ups',
  'transactions',
  'meetings',
  'notifications',
] as const

/** Read the payout-rail flag the same way CommissionPayoutsCard does. There is
 *  no exported helper for it, so the env read is mirrored here verbatim. */
function payoutConnectEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED === 'true'
}

export async function GET(request: NextRequest) {
  // 1. EXISTING broker gate. Non-broker/non-admin → the gate's own 401/403.
  const auth = await requireAdminRole()
  if (auth instanceof NextResponse) return auth

  // 2. Validate input shape. A malformed id is a 400 (not found-ish), never a DB call.
  const agentId = request.nextUrl.searchParams.get('agentId')
  if (!agentId || !UUID_RE.test(agentId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing agentId' },
      { status: 400 },
    )
  }

  // Service-role client — read the caller's tenant and the selected agent's
  // profile. RLS on `profiles` is not relied upon as the sole tenant defence;
  // the tenant predicate is enforced in code (see step 4).
  const svc = adminClient('r3b-intakes-tenant-scope', {
    userId: auth.userId,
    role: auth.role,
    context: '/api/broker/agent-portal-preview',
  })

  // 3. Resolve the broker's OWN tenant from their OWN profile — never from client input.
  const { data: callerProfile, error: callerErr } = await svc
    .from('profiles')
    .select('tenant_id')
    .eq('id', auth.userId)
    .single()

  if (callerErr || !callerProfile || !callerProfile.tenant_id) {
    // A broker with no resolvable tenant can preview nobody. Fail closed.
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 },
    )
  }
  const brokerTenantId = callerProfile.tenant_id as string

  // 4. Read ONLY the selected agent's non-sensitive profile fields.
  const { data: agent, error: agentErr } = await svc
    .from('profiles')
    .select('id, full_name, role, tenant_id, is_active')
    .eq('id', agentId)
    .single()

  // Not-found AND cross-tenant collapse to the SAME 404 — a cross-tenant row
  // is never revealed, not even via a status-code differential.
  if (agentErr || !agent || agent.tenant_id !== brokerTenantId) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 },
    )
  }

  // 5. Compute the preview WITHOUT the agent's session or any agent data.
  //    nav is a pure function of the agent's role; features are this
  //    deployment's build-time env-flag booleans.
  const nav = visibleNavItems(agent.role as string | null).map((item) => ({
    href: item.href,
    label: item.label,
  }))

  const features = {
    matrixSimulatorEnabled: matrixSimulatorEnabled(),
    ringVoicePracticeEnabled: voicePracticeEnabled(),
    ringSellerCertAssessmentEnabled: assessmentEntryEnabled(),
    payoutConnectEnabled: payoutConnectEnabled(),
  }

  // 6. AUDIT the preview access DURABLY, tenant-scoped. Written via the service
  //    role to public.agent_portal_preview_audit (RLS on, no anon/authenticated
  //    grants — server-only). tenant_id/actor_id come from the broker's own
  //    resolved identity, never client input. An audit-write failure is logged
  //    but never fails the read. (supabase-js builder has no .catch — capture
  //    the error object, don't chain.)
  const { error: auditErr } = await svc.from('agent_portal_preview_audit').insert({
    tenant_id: brokerTenantId,
    actor_id: auth.userId,
    target_agent_id: agent.id,
    action: 'agent_portal_preview',
    detail: { role: agent.role },
  })
  if (auditErr) {
    console.warn('[agent-portal-preview] audit write failed', {
      brokerId: auth.userId,
      agentId: agent.id,
      tenantId: brokerTenantId,
      code: (auditErr as { code?: string }).code ?? null,
    })
  }

  return NextResponse.json({
    agent: {
      id: agent.id,
      name: agent.full_name,
      role: agent.role,
      active: agent.is_active,
    },
    nav,
    features,
    sessionScopedOmitted: SESSION_SCOPED_OMITTED,
    note:
      'Agent-session-only data is intentionally omitted (fail closed): it ' +
      "requires the agent's own session/token and is NEVER fetched with the " +
      "broker's token.",
  })
}
