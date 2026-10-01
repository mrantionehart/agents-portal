/**
 * @jest-environment node
 */
// ============================================================================
// SEC-COMPLIANCE-TENANT-1 · compliance/upload · cross-tenant isolation
// ============================================================================
// Before the fix, POST /api/compliance/upload checked transaction ownership
// for role === 'agent' only. Every other permitted role (broker, admin, and
// anything else `profiles.role` can hold) reached the storage write with no
// scope check at all, and the broker/admin notification fan-out selected
// every matching profile with no tenant filter.
//
// This suite locks the tenant-scope contract:
//
//   1. Access is contained to one tenant for EVERY permitted role, not just
//      agents — a broker/admin in tenant B cannot touch a tenant-A txn
//   2. The existing agent ownership check is NOT weakened
//   3. Caller with tenant_id = NULL → fails closed (403 tenant_required)
//   4. Transaction with tenant_id = NULL → fails closed (403 tenant_required)
//   5. Platform-super-admin (mrhart@hartfeltmg.com) does NOT gain
//      cross-tenant access — same contract as P0-41 on calendar/events
//   6. A refused request produces ZERO side effects on every channel:
//      storage object, documents row, compliance_notifications row, mail
//   7. On an allowed upload the recipient set is derived from the
//      TRANSACTION's tenant, and the in-app channel and the mail channel
//      agree exactly — asserted as one agreement, not two expectations, so
//      a mutant that drops the filter from only one channel still fails
//   8. Recipients with tenant_id = NULL are excluded
//
// Fixtures are in-memory only. No database, no storage, no network.
// ============================================================================

type ProfileFixture = {
  id: string
  email: string | null
  full_name: string | null
  role: string
  tenant_id: string | null
}

type TxFixture = {
  id: string
  agent_id: string
  tenant_id: string | null
  type: string
  property_address: string
}

const TENANT_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const TENANT_B = 'bbbbbbbb-0000-4000-8000-000000000002'
const PLATFORM_SUPER_ADMIN_EMAIL = 'mrhart@hartfeltmg.com'

let AUTHED_USER: { id: string; email?: string } | null = null
let PROFILES: ProfileFixture[] = []
let TRANSACTION: TxFixture | null = null

// ── Side-effect pins. Every channel the route can write to. ───────────────
let storageUploads: { bucket: string; path: string }[] = []
let documentInserts: any[] = []
let documentUpdates: any[] = []
let notificationInserts: any[] = []
let mailSends: { to: string }[] = []
// Records the filters the recipient fan-out query was actually built with,
// so dropping `.eq('tenant_id', …)` is detectable even if the fixture set
// happens to contain only in-tenant rows.
let recipientQueryFilters: { in: Record<string, any>; eq: Record<string, any> }[] = []

// Honour the select projection the way PostgREST does: a column that was
// not asked for is simply ABSENT from the returned row. Without this the
// mock hands back whole fixtures and a mutant that drops `tenant_id` from
// a `.select()` list survives, because the route still finds the value.
function project(row: any, select?: string) {
  const cols = String(select ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  if (!cols.length) return { ...row }
  const out: any = {}
  for (const c of cols) out[c] = row[c]
  return out
}

function resolveProfiles(f: any) {
  // The recipient fan-out is the only `profiles` read that filters on role;
  // every other one is a single-row lookup by id.
  if (f.in.role) {
    recipientQueryFilters.push({ in: { ...f.in }, eq: { ...f.eq } })
    let rows = PROFILES.filter((p) => f.in.role.includes(p.role))
    // Mirror PostgREST equality: NULL never equals a value.
    if ('tenant_id' in f.eq) {
      rows = rows.filter((p) => p.tenant_id !== null && p.tenant_id === f.eq.tenant_id)
    }
    return { data: rows.map((p) => project(p, f.select)), error: null }
  }
  const row = PROFILES.find((p) => p.id === f.eq.id) || null
  return { data: row ? project(row, f.select) : null, error: null }
}

function resolveTable(table: string, f: any): any {
  if (table === 'profiles') return resolveProfiles(f)
  if (table === 'transactions') {
    if (!TRANSACTION || TRANSACTION.id !== f.eq.id) return { data: null, error: null }
    return { data: project(TRANSACTION, f.select), error: null }
  }
  if (table === 'documents') {
    if (f.insert) return { data: { id: 'doc-1', ...f.insert }, error: null }
    if (f.update) return { data: null, error: null }
    return { data: null, error: null } // no prior same-label document
  }
  if (table === 'compliance_notifications') {
    if (f.insert) return { data: null, error: null }
    // Debounce probe ends `.limit(1).maybeSingle()`, so a miss is null —
    // NOT []. An empty array here would be truthy and silently debounce
    // every recipient, making the fan-out assertions vacuously pass.
    return { data: null, error: null }
  }
  throw new Error(`unmocked table: ${table}`)
}

function builder(table: string) {
  const f: any = { eq: {}, in: {}, is: {} }
  const self: any = {
    select: (s?: string) => { if (s !== undefined) f.select = s; return self },
    insert: (v: any) => {
      f.insert = v
      if (table === 'documents') documentInserts.push(v)
      if (table === 'compliance_notifications') notificationInserts.push(v)
      return self
    },
    update: (v: any) => { f.update = v; if (table === 'documents') documentUpdates.push(v); return self },
    eq: (k: string, v: any) => { f.eq[k] = v; return self },
    in: (k: string, v: any) => { f.in[k] = v; return self },
    is: (k: string, v: any) => { f.is[k] = v; return self },
    ilike: (k: string, v: any) => { f.ilike = [k, v]; return self },
    gte: (k: string, v: any) => { f.gte = [k, v]; return self },
    order: () => self,
    limit: () => self,
    single: async () => resolveTable(table, f),
    maybeSingle: async () => resolveTable(table, f),
    then: (ok: any, err: any) => Promise.resolve(resolveTable(table, f)).then(ok, err),
  }
  return self
}

jest.mock('@/lib/security', () => ({
  requireAuth: jest.fn(async () => {
    if (!AUTHED_USER) {
      return {
        response: new (require('next/server').NextResponse)(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401 },
        ),
        user: null,
      }
    }
    return { response: null, user: AUTHED_USER }
  }),
  requireRateLimit: jest.fn(async () => ({ response: null })),
  adminClient: jest.fn(() => ({
    from: (table: string) => builder(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          storageUploads.push({ bucket, path })
          return { data: { path }, error: null }
        },
      }),
    },
  })),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('@/app/api/compliance/upload/route')

function pdfFile() {
  // Valid %PDF magic so the server-side signature check passes.
  const bytes = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.alloc(64, 0x20),
  ])
  return new File([bytes], 'disclosure.pdf', { type: 'application/pdf' })
}

function uploadRequest(transactionId: string) {
  const fd = new FormData()
  fd.set('file', pdfFile())
  fd.set('transaction_id', transactionId)
  fd.set('doc_label', 'Seller Disclosure')
  fd.set('folder', 'listing_intake')
  return new Request('https://portal.test/api/compliance/upload', {
    method: 'POST',
    body: fd,
  }) as any
}

function expectNoSideEffects() {
  expect(storageUploads).toEqual([])
  expect(documentInserts).toEqual([])
  expect(documentUpdates).toEqual([])
  expect(notificationInserts).toEqual([])
  expect(mailSends).toEqual([])
}

const AGENT_A = 'agent-a'
const BROKER_A = 'broker-a'
const ADMIN_A = 'admin-a'
const BROKER_B = 'broker-b'
const ADMIN_B = 'admin-b'
const BROKER_NOTENANT = 'broker-nt'
const SUPERADMIN_B = 'superadmin-b'

beforeEach(() => {
  jest.clearAllMocks()
  storageUploads = []
  documentInserts = []
  documentUpdates = []
  notificationInserts = []
  mailSends = []
  recipientQueryFilters = []

  process.env.SENDGRID_API_KEY = 'SG.test-key-not-real'
  process.env.SENDGRID_FROM_EMAIL = 'noreply@portal.test'

  global.fetch = jest.fn(async (url: any, init: any) => {
    if (String(url).includes('api.sendgrid.com')) {
      const body = JSON.parse(String(init?.body ?? '{}'))
      for (const p of body.personalizations ?? []) {
        for (const t of p.to ?? []) mailSends.push({ to: t.email })
      }
      return new Response('', { status: 202 })
    }
    throw new Error(`unexpected network call: ${String(url)}`)
  }) as any

  PROFILES = [
    { id: AGENT_A, email: 'agent.a@test', full_name: 'Agent A', role: 'agent', tenant_id: TENANT_A },
    { id: BROKER_A, email: 'broker.a@test', full_name: 'Broker A', role: 'broker', tenant_id: TENANT_A },
    { id: ADMIN_A, email: 'admin.a@test', full_name: 'Admin A', role: 'admin', tenant_id: TENANT_A },
    { id: BROKER_B, email: 'broker.b@test', full_name: 'Broker B', role: 'broker', tenant_id: TENANT_B },
    { id: ADMIN_B, email: 'admin.b@test', full_name: 'Admin B', role: 'admin', tenant_id: TENANT_B },
    { id: BROKER_NOTENANT, email: 'broker.nt@test', full_name: 'Broker NT', role: 'broker', tenant_id: null },
    { id: SUPERADMIN_B, email: PLATFORM_SUPER_ADMIN_EMAIL, full_name: 'Platform Super Admin', role: 'admin', tenant_id: TENANT_B },
  ]

  TRANSACTION = {
    id: 'tx-a',
    agent_id: AGENT_A,
    tenant_id: TENANT_A,
    type: 'listing',
    property_address: '1 Test St',
  }
})

describe('SEC-COMPLIANCE-TENANT-1 — refusal across tenants, every role', () => {
  it.each([
    ['broker', BROKER_B],
    ['admin', ADMIN_B],
  ])('refuses a %s whose tenant differs from the transaction, with no side effects', async (_role, id) => {
    AUTHED_USER = { id, email: 'x@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' })
    expectNoSideEffects()
  })

  it('does not widen access for the platform super-admin', async () => {
    AUTHED_USER = { id: SUPERADMIN_B, email: PLATFORM_SUPER_ADMIN_EMAIL }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(403)
    expectNoSideEffects()
  })

  it('fails closed when the caller has no tenant', async () => {
    AUTHED_USER = { id: BROKER_NOTENANT, email: 'broker.nt@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ error: 'tenant_required' })
    expectNoSideEffects()
  })

  it('fails closed when the transaction has no tenant', async () => {
    TRANSACTION = { ...(TRANSACTION as TxFixture), tenant_id: null }
    AUTHED_USER = { id: BROKER_A, email: 'broker.a@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ error: 'tenant_required' })
    expectNoSideEffects()
  })

  it('still refuses an agent who does not own the transaction (pre-existing check intact)', async () => {
    PROFILES.push({
      id: 'agent-a2', email: 'agent.a2@test', full_name: 'Agent A2',
      role: 'agent', tenant_id: TENANT_A,
    })
    AUTHED_USER = { id: 'agent-a2', email: 'agent.a2@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' })
    expectNoSideEffects()
  })
})

describe('SEC-COMPLIANCE-TENANT-1 — allowed upload stays inside the tenant', () => {
  it.each([
    ['the owning agent', AGENT_A],
    ['a same-tenant broker', BROKER_A],
  ])('permits %s and scopes every notification channel to the transaction tenant', async (_who, id) => {
    AUTHED_USER = { id, email: 'who@test' }
    const res = await POST(uploadRequest('tx-a'))

    expect(res.status).toBe(200)
    expect(storageUploads).toHaveLength(1)
    expect(documentInserts).toHaveLength(1)

    // The fan-out query must carry the tenant filter itself — this is what
    // kills a mutant that removes `.eq('tenant_id', …)`.
    expect(recipientQueryFilters).toHaveLength(1)
    expect(recipientQueryFilters[0].eq).toHaveProperty('tenant_id', TENANT_A)
    expect(recipientQueryFilters[0].in.role).toEqual(['broker', 'admin'])

    // Agreement: the in-app channel and the mail channel reach exactly the
    // same people, and that set is exactly tenant A's brokers/admins.
    const notified = [...new Set(notificationInserts.map((n) => n.recipient_id))].sort()
    const mailed = [...new Set(mailSends.map((m) => m.to))].sort()
    const expectedIds = [BROKER_A, ADMIN_A].sort()
    const expectedEmails = ['broker.a@test', 'admin.a@test'].sort()

    expect(notified).toEqual(expectedIds)
    expect(mailed).toEqual(expectedEmails)
    expect(notified.length).toBe(mailed.length)

    // And nobody foreign or tenant-less appears in either channel.
    for (const foreign of [BROKER_B, ADMIN_B, BROKER_NOTENANT, SUPERADMIN_B]) {
      expect(notified).not.toContain(foreign)
    }
    for (const foreignEmail of ['broker.b@test', 'admin.b@test', 'broker.nt@test', PLATFORM_SUPER_ADMIN_EMAIL]) {
      expect(mailed).not.toContain(foreignEmail)
    }
  })

  it('is non-vacuous: the same fixtures DO contain reachable foreign recipients', () => {
    const foreign = PROFILES.filter(
      (p) => ['broker', 'admin'].includes(p.role) && p.tenant_id !== TENANT_A,
    )
    // 3 in tenant B (incl. the super-admin) + 1 tenant-less.
    expect(foreign.length).toBeGreaterThanOrEqual(4)
  })
})
