/**
 * @jest-environment node
 */
// ============================================================================
// GET /api/broker/agent-portal-preview — security-property tests
// ============================================================================
// Proves the fail-closed contract of the broker-authorized, read-only Agent
// Portal preview endpoint:
//   1. broker + same-tenant agent  → 200, role-derived nav + feature flags,
//      and NO agent-session data (clients/training/matrix/ring/etc.).
//   2. cross-tenant agent           → 404 (identical to not-found).
//   3. non-broker caller            → the gate's own denial status.
//   4. the preview access is audited (structured log emitted).
//
// The gate (requireAdminRole) and the service client (adminClient) are mocked
// so the test exercises THIS route's logic — the tenant predicate, the data
// projection, and the audit — not Supabase or cookie parsing.
// ============================================================================

import { NextResponse } from 'next/server'

// --- Mocks -----------------------------------------------------------------

jest.mock('@/lib/server-auth', () => ({
  requireAdminRole: jest.fn(),
}))

jest.mock('@/lib/security', () => ({
  adminClient: jest.fn(),
}))

// Feature flags default OFF unless the env is set — pin them so the assertions
// are deterministic regardless of the runner's environment.
jest.mock('@/app/(portal)/the-matrix/_lib/matrix-flags', () => ({
  matrixSimulatorEnabled: jest.fn(() => false),
}))
jest.mock('@/app/(portal)/the-ring/_lib/ring-flags', () => ({
  assessmentEntryEnabled: jest.fn(() => false),
  voicePracticeEnabled: jest.fn(() => false),
}))

import { GET } from '@/app/api/broker/agent-portal-preview/route'
import { requireAdminRole } from '@/lib/server-auth'
import { adminClient } from '@/lib/security'

const mockRequireAdminRole = requireAdminRole as jest.Mock
const mockAdminClient = adminClient as jest.Mock

const BROKER_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const AGENT_ID = '22222222-2222-4222-8222-222222222222'

/**
 * A tiny fake supabase-js client. `profiles` reads are keyed by the id passed
 * to `.eq('id', ...)`: the caller (BROKER_ID) resolves to `callerRow`, any
 * other id resolves to `agentRow`. `.single()` returns `{ data, error }`.
 */
function makeSvc(opts: {
  callerRow: { tenant_id: string | null } | null
  agentRow:
    | { id: string; full_name: string; role: string; tenant_id: string; is_active: boolean }
    | null
}) {
  return {
    from(_table: string) {
      let requestedId: string | null = null
      const chain: any = {
        select() {
          return chain
        },
        eq(field: string, value: string) {
          if (field === 'id') requestedId = value
          return chain
        },
        async single() {
          if (requestedId === BROKER_ID) {
            return {
              data: opts.callerRow,
              error: opts.callerRow ? null : { message: 'no rows' },
            }
          }
          return {
            data: opts.agentRow,
            error: opts.agentRow ? null : { message: 'no rows' },
          }
        },
      }
      return chain
    },
  }
}

function req(agentId?: string) {
  const url = agentId
    ? `http://localhost/api/broker/agent-portal-preview?agentId=${agentId}`
    : `http://localhost/api/broker/agent-portal-preview`
  // The route only reads `.nextUrl.searchParams`; a plain object with that
  // shape is enough and avoids constructing a full NextRequest.
  return { nextUrl: new URL(url) } as any
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/broker/agent-portal-preview', () => {
  test('broker + same-tenant agent → 200 with role-derived nav + feature flags, no session data', async () => {
    mockRequireAdminRole.mockResolvedValue({ userId: BROKER_ID, role: 'broker' })
    mockAdminClient.mockReturnValue(
      makeSvc({
        callerRow: { tenant_id: TENANT_A },
        agentRow: {
          id: AGENT_ID,
          full_name: 'Agent Smith',
          role: 'agent',
          tenant_id: TENANT_A,
          is_active: true,
        },
      }),
    )
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await GET(req(AGENT_ID))
    expect(res.status).toBe(200)
    const body = await res.json()

    // Only name + role + active, nothing more.
    expect(body.agent).toEqual({
      id: AGENT_ID,
      name: 'Agent Smith',
      role: 'agent',
      active: true,
    })

    // nav is an array of {href,label} derived from the agent's role.
    expect(Array.isArray(body.nav)).toBe(true)
    expect(body.nav.length).toBeGreaterThan(0)
    for (const item of body.nav) {
      expect(Object.keys(item).sort()).toEqual(['href', 'label'])
    }
    // An 'agent' role sees the Home + Training entries.
    const hrefs = body.nav.map((n: any) => n.href)
    expect(hrefs).toContain('/home')
    expect(hrefs).toContain('/training')

    // features are the env-flag booleans (all mocked false here).
    expect(body.features).toEqual({
      matrixSimulatorEnabled: false,
      ringVoicePracticeEnabled: false,
      ringSellerCertAssessmentEnabled: false,
      payoutConnectEnabled: false,
    })

    // NO agent-session-scoped data leaked anywhere in the response.
    const serialized = JSON.stringify(body)
    expect(body.sessionScopedOmitted).toContain('clients')
    expect(body).not.toHaveProperty('clients')
    expect(body).not.toHaveProperty('training')
    expect(body).not.toHaveProperty('matrix')
    expect(body).not.toHaveProperty('ring')
    expect(body).not.toHaveProperty('transactions')
    expect(body).not.toHaveProperty('followUps')
    expect(body.agent).not.toHaveProperty('email')
    expect(body.agent).not.toHaveProperty('phone')
    // Only the documented omission list may mention these surfaces; the top
    // level must not carry readiness/attempt/progress payloads.
    expect(serialized).not.toMatch(/"attempts"/)
    expect(serialized).not.toMatch(/"readiness"/)

    // Audit: a structured, PII-free access log was emitted.
    expect(warn).toHaveBeenCalledWith(
      '[agent-portal-preview] access',
      expect.objectContaining({
        brokerId: BROKER_ID,
        agentId: AGENT_ID,
        tenantId: TENANT_A,
      }),
    )
    warn.mockRestore()
  })

  test('cross-tenant agent → 404 (never reveals the row)', async () => {
    mockRequireAdminRole.mockResolvedValue({ userId: BROKER_ID, role: 'broker' })
    mockAdminClient.mockReturnValue(
      makeSvc({
        callerRow: { tenant_id: TENANT_A },
        agentRow: {
          id: AGENT_ID,
          full_name: 'Other Tenant Agent',
          role: 'agent',
          tenant_id: TENANT_B, // different tenant
          is_active: true,
        },
      }),
    )

    const res = await GET(req(AGENT_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    // No agent fields leak — same shape as genuine not-found.
    expect(body).not.toHaveProperty('agent')
    expect(JSON.stringify(body)).not.toContain('Other Tenant Agent')
  })

  test('not-found agent → 404 (identical to cross-tenant)', async () => {
    mockRequireAdminRole.mockResolvedValue({ userId: BROKER_ID, role: 'broker' })
    mockAdminClient.mockReturnValue(
      makeSvc({ callerRow: { tenant_id: TENANT_A }, agentRow: null }),
    )

    const res = await GET(req(AGENT_ID))
    expect(res.status).toBe(404)
  })

  test('non-broker caller → the gate denies (403)', async () => {
    // requireAdminRole returns its own NextResponse on denial.
    mockRequireAdminRole.mockResolvedValue(
      NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    )

    const res = await GET(req(AGENT_ID))
    expect(res.status).toBe(403)
    // The service client is never even constructed when the gate denies.
    expect(mockAdminClient).not.toHaveBeenCalled()
  })

  test('missing/invalid agentId → 400 (no DB call)', async () => {
    mockRequireAdminRole.mockResolvedValue({ userId: BROKER_ID, role: 'broker' })

    const res = await GET(req()) // no agentId
    expect(res.status).toBe(400)
    expect(mockAdminClient).not.toHaveBeenCalled()

    const res2 = await GET(req('not-a-uuid'))
    expect(res2.status).toBe(400)
  })
})
