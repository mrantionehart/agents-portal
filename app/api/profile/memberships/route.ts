// ============================================================================
// MDC-1 — My Memberships & MLS (agent self-service), forwarded to Vault.
// ============================================================================
// Vault is the system of record and derives the agent and brokerage from the
// session token. This route NEVER forwards agent_id / tenant_id or any
// verified/staff field: declaration fields are allowlisted below, and Vault
// allowlists them again. No service role, no browser writes.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'
import { membershipSectionEnabled } from '@/src/portal/profile/membership-flag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MEMBERSHIP_FIELDS = [
  'association_name', 'membership_class', 'is_primary', 'membership_number',
  'declared_status', 'declared_effective_date', 'declared_renewal_date', 'agent_note',
] as const
const MLS_FIELDS = ['mls_provider', 'declared_status', 'declared_renewal_date', 'mls_member_id', 'agent_note'] as const

function pick(input: Record<string, unknown>, keys: readonly string[]) {
  const out: Record<string, unknown> = {}
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(input, k)) out[k] = input[k]
  return out
}

export async function GET(request: NextRequest) {
  if (!membershipSectionEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  return proxyToVault(request, 'GET', '/agent/membership-compliance')
}

/** { kind: 'membership' | 'mls', ...declaration fields } */
export async function POST(request: NextRequest) {
  if (!membershipSectionEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (input.kind === 'mls') return proxyToVault(request, 'POST', '/agent/membership-compliance/mls', pick(input, MLS_FIELDS))
  if (input.kind === 'membership') return proxyToVault(request, 'POST', '/agent/membership-compliance/memberships', pick(input, MEMBERSHIP_FIELDS))
  return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })
}
