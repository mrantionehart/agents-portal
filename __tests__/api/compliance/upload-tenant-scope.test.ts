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
//   0. Authorization mirrors the DB's own INSERT policy on public.documents
//      ("Users can upload documents"), which has two independent branches:
//        · OWNER  — transactions.agent_id = auth.uid(). No role term and no
//          tenant term; owning the subject IS the scope. Qualifies alone.
//        · STAFF  — profiles.role IN ('broker','admin'). RLS would scope
//          this per row under a real session; this route runs on
//          adminClient (bypasses RLS) and reaches any transaction by id,
//          so tenant containment is required on THIS branch.
//      Being outside ('broker','admin') is NOT a categorical denial of a
//      role — any role still qualifies by owning the transaction.
//      The deal branch is inert here: this route never sets
//      documents.deal_id, so that EXISTS is false by construction. A guard
//      test below pins the insert payload so that stays true.
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
  is_active: boolean
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
// When set, every compliance_notifications insert resolves with this error,
// the way PostgREST reports one.
let NOTIF_INSERT_ERROR: { code: string; message: string } | null = null
let mailSends: { to: string }[] = []
// Records the filters the recipient fan-out query was actually built with,
// so dropping `.eq('tenant_id', …)` is detectable even if the fixture set
// happens to contain only in-tenant rows.
let recipientQueryFilters: { in: Record<string, any>; eq: Record<string, any> }[] = []
let consoleErrors: string[] = []

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
    if ('is_active' in f.eq) {
      rows = rows.filter((p) => p.is_active === f.eq.is_active)
    }
    for (const [k, v] of Object.entries(f.neq)) {
      rows = rows.filter((p) => (p as any)[k] !== v)
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
    if (f.insert) return { data: null, error: NOTIF_INSERT_ERROR }
    // Debounce probe ends `.limit(1).maybeSingle()`, so a miss is null —
    // NOT []. An empty array here would be truthy and silently debounce
    // every recipient, making the fan-out assertions vacuously pass.
    return { data: null, error: null }
  }
  throw new Error(`unmocked table: ${table}`)
}

function builder(table: string) {
  const f: any = { eq: {}, in: {}, is: {}, neq: {} }
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
    neq: (k: string, v: any) => { f.neq[k] = v; return self },
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
const INACTIVE_ADMIN_A = 'admin-a-inactive'
const NEWAGENT_A = 'newagent-a'
const NEWAGENT_A_OWNER = 'newagent-a-owner'
const STAFF_A = 'staff-a'
const OM_A = 'om-a'

beforeEach(() => {
  jest.clearAllMocks()
  storageUploads = []
  documentInserts = []
  documentUpdates = []
  notificationInserts = []
  mailSends = []
  recipientQueryFilters = []
  NOTIF_INSERT_ERROR = null
  consoleErrors = []
  jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
    consoleErrors.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  })

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
    { id: AGENT_A, email: 'agent.a@test', full_name: 'Agent A', role: 'agent', tenant_id: TENANT_A, is_active: true },
    { id: BROKER_A, email: 'broker.a@test', full_name: 'Broker A', role: 'broker', tenant_id: TENANT_A, is_active: true },
    { id: ADMIN_A, email: 'admin.a@test', full_name: 'Admin A', role: 'admin', tenant_id: TENANT_A, is_active: true },
    { id: BROKER_B, email: 'broker.b@test', full_name: 'Broker B', role: 'broker', tenant_id: TENANT_B, is_active: true },
    { id: ADMIN_B, email: 'admin.b@test', full_name: 'Admin B', role: 'admin', tenant_id: TENANT_B, is_active: true },
    { id: BROKER_NOTENANT, email: 'broker.nt@test', full_name: 'Broker NT', role: 'broker', tenant_id: null, is_active: true },
    { id: SUPERADMIN_B, email: PLATFORM_SUPER_ADMIN_EMAIL, full_name: 'Platform Super Admin', role: 'admin', tenant_id: TENANT_B, is_active: true },
    // Deactivated, same tenant, broker tier — must receive nothing.
    { id: INACTIVE_ADMIN_A, email: 'admin.a.off@test', full_name: 'Admin A (off)', role: 'admin', tenant_id: TENANT_A, is_active: false },
    // `new_agent` is a DEAL_OWNER_ROLE per app/api/transactions/create/route.ts.
    { id: NEWAGENT_A, email: 'newagent.a@test', full_name: 'New Agent A', role: 'new_agent', tenant_id: TENANT_A, is_active: true },
    { id: NEWAGENT_A_OWNER, email: 'newagent.owner@test', full_name: 'New Agent Owner', role: 'new_agent', tenant_id: TENANT_A, is_active: true },
    // `internal_staff` exists in production but is in no documented band.
    { id: STAFF_A, email: 'staff.a@test', full_name: 'Staff A', role: 'internal_staff', tenant_id: TENANT_A, is_active: true },
    { id: OM_A, email: 'om.a@test', full_name: 'Office Manager A', role: 'office_manager', tenant_id: TENANT_A, is_active: true },
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
      role: 'agent', tenant_id: TENANT_A, is_active: true,
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
    const byId = new Map(PROFILES.map((p) => [p.id, p]))
    // Active broker-tier recipients in the transaction's tenant, minus the
    // uploader. Derived, so the expectation cannot drift from the fixtures.
    const expectedIds = PROFILES.filter(
      (p) =>
        ['broker', 'admin'].includes(p.role) &&
        p.tenant_id === TENANT_A &&
        p.is_active &&
        p.id !== id,
    ).map((p) => p.id).sort()
    const expectedEmails = expectedIds.map((x) => byId.get(x)!.email as string).sort()

    expect(expectedIds.length).toBeGreaterThan(0)
    expect(notified).toEqual(expectedIds)
    expect(mailed).toEqual(expectedEmails)
    expect(notified.length).toBe(mailed.length)

    // Nobody foreign, tenant-less, deactivated, or the uploader themselves.
    for (const excluded of [BROKER_B, ADMIN_B, BROKER_NOTENANT, SUPERADMIN_B, INACTIVE_ADMIN_A, id]) {
      expect(notified).not.toContain(excluded)
    }
    for (const excludedEmail of ['broker.b@test', 'admin.b@test', 'broker.nt@test', PLATFORM_SUPER_ADMIN_EMAIL, 'admin.a.off@test']) {
      expect(mailed).not.toContain(excludedEmail)
    }
  })

  it('permits an owning new_agent (the policy owner branch, no role test)', async () => {
    TRANSACTION = { ...(TRANSACTION as TxFixture), agent_id: NEWAGENT_A_OWNER }
    AUTHED_USER = { id: NEWAGENT_A_OWNER, email: 'newagent.owner@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(200)
    expect(storageUploads).toHaveLength(1)
  })

  it('is non-vacuous: the same fixtures DO contain reachable foreign recipients', () => {
    const foreign = PROFILES.filter(
      (p) => ['broker', 'admin'].includes(p.role) && p.tenant_id !== TENANT_A,
    )
    // 3 in tenant B (incl. the super-admin) + 1 tenant-less.
    expect(foreign.length).toBeGreaterThanOrEqual(4)
  })
})

describe('SEC-COMPLIANCE-TENANT-1 — authorization matches the documents INSERT policy', () => {
  // Non-owners outside ('broker','admin') are denied, per the RLS policy.
  // `user_role` has 8 labels; these are the ones the policy does not name.
  // These roles are outside ('broker','admin'), so they have no STAFF-level
  // reach. They are not categorically denied — see the owner cases below.
  it.each([
    ['new_agent', NEWAGENT_A, 'newagent.a@test'],
    ['internal_staff', STAFF_A, 'staff.a@test'],
    ['office_manager', OM_A, 'om.a@test'],
  ])('gives a non-owning %s no staff-level reach, even in the transaction tenant', async (_r, id, email) => {
    AUTHED_USER = { id, email }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' })
    expectNoSideEffects()
  })

  // The owner branch has no role term, so every one of these qualifies by
  // ownership despite having no staff-level reach above. This is the
  // difference between "no staff access" and "categorically denied".
  it.each([
    ['new_agent', NEWAGENT_A, 'newagent.a@test'],
    ['internal_staff', STAFF_A, 'staff.a@test'],
    ['office_manager', OM_A, 'om.a@test'],
  ])('permits a %s that OWNS the transaction (ownership, not role)', async (_r, id, email) => {
    TRANSACTION = { ...(TRANSACTION as TxFixture), agent_id: id }
    AUTHED_USER = { id, email }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(200)
    expect(storageUploads).toHaveLength(1)
    expect(documentInserts).toHaveLength(1)
  })

  it('permits an OWNER whose own profile has no tenant_id', async () => {
    // The owner branch carries no tenant term. A caller with no tenant must
    // not be locked out of a transaction that is assigned to them.
    PROFILES.push({
      id: 'owner-no-tenant', email: 'owner.nt@test', full_name: 'Owner NT',
      role: 'agent', tenant_id: null, is_active: true,
    })
    TRANSACTION = { ...(TRANSACTION as TxFixture), agent_id: 'owner-no-tenant' }
    AUTHED_USER = { id: 'owner-no-tenant', email: 'owner.nt@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(200)
    expect(storageUploads).toHaveLength(1)
    // The transaction still has a tenant, so the fan-out is still scoped.
    expect(recipientQueryFilters[0].eq).toHaveProperty('tenant_id', TENANT_A)
  })

  it('permits an OWNER of a tenant-less transaction and fans out to NOBODY', async () => {
    TRANSACTION = { ...(TRANSACTION as TxFixture), agent_id: AGENT_A, tenant_id: null }
    AUTHED_USER = { id: AGENT_A, email: 'agent.a@test' }
    const res = await POST(uploadRequest('tx-a'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(storageUploads).toHaveLength(1)
    // No audience to scope to, so no audience at all — not everybody.
    expect(body.notifications.untenanted).toBe(true)
    expect(body.notifications.recipients).toBe(0)
    expect(recipientQueryFilters).toHaveLength(0)
    expect(notificationInserts).toEqual([])
    expect(mailSends).toEqual([])
  })

  it('still requires a tenant on the STAFF branch specifically', async () => {
    // Same tenant-less transaction, but the caller is staff rather than the
    // owner. Staff get no free pass: this must fail closed.
    TRANSACTION = { ...(TRANSACTION as TxFixture), tenant_id: null }
    AUTHED_USER = { id: BROKER_A, email: 'broker.a@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ error: 'tenant_required' })
    expectNoSideEffects()
  })

  it('writes no deal_id, which is what makes the policy deal branch inert here', async () => {
    // The documents INSERT policy also admits deal owners. That branch can
    // only fire when documents.deal_id is non-NULL. This route never sets
    // it, so the policy reduces to owner-or-staff for the rows written
    // here. If this assertion ever fails, the authorization above has to be
    // extended to deal owners before shipping.
    AUTHED_USER = { id: AGENT_A, email: 'agent.a@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(200)
    expect(documentInserts).toHaveLength(1)
    expect(Object.keys(documentInserts[0])).not.toContain('deal_id')
    expect(documentInserts[0].transaction_id).toBe('tx-a')
    expect(documentInserts[0].uploaded_by).toBe(AGENT_A)
  })

  it('excludes the uploader from their own fan-out', async () => {
    AUTHED_USER = { id: BROKER_A, email: 'broker.a@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(200)
    expect(notificationInserts.map((n) => n.recipient_id)).not.toContain(BROKER_A)
    expect(mailSends.map((m) => m.to)).not.toContain('broker.a@test')
    // but the other active same-tenant recipient still got it, so this is
    // exclusion of the actor rather than the fan-out being broken
    expect(notificationInserts.map((n) => n.recipient_id)).toContain(ADMIN_A)
  })

  it('excludes a deactivated same-tenant admin from both channels', async () => {
    AUTHED_USER = { id: AGENT_A, email: 'agent.a@test' }
    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(200)
    expect(notificationInserts.map((n) => n.recipient_id)).not.toContain(INACTIVE_ADMIN_A)
    expect(mailSends.map((m) => m.to)).not.toContain('admin.a.off@test')
    expect(notificationInserts.map((n) => n.recipient_id)).toContain(ADMIN_A)
  })
})

describe('SEC-COMPLIANCE-TENANT-1 — notification failures are surfaced, not swallowed', () => {
  it('reports a failing insert in the response and logs it, and still stores the document', async () => {
    NOTIF_INSERT_ERROR = { code: '42501', message: 'permission denied for table compliance_notifications' }
    AUTHED_USER = { id: AGENT_A, email: 'agent.a@test' }

    const res = await POST(uploadRequest('tx-a'))
    const body = await res.json()

    // The upload must not be lost because a notification broke.
    expect(res.status).toBe(200)
    expect(storageUploads).toHaveLength(1)
    expect(documentInserts).toHaveLength(1)

    // Every recipient's insert failed, and the response says so.
    expect(body.notifications.recipients).toBeGreaterThan(0)
    expect(body.notifications.insertFailed).toBe(body.notifications.recipients)
    expect(body.notifications.inserted).toBe(0)
    expect(body.notifications.failed).toBe(false)

    // And it was logged, with the driver's code, and WITHOUT identifiers.
    const logged = consoleErrors.filter((l) => l.includes('notification insert failed'))
    expect(logged).toHaveLength(body.notifications.recipients)
    expect(logged.join(' ')).toContain('42501')
    expect(logged.join(' ')).not.toContain('admin.a@test')
    expect(logged.join(' ')).not.toContain('1 Test St')
    expect(logged.join(' ')).not.toContain('Seller Disclosure')
  })

  it('reports successful inserts so the counts are not write-only', async () => {
    AUTHED_USER = { id: AGENT_A, email: 'agent.a@test' }
    const res = await POST(uploadRequest('tx-a'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.notifications.inserted).toBe(body.notifications.recipients)
    expect(body.notifications.insertFailed).toBe(0)
    expect(body.notifications.inserted).toBe(notificationInserts.length)
    expect(consoleErrors.filter((l) => l.includes('notification insert failed'))).toHaveLength(0)
  })

  it('logs a rejected mail send instead of discarding it', async () => {
    AUTHED_USER = { id: AGENT_A, email: 'agent.a@test' }
    global.fetch = jest.fn(async (url: any) => {
      if (String(url).includes('api.sendgrid.com')) return new Response('nope', { status: 500 })
      throw new Error('unexpected network call')
    }) as any

    const res = await POST(uploadRequest('tx-a'))
    expect(res.status).toBe(200)
    // Mail is dispatched without blocking, so let its handler run.
    await new Promise((r) => setImmediate(r))
    expect(consoleErrors.filter((l) => l.includes('notification mail rejected')).length).toBeGreaterThan(0)
  })
})
