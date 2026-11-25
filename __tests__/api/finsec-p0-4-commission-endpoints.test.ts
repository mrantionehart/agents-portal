/**
 * @jest-environment node
 */
// ============================================================================
// FINSEC P0-4 — authentication + tenant authorization on commission endpoints
// ============================================================================
//   GET /api/vault/commissions   (proxy to Vault /commissions/get)
//   GET /api/pipeline            (GCI + agent_amount per transaction)
//
// middleware.ts excludes /api/*, so each route must gate itself. These suites
// run the REAL `requireAuth` (lib/security/withAuth.ts) — only the Supabase
// network clients are faked — so "inactive user refused" is the shared gate
// actually refusing, not a stub returning 403.
//
// The fake DB answers by filtering seeded rows on the predicates the route
// ADDS. A route that forgot a tenant or agent predicate therefore returns the
// foreign rows here, which is what the cross-tenant tests catch.
// ============================================================================

type Row = Record<string, any>

const TENANT_A = 'tenant-A'
const TENANT_B = 'tenant-B'

const PROFILES: Record<string, Row> = {
  'agent-a1': { id: 'agent-a1', role: 'agent', tenant_id: TENANT_A, is_active: true, full_name: 'A1', email: 'a1@x.test' },
  'agent-a2': { id: 'agent-a2', role: 'agent', tenant_id: TENANT_A, is_active: true, full_name: 'A2', email: 'a2@x.test' },
  'broker-a': { id: 'broker-a', role: 'broker', tenant_id: TENANT_A, is_active: true, full_name: 'BA', email: 'ba@x.test' },
  'agent-b1': { id: 'agent-b1', role: 'agent', tenant_id: TENANT_B, is_active: true, full_name: 'B1', email: 'b1@x.test' },
  'broker-b': { id: 'broker-b', role: 'broker', tenant_id: TENANT_B, is_active: true, full_name: 'BB', email: 'bb@x.test' },
  'inactive-agent': { id: 'inactive-agent', role: 'agent', tenant_id: TENANT_A, is_active: false, full_name: 'X', email: 'x@x.test' },
  'tenantless-broker': { id: 'tenantless-broker', role: 'broker', tenant_id: null, is_active: true, full_name: 'TB', email: 'tb@x.test' },
  'office-mgr': { id: 'office-mgr', role: 'office_manager', tenant_id: TENANT_A, is_active: true, full_name: 'OM', email: 'om@x.test' },
}

const tx = (id: string, agent_id: string, tenant_id: string): Row => ({
  id, agent_id, tenant_id, type: 'listing', status: 'closed', property_address: `${id} St`, city: 'C',
  contract_price: 100000, closing_date: '2026-10-01', created_at: '2026-09-01T00:00:00Z', deleted_at: null,
})
const TRANSACTIONS: Row[] = [
  tx('tx-a1', 'agent-a1', TENANT_A),
  tx('tx-a2', 'agent-a2', TENANT_A),
  tx('tx-b1', 'agent-b1', TENANT_B),
]
const COMMISSIONS: Row[] = TRANSACTIONS.map((t) => ({
  transaction_id: t.id, gross_commission: 3000, commission_rate_pct: 3, agent_amount: 2400, agent_split_pct: 80,
}))

// token → user id. Any other token is invalid.
const TOKENS: Record<string, string> = Object.fromEntries(Object.keys(PROFILES).map((id) => [`tok-${id}`, id]))

/** Records every query so tests can assert on what was (not) read. */
const queryLog: { table: string; filters: [string, string, any][] }[] = []

function makeDb() {
  return {
    auth: {
      getUser: jest.fn(async (token?: string) => {
        const id = token ? TOKENS[token] : undefined
        return id
          ? { data: { user: { id } }, error: null }
          : { data: { user: null }, error: { message: 'invalid' } }
      }),
    },
    from(table: string) {
      const q = { table, filters: [] as [string, string, any][] }
      queryLog.push(q)
      const rows = (): Row[] => {
        const src: Row[] =
          table === 'profiles' ? Object.values(PROFILES) :
          table === 'transactions' ? TRANSACTIONS :
          table === 'commissions' ? COMMISSIONS : []
        return src.filter((r) =>
          q.filters.every(([op, f, v]) => {
            if (op === 'eq') return r[f] === v
            if (op === 'in') return (v as any[]).includes(r[f])
            if (op === 'is') return r[f] === v
            if (op === 'not') return true
            return true
          }),
        )
      }
      const chain: any = {
        select: () => chain,
        order: () => chain,
        eq: (f: string, v: any) => (q.filters.push(['eq', f, v]), chain),
        in: (f: string, v: any) => (q.filters.push(['in', f, v]), chain),
        is: (f: string, v: any) => (q.filters.push(['is', f, v]), chain),
        not: (f: string, _o: string, v: any) => (q.filters.push(['not', f, v]), chain),
        single: async () => {
          const r = rows()
          return r.length === 1 ? { data: r[0], error: null } : { data: null, error: { message: 'no rows' } }
        },
        maybeSingle: async () => {
          const r = rows()
          return { data: r[0] ?? null, error: null }
        },
        then: (resolve: any, reject: any) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
      }
      return chain
    },
  }
}

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => makeDb()) }))
// Cookie transport: no session in these tests (Bearer is the transport under test).
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: null }, error: null })) },
    from: () => { throw new Error('cookie client must not be queried') },
  })),
}))
jest.mock('@/lib/vault-client', () => ({ VAULT_API_URL: 'https://vault.test/api' }))

// Every supabase-js client (auth + userClient) sees the same fake store.
import { NextRequest } from 'next/server'
import { GET as commissionsGET } from '@/app/api/vault/commissions/route'
import { GET as pipelineGET } from '@/app/api/pipeline/route'

const req = (path: string, token?: string, extraHeaders: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, {
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders },
  })

let fetchMock: jest.Mock
beforeEach(() => {
  queryLog.length = 0
  fetchMock = jest.fn(async () => ({ status: 200, json: async () => ({ commissions: [{ id: 'c1' }] }) }))
  global.fetch = fetchMock as unknown as typeof fetch
})

// ---------------------------------------------------------------------------
describe('FINSEC P0-4 — GET /api/vault/commissions', () => {
  it('[P04-VC1] anonymous → 401 and Vault is never called', async () => {
    const res = await commissionsGET(req('/api/vault/commissions'))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('[P04-VC2] invalid bearer → 401 and Vault is never called', async () => {
    const res = await commissionsGET(req('/api/vault/commissions', 'forged-token'))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('[P04-VC3] a non-Bearer Authorization header is not relayed → 401', async () => {
    const res = await commissionsGET(req('/api/vault/commissions', undefined, { authorization: 'Basic abc' }))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('[P04-VC4] inactive account → 403 inactive_account and Vault is never called', async () => {
    const res = await commissionsGET(req('/api/vault/commissions', 'tok-inactive-agent'))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('inactive_account')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('[P04-VC5] active agent → 200, Vault body relayed, ONLY the validated bearer forwarded', async () => {
    const res = await commissionsGET(req('/api/vault/commissions?agent_id=agent-b1', 'tok-agent-a1', {
      'x-user-id': 'agent-b1',
      'x-user-role': 'admin',
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ commissions: [{ id: 'c1' }] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    // No caller-supplied query (e.g. agent_id) reaches Vault — it scopes to the token.
    expect(url).toBe('https://vault.test/api/commissions/get')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-agent-a1')
    const names = Object.keys(headers).map((h) => h.toLowerCase())
    expect(names).not.toContain('x-user-id')
    expect(names).not.toContain('x-user-role')
  })

  it('[P04-VC6] Vault denial status is relayed, not upgraded', async () => {
    fetchMock.mockResolvedValueOnce({ status: 403, json: async () => ({ error: 'forbidden' }) })
    const res = await commissionsGET(req('/api/vault/commissions', 'tok-agent-a1'))
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
const txIds = (body: any): string[] =>
  body.pipeline.flatMap((g: any) => g.stages.flatMap((s: any) => s.transactions.map((t: any) => t.id))).sort()

describe('FINSEC P0-4 — GET /api/pipeline', () => {
  it('[P04-PL1] anonymous → 401, no DB read', async () => {
    const res = await pipelineGET(req('/api/pipeline'))
    expect(res.status).toBe(401)
    expect(queryLog.some((q) => q.table === 'transactions' || q.table === 'commissions')).toBe(false)
  })

  it('[P04-PL2] inactive account → 403, no transactions/commissions read', async () => {
    const res = await pipelineGET(req('/api/pipeline', 'tok-inactive-agent'))
    expect(res.status).toBe(403)
    expect(queryLog.some((q) => q.table === 'transactions' || q.table === 'commissions')).toBe(false)
  })

  it('[P04-PL3] agent, no agent_id → 200 with OWN transactions only', async () => {
    const res = await pipelineGET(req('/api/pipeline', 'tok-agent-a1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(txIds(body)).toEqual(['tx-a1'])
    expect(body.agents).toEqual([])
  })

  it('[P04-PL4] agent asking for their OWN agent_id → 200', async () => {
    const res = await pipelineGET(req('/api/pipeline?agent_id=agent-a1', 'tok-agent-a1'))
    expect(res.status).toBe(200)
    expect(txIds(await res.json())).toEqual(['tx-a1'])
  })

  it('[P04-PL5] agent asking for ANOTHER agent (same tenant) → 403, no transactions read', async () => {
    const res = await pipelineGET(req('/api/pipeline?agent_id=agent-a2', 'tok-agent-a1'))
    expect(res.status).toBe(403)
    expect(queryLog.some((q) => q.table === 'transactions')).toBe(false)
  })

  it('[P04-PL6] agent asking for an agent in ANOTHER tenant → 403', async () => {
    const res = await pipelineGET(req('/api/pipeline?agent_id=agent-b1', 'tok-agent-a1'))
    expect(res.status).toBe(403)
  })

  it('[P04-PL7] office_manager is not broker-tier: other agent → 403, default → own only', async () => {
    expect((await pipelineGET(req('/api/pipeline?agent_id=agent-a1', 'tok-office-mgr'))).status).toBe(403)
    const res = await pipelineGET(req('/api/pipeline', 'tok-office-mgr'))
    expect(res.status).toBe(200)
    expect(txIds(await res.json())).toEqual([])
  })

  it('[P04-PL8] broker, all-agents view → 200 with ONLY own-tenant transactions + own-tenant roster', async () => {
    const res = await pipelineGET(req('/api/pipeline', 'tok-broker-a'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(txIds(body)).toEqual(['tx-a1', 'tx-a2'])
    const rosterTenants = new Set(body.agents.map((a: any) => PROFILES[a.id].tenant_id))
    expect([...rosterTenants]).toEqual([TENANT_A])
    const txQuery = queryLog.find((q) => q.table === 'transactions')!
    expect(txQuery.filters).toContainEqual(['eq', 'tenant_id', TENANT_A])
  })

  it('[P04-PL9] broker, same-tenant agent_id → 200 with that agent only', async () => {
    const res = await pipelineGET(req('/api/pipeline?agent_id=agent-a2', 'tok-broker-a'))
    expect(res.status).toBe(200)
    expect(txIds(await res.json())).toEqual(['tx-a2'])
  })

  it('[P04-PL10] broker, CROSS-tenant agent_id → 403, no transactions read', async () => {
    const res = await pipelineGET(req('/api/pipeline?agent_id=agent-b1', 'tok-broker-a'))
    expect(res.status).toBe(403)
    expect(queryLog.some((q) => q.table === 'transactions')).toBe(false)
  })

  it('[P04-PL11] the other tenant\'s broker sees only their own tenant', async () => {
    const res = await pipelineGET(req('/api/pipeline', 'tok-broker-b'))
    expect(res.status).toBe(200)
    expect(txIds(await res.json())).toEqual(['tx-b1'])
  })

  it('[P04-PL12] tenant-less broker → 403 (fail closed), no transactions read', async () => {
    const res = await pipelineGET(req('/api/pipeline', 'tok-tenantless-broker'))
    expect(res.status).toBe(403)
    expect(queryLog.some((q) => q.table === 'transactions')).toBe(false)
  })
})
