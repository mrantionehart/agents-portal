// ============================================================================
// Agent Portal — Broker Preview Agent View: preview-session audit
// POST /api/broker/preview-session   { surface?: string }
// ============================================================================
// Records that a Broker of Record entered Broker Preview Mode (viewing the real
// Agent Portal with their OWN session). Broker-authorized, tenant-scoped,
// service-role write only — mirrors /api/broker/agent-portal-preview's audit.
//
// Fail-closed contract:
//   • Authorization is the EXISTING broker gate `requireAdminRole` (admits ONLY
//     'broker' | 'admin'); agent/office_manager/unauth → its own 401/403. The
//     gate is the route-security marker, so scripts/check-api-routes.js passes.
//   • No agent data is read or returned. The only state change is the audit row.
//   • tenant_id/actor_id come from the broker's OWN resolved identity, never
//     client input. target_agent_id is the broker themselves — this is a general
//     agent-view preview, not a preview OF a specific agent.
//   • An audit-write failure is logged, never fatal (best-effort telemetry).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/server-auth'
import { adminClient } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireAdminRole()
  if (auth instanceof NextResponse) return auth

  let surface: string | null = null
  try {
    const body = (await request.json()) as { surface?: unknown } | null
    if (body && typeof body.surface === 'string') surface = body.surface.slice(0, 200)
  } catch {
    /* empty/non-JSON body is fine */
  }

  const svc = adminClient('broker-preview-session-audit', {
    userId: auth.userId,
    role: auth.role,
    context: '/api/broker/preview-session',
  })

  // Resolve the broker's OWN tenant — never from client input. No tenant → no audit.
  const { data: callerProfile } = await svc
    .from('profiles')
    .select('tenant_id')
    .eq('id', auth.userId)
    .single()
  const tenantId = callerProfile?.tenant_id as string | undefined
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const { error: auditErr } = await svc.from('agent_portal_preview_audit').insert({
    tenant_id: tenantId,
    actor_id: auth.userId,
    target_agent_id: auth.userId, // general agent-view preview — no specific agent targeted
    action: 'agent_view_preview',
    detail: { surface: surface ?? null },
  })
  if (auditErr) {
    console.warn('[broker-preview-session] audit write failed', {
      brokerId: auth.userId,
      tenantId,
      code: (auditErr as { code?: string }).code ?? null,
    })
  }

  return NextResponse.json({ ok: true })
}
