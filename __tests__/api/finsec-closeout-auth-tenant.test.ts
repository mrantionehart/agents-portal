/**
 * @jest-environment node
 */
// ============================================================================
// FINSEC closeout — shared auth gate + tenant scope on the remaining routes
// ============================================================================
// Each route below used a LOCAL copy of getAuthedUser that skipped the
// profiles is_active / suspended / deleted check, and several bounded broker
// reads by RLS alone (which, for buyers/offers/documents/client_profiles, is
// role-only, not tenant-scoped). These suites run the REAL `requireAuth`
// (lib/security/withAuth.ts) — only the Supabase network clients are faked —
// and the fake DB answers by filtering seeded rows on the predicates the
// route ADDS, so a missing tenant/agent predicate returns the foreign rows.
// ============================================================================

type Row = Record<string, any>

const A = 'tenant-A'
const B = 'tenant-B'

const PROFILES: Row[] = [
  { id: 'agent-a1', role: 'agent', tenant_id: A, is_active: true, full_name: 'A1', email: 'a1@x.test' },
  { id: 'agent-a2', role: 'agent', tenant_id: A, is_active: true, full_name: 'A2', email: 'a2@x.test' },
  { id: 'broker-a', role: 'broker', tenant_id: A, is_active: true, full_name: 'BA', email: 'ba@x.test' },
  { id: 'agent-b1', role: 'agent', tenant_id: B, is_active: true, full_name: 'B1', email: 'b1@x.test' },
  { id: 'broker-b', role: 'broker', tenant_id: B, is_active: true, full_name: 'BB', email: 'bb@x.test' },
  { id: 'inactive-agent', role: 'agent', tenant_id: A, is_active: false, full_name: 'X', email: 'x@x.test' },
  { id: 'suspended-broker', role: 'broker', tenant_id: A, is_active: true, suspended_at: '2026-11-01', full_name: 'S', email: 's@x.test' },
  { id: 'tenantless-broker', role: 'broker', tenant_id: null, is_active: true, full_name: 'TB', email: 'tb@x.test' },
  { id: 'office-mgr', role: 'office_manager', tenant_id: A, is_active: true, full_name: 'OM', email: 'om@x.test' },
]

const seed = (): Record<string, Row[]> => ({
  profiles: PROFILES.map((p) => ({ ...p })),
  buyers: [
    { id: 'buyer-a1', agent_id: 'agent-a1', first_name: 'Ann' },
    { id: 'buyer-b1', agent_id: 'agent-b1', first_name: 'Bob' },
  ],
  offers: [
    { id: 'offer-a1', agent_id: 'agent-a1', buyer_id: 'buyer-a1', property_address: '1 A St', offer_price: 100, status: 'draft' },
    { id: 'offer-a2', agent_id: 'agent-a2', buyer_id: null, property_address: '2 A St', offer_price: 100, status: 'draft' },
    { id: 'offer-b1', agent_id: 'agent-b1', buyer_id: 'buyer-b1', property_address: '1 B St', offer_price: 100, status: 'draft' },
  ],
  offer_approvals: [],
  transactions: [
    { id: 'tx-a1', agent_id: 'agent-a1', tenant_id: A, type: 'buyer', deleted_at: null },
    { id: 'tx-b1', agent_id: 'agent-b1', tenant_id: B, type: 'buyer', deleted_at: null },
  ],
  documents: [
    { id: 'doc-a', name: 'Doc A', deleted_at: null, uploaded_by: 'agent-a1', transactions: { id: 'tx-a1', agent_id: 'agent-a1', tenant_id: A, property_address: '1 A St', city: 'C', type: 'buyer' } },
    { id: 'doc-b', name: 'Doc B', deleted_at: null, uploaded_by: 'agent-b1', transactions: { id: 'tx-b1', agent_id: 'agent-b1', tenant_id: B, property_address: '1 B St', city: 'C', type: 'buyer' } },
  ],
  client_profiles: [
    { id: 'cp-a', tenant_id: A, assigned_agent_id: 'agent-a1', status: 'active', visibility: 'private' },
    { id: 'cp-b', tenant_id: B, assigned_agent_id: 'agent-b1', status: 'dispo', visibility: 'dispo_feed' },
  ],
  contract_templates: [{ id: 't1', name: 'T', category: 'c', is_active: true }],
  manual_wins: [],
})

let db: Record<string, Row[]> = seed()
type Q = { table: string; op: string; filters: [string, string, any][]; payload?: any }
const log: Q[] = []

const TOKENS: Record<string, string> = Object.fromEntries(PROFILES.map((p) => [`tok-${p.id}`, p.id]))

function makeDb() {
  return {
    auth: {
      getUser: jest.fn(async (token?: string) => {
        const id = token ? TOKENS[token] : undefined
        return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'invalid' } }
      }),
    },
    rpc: jest.fn(async () => ({ data: null, error: null })),
    from(table: string) {
      const q: Q = { table, op: 'select', filters: [] }
      log.push(q)
      const match = (): Row[] =>
        (db[table] || []).filter((r) =>
          q.filters.every(([op, f, v]) => {
            if (op === 'eq') return r[f] === v
            if (op === 'in') return (v as any[]).includes(r[f])
            if (op === 'is') return (r[f] ?? null) === v
            return true
          }),
        )
      const result = (): Row[] => {
        if (q.op === 'insert') {
          const rows = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((p: Row, i: number) => ({ id: `${table}-new-${i}`, ...p }))
          db[table] = [...(db[table] || []), ...rows]
          return rows
        }
        const rows = match()
        if (q.op === 'update') rows.forEach((r) => Object.assign(r, q.payload))
        return rows
      }
      const chain: any = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        gte: () => chain,
        or: () => chain,
        not: () => chain,
        ilike: () => chain,
        eq: (f: string, v: any) => (q.filters.push(['eq', f, v]), chain),
        in: (f: string, v: any) => (q.filters.push(['in', f, v]), chain),
        is: (f: string, v: any) => (q.filters.push(['is', f, v]), chain),
        update: (p: any) => ((q.op = 'update'), (q.payload = p), chain),
        insert: (p: any) => ((q.op = 'insert'), (q.payload = p), chain),
        upsert: (p: any) => ((q.op = 'insert'), (q.payload = p), chain),
        delete: () => ((q.op = 'delete'), chain),
        single: async () => {
          const r = result()
          return r.length === 1 ? { data: r[0], error: null } : { data: null, error: { message: 'no rows' } }
        },
        maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve({ data: result(), error: null }).then(res, rej),
      }
      return chain
    },
  }
}

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => makeDb()) }))
// Cookie transport. The client-intelligence routes are cookie-only (the
// portal), so a test signs in by cookie with `cookieUserId`; null = no cookie.
let cookieUserId: string | null = null
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    ...makeDb(),
    auth: { getUser: jest.fn(async () => ({ data: { user: cookieUserId ? { id: cookieUserId } : null }, error: null })) },
  })),
}))
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))
jest.mock('@/lib/security', () => {
  const actual = jest.requireActual('@/lib/security')
  return { ...actual, adminClient: () => makeDb() }
})
jest.mock('@/lib/vault-client', () => ({ VAULT_API_URL: 'https://vault.test/api', VAULT_BASE_URL: 'https://vault.test' }))
jest.mock('@/lib/vault-forward', () => ({
  proxyToVault: jest.fn(),
  ensureVaultForms: jest.fn(async () => ({ ok: true, status: 200, body: {} })),
}))
jest.mock('@/lib/vault-requirements-report', () => ({
  fetchVaultRequirementsReport: jest.fn(async () => ({ ok: false })),
  complianceCompleteFromReport: jest.fn(() => ({ complete: false })),
}))
jest.mock('@/lib/push-notifications', () => ({ sendExpoPushToUsers: jest.fn(async () => ({})) }))
jest.mock('@sendgrid/mail', () => ({ __esModule: true, default: { setApiKey: jest.fn(), send: jest.fn() } }))

import { NextRequest } from 'next/server'
import * as closeiq from '@/app/api/closeiq/route'
import * as templates from '@/app/api/closeiq/templates/route'
import * as review from '@/app/api/compliance/review/route'
import * as complianceTx from '@/app/api/compliance/transactions/route'
import * as scan from '@/app/api/compliance/scan/route'
import * as txCreate from '@/app/api/transactions/create/route'
import * as licenses from '@/app/api/licenses/check/route'
import * as leaderboard from '@/app/api/leaderboard/route'
import * as calendar from '@/app/api/calendar/events/route'
import * as signVideo from '@/app/api/training/sign-video/route'
import * as clientIntel from '@/app/api/broker/client-intelligence/route'
import * as agentView from '@/app/api/broker/client-intelligence/[id]/agent-view/route'

const req = (path: string, token?: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(`http://localhost${path}`, {
    method: init.method || 'GET',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })
const post = (path: string, token: string | undefined, body: unknown) => req(path, token, { method: 'POST', body })
const patch = (path: string, token: string | undefined, body: unknown) => req(path, token, { method: 'PATCH', body })

const reads = (table: string) => log.filter((q) => q.table === table)
const writes = (table: string) => log.filter((q) => q.table === table && q.op !== 'select')

beforeEach(() => {
  db = seed()
  log.length = 0
  cookieUserId = null
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

// ---------------------------------------------------------------------------
// 1. The shared gate on every converted route: anonymous 401, inactive 403.
// ---------------------------------------------------------------------------
type Call = (token?: string) => Promise<Response>
const GATED: [string, Call][] = [
  ['GET /api/closeiq', (t) => closeiq.GET(req('/api/closeiq?entity=offers', t))],
  ['POST /api/closeiq', (t) => closeiq.POST(post('/api/closeiq', t, { entity: 'submit_for_approval', offer_id: 'offer-a1' }))],
  ['PATCH /api/closeiq', (t) => closeiq.PATCH(patch('/api/closeiq', t, { entity: 'offer', data: { id: 'offer-a1', status: 'x' } }))],
  ['GET /api/closeiq/templates', (t) => templates.GET(req('/api/closeiq/templates', t))],
  ['POST /api/compliance/review', (t) => review.POST(post('/api/compliance/review', t, { document_id: 'doc-a', action: 'approve' }))],
  ['GET /api/compliance/transactions', (t) => complianceTx.GET(req('/api/compliance/transactions', t))],
  ['POST /api/compliance/scan', (t) => scan.POST(post('/api/compliance/scan', t, { agent_id: 'agent-a1' }))],
  ['POST /api/transactions/create', (t) => txCreate.POST(post('/api/transactions/create', t, { type: 'buyer', property_address: 'x', business_line: 'brokerage' }))],
  ['GET /api/licenses/check', (t) => licenses.GET(req('/api/licenses/check', t))],
  ['POST /api/licenses/check', (t) => licenses.POST(post('/api/licenses/check', t, {}))],
  ['GET /api/leaderboard', (t) => leaderboard.GET(req('/api/leaderboard', t))],
  ['GET /api/calendar/events', (t) => calendar.GET(req('/api/calendar/events', t))],
  ['GET /api/training/sign-video', (t) => signVideo.GET(req('/api/training/sign-video?key=training/a.mp4', t))],
  ['GET /api/broker/client-intelligence', (t) => clientIntel.GET(req('/api/broker/client-intelligence', t))],
  ['GET /api/broker/client-intelligence/[id]/agent-view', (t) =>
    agentView.GET(req('/api/broker/client-intelligence/cp-a/agent-view', t), { params: Promise.resolve({ id: 'cp-a' }) })],
]

const DATA_TABLES = ['buyers', 'offers', 'offer_approvals', 'documents', 'transactions', 'client_profiles', 'contract_templates', 'manual_wins', 'license_notifications']

describe('FINSEC closeout — shared gate on every converted route', () => {
  it.each(GATED)('%s: anonymous → 401, no data read', async (_n, call) => {
    const res = await call()
    expect(res.status).toBe(401)
    expect(log.some((q) => DATA_TABLES.includes(q.table))).toBe(false)
  })

  it.each(GATED)('%s: inactive account → 403 inactive_account, no data read', async (_n, call) => {
    const res = await call('tok-inactive-agent')
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('inactive_account')
    expect(log.some((q) => DATA_TABLES.includes(q.table))).toBe(false)
  })

  it('a SUSPENDED broker (is_active still true) is refused too', async () => {
    const res = await closeiq.GET(req('/api/closeiq?entity=offers', 'tok-suspended-broker'))
    expect(res.status).toBe(403)
  })

  it('sign-video keeps the EASE lowercase 401 body', async () => {
    const res = await signVideo.GET(req('/api/training/sign-video?key=training/a.mp4'))
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  })
})

// ---------------------------------------------------------------------------
// 2. CloseIQ — tenant scope for broker-tier callers, ownership for agents.
// ---------------------------------------------------------------------------
const ids = (rows: Row[] | undefined) => (rows || []).map((r) => r.id).sort()

describe('FINSEC closeout — /api/closeiq tenant scope', () => {
  it('agent sees only own offers and buyers (200)', async () => {
    const o = await closeiq.GET(req('/api/closeiq?entity=offers', 'tok-agent-a1'))
    expect(o.status).toBe(200)
    expect(ids((await o.json()).offers)).toEqual(['offer-a1'])
    const b = await closeiq.GET(req('/api/closeiq?entity=buyers', 'tok-agent-a1'))
    expect(ids((await b.json()).buyers)).toEqual(['buyer-a1'])
  })

  it('broker sees own-tenant offers only, never another brokerage (RLS alone allowed it)', async () => {
    const res = await closeiq.GET(req('/api/closeiq?entity=offers', 'tok-broker-a'))
    expect(res.status).toBe(200)
    expect(ids((await res.json()).offers)).toEqual(['offer-a1', 'offer-a2'])
    const other = await closeiq.GET(req('/api/closeiq?entity=buyers', 'tok-broker-b'))
    expect(ids((await other.json()).buyers)).toEqual(['buyer-b1'])
  })

  it('broker cannot fetch a cross-tenant offer by id', async () => {
    const res = await closeiq.GET(req('/api/closeiq?entity=offers&id=offer-b1', 'tok-broker-a'))
    expect(res.status).not.toBe(200)
  })

  it('tenant-less broker → 403, no offers read', async () => {
    const res = await closeiq.GET(req('/api/closeiq?entity=offers', 'tok-tenantless-broker'))
    expect(res.status).toBe(403)
    expect(reads('offers')).toHaveLength(0)
  })

  it('submit_for_approval assigns a SAME-TENANT broker (was: first broker of any tenant)', async () => {
    // Put tenant B's broker first in the table — the old query took it.
    db.profiles = [db.profiles.find((p) => p.id === 'broker-b')!, ...db.profiles.filter((p) => p.id !== 'broker-b')]
    const res = await closeiq.POST(post('/api/closeiq', 'tok-agent-a1', { entity: 'submit_for_approval', offer_id: 'offer-a1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).approval.broker_id).toBe('broker-a')
    const brokerQuery = reads('profiles').find((q) => q.filters.some(([op, f]) => op === 'in' && f === 'role'))!
    expect(brokerQuery.filters).toContainEqual(['eq', 'tenant_id', A])
  })

  it("submit_for_approval on ANOTHER agent's offer → 404, no approval created", async () => {
    const res = await closeiq.POST(post('/api/closeiq', 'tok-agent-a1', { entity: 'submit_for_approval', offer_id: 'offer-a2' }))
    expect(res.status).toBe(404)
    expect(writes('offer_approvals')).toHaveLength(0)
    expect(db.offers.find((o) => o.id === 'offer-a2')!.status).toBe('draft')
  })

  it('PATCH: broker cannot edit a cross-tenant offer; same-tenant edit → 200', async () => {
    const cross = await closeiq.PATCH(patch('/api/closeiq', 'tok-broker-a', { entity: 'offer', data: { id: 'offer-b1', status: 'approved' } }))
    expect(cross.status).toBe(404)
    expect(db.offers.find((o) => o.id === 'offer-b1')!.status).toBe('draft')
    const same = await closeiq.PATCH(patch('/api/closeiq', 'tok-broker-a', { entity: 'offer', data: { id: 'offer-a2', status: 'approved' } }))
    expect(same.status).toBe(200)
  })

  it('PATCH: agent cannot edit another agent offer, and agent_id is not writable', async () => {
    const res = await closeiq.PATCH(patch('/api/closeiq', 'tok-agent-a1', { entity: 'offer', data: { id: 'offer-a2', status: 'x' } }))
    expect(res.status).toBe(404)
    await closeiq.PATCH(patch('/api/closeiq', 'tok-agent-a1', { entity: 'offer', data: { id: 'offer-a1', agent_id: 'agent-b1' } }))
    expect(db.offers.find((o) => o.id === 'offer-a1')!.agent_id).toBe('agent-a1')
  })

  it("offer create on a foreign brokerage's buyer → 404, nothing inserted", async () => {
    const res = await closeiq.POST(
      post('/api/closeiq', 'tok-broker-a', { entity: 'offer', data: { buyer_id: 'buyer-b1', offer_price: 1, property_address: 'x' } }),
    )
    expect(res.status).toBe(404)
    expect(writes('offers')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 3. Compliance review / transactions / scan, licenses, client intelligence.
// ---------------------------------------------------------------------------
describe('FINSEC closeout — compliance + licenses + client intelligence tenant scope', () => {
  it('review: agent role → 403 (role check preserved)', async () => {
    const res = await review.POST(post('/api/compliance/review', 'tok-agent-a1', { document_id: 'doc-a', action: 'approve' }))
    expect(res.status).toBe(403)
  })

  it('review: broker on a CROSS-tenant document → 404, document untouched', async () => {
    const res = await review.POST(post('/api/compliance/review', 'tok-broker-a', { document_id: 'doc-b', action: 'approve' }))
    expect(res.status).toBe(404)
    expect(writes('documents')).toHaveLength(0)
  })

  it('review: broker on a same-tenant document → 200 and verified', async () => {
    const res = await review.POST(post('/api/compliance/review', 'tok-broker-a', { document_id: 'doc-a', action: 'approve' }))
    expect(res.status).toBe(200)
    expect(db.documents.find((d) => d.id === 'doc-a')!.status).toBe('verified')
  })

  it('review: tenant-less broker → 403', async () => {
    const res = await review.POST(post('/api/compliance/review', 'tok-tenantless-broker', { document_id: 'doc-a', action: 'approve' }))
    expect(res.status).toBe(403)
  })

  it('compliance/transactions: agent own only; broker own tenant only; tenant-less broker 403', async () => {
    const agent = await complianceTx.GET(req('/api/compliance/transactions', 'tok-agent-a1'))
    expect(agent.status).toBe(200)
    expect(ids((await agent.json()).transactions)).toEqual(['tx-a1'])
    const broker = await complianceTx.GET(req('/api/compliance/transactions', 'tok-broker-b'))
    expect(ids((await broker.json()).transactions)).toEqual(['tx-b1'])
    const om = await complianceTx.GET(req('/api/compliance/transactions', 'tok-office-mgr'))
    expect(ids((await om.json()).transactions)).toEqual(['tx-a1'])
    expect((await complianceTx.GET(req('/api/compliance/transactions', 'tok-tenantless-broker'))).status).toBe(403)
  })

  it('compliance/scan: broker scanning a CROSS-tenant agent → 403, no documents read', async () => {
    const res = await scan.POST(post('/api/compliance/scan', 'tok-broker-a', { agent_id: 'agent-b1' }))
    expect(res.status).toBe(403)
    expect(reads('documents')).toHaveLength(0)
  })

  it('compliance/scan: agent scanning another agent → 403; broker same-tenant → 200', async () => {
    expect((await scan.POST(post('/api/compliance/scan', 'tok-agent-a1', { agent_id: 'agent-a2' }))).status).toBe(403)
    const ok = await scan.POST(post('/api/compliance/scan', 'tok-broker-a', { agent_id: 'agent-a1' }))
    expect(ok.status).toBe(200)
  })

  it('licenses GET: agent → 403 (the unused role read now applies)', async () => {
    expect((await licenses.GET(req('/api/licenses/check', 'tok-agent-a1'))).status).toBe(403)
  })

  it('licenses GET: broker → 200 with OWN-tenant agents only', async () => {
    const res = await licenses.GET(req('/api/licenses/check', 'tok-broker-b'))
    expect(res.status).toBe(200)
    expect(ids((await res.json()).agents)).toEqual(['agent-b1'])
  })

  it('licenses POST: an agent scans only themselves; another agent_id → 403', async () => {
    expect((await licenses.POST(post('/api/licenses/check', 'tok-agent-a1', { agent_id: 'agent-b1' }))).status).toBe(403)
    const res = await licenses.POST(post('/api/licenses/check', 'tok-agent-a1', {}))
    expect(res.status).toBe(200)
    expect((await res.json()).scanned).toBe(1)
  })

  it('licenses POST: broker scan is tenant-bounded (cross-tenant agent_id scans nothing)', async () => {
    const res = await licenses.POST(post('/api/licenses/check', 'tok-broker-a', { agent_id: 'agent-b1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).scanned).toBe(0)
  })

  it('client-intelligence list (cookie session): broker sees own tenant only; tenant-less → 403', async () => {
    cookieUserId = 'broker-a'
    const res = await clientIntel.GET(req('/api/broker/client-intelligence'))
    expect(res.status).toBe(200)
    expect(ids((await res.json()).data)).toEqual(['cp-a'])
    cookieUserId = 'tenantless-broker'
    expect((await clientIntel.GET(req('/api/broker/client-intelligence'))).status).toBe(403)
  })

  it('client-intelligence (cookie session): inactive account → 403 from the shared gate', async () => {
    cookieUserId = 'inactive-agent'
    const res = await clientIntel.GET(req('/api/broker/client-intelligence'))
    expect(res.status).toBe(403)
    expect(reads('client_profiles')).toHaveLength(0)
  })

  it('agent-view (cookie session): cross-tenant client profile → 404; own → 200', async () => {
    cookieUserId = 'broker-a'
    const cross = await agentView.GET(req('/x'), { params: Promise.resolve({ id: 'cp-b' }) })
    expect(cross.status).toBe(404)
    cookieUserId = 'agent-a1'
    const own = await agentView.GET(req('/x'), { params: Promise.resolve({ id: 'cp-a' }) })
    expect(own.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// 4. /api/pipeline — no invented 3% GCI; payable is net_commission.
// ---------------------------------------------------------------------------
import * as pipeline from '@/app/api/pipeline/route'

describe('FINSEC closeout (P1) — /api/pipeline figures', () => {
  it('no commission row → counted as pending, never a 3% estimate; payable is net_commission', async () => {
    const tx = (id: string) => ({
      id, agent_id: 'agent-a1', tenant_id: A, type: 'buyer', status: 'closed', deleted_at: null,
      property_address: `${id} St`, city: 'C', contract_price: 100000, closing_date: null, created_at: '2026-09-01T00:00:00Z',
    })
    db.transactions = [tx('tx-1'), tx('tx-2')]
    db.commissions = [
      { transaction_id: 'tx-1', gross_commission: 3000, net_commission: 2205.5, agent_amount: 2400, commission_status: 'calculated' },
    ]
    const res = await pipeline.GET(req('/api/pipeline', 'tok-agent-a1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Only the recorded $3,000 — the old route added 3% of $100,000 for tx-2.
    expect(body.totals.potentialGCI).toBe(3000)
    expect(body.totals.gciPendingCount).toBe(1)
    const cards = body.pipeline.flatMap((g: any) => g.stages.flatMap((s: any) => s.transactions))
    const byId = Object.fromEntries(cards.map((c: any) => [c.id, c]))
    expect(byId['tx-1'].payable).toBe(2205.5)
    expect(byId['tx-2'].payable).toBeNull()
    expect(byId['tx-2'].gci).toBeNull()
    expect(cards.every((c: any) => !('agent_amount' in c))).toBe(true)
  })
})
