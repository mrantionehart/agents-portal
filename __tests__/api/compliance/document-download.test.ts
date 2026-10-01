/**
 * @jest-environment node
 */
// ============================================================================
// SEC-COMPLIANCE-DOWNLOAD-1 · compliance/document/[id] · authorized retrieval
// ============================================================================
// The Portal could upload compliance documents but had no way to read them
// back: the bucket is private and nothing minted a signed URL. This route adds
// retrieval under exactly the rule that governs writing, so a document can be
// read by the people who could have written it and nobody else.
//
// Contract locked here:
//   1. OWNER of the transaction qualifies alone — no role term, no tenant term
//   2. STAFF ('broker','admin') additionally need a matching, non-null tenant
//   3. Everyone else is refused; anonymous never reaches the handler
//   4. A missing document and an unauthorized one are both 404/403 — the id
//      space is not enumerable
//   5. `file_path` must sit under the document's own transaction prefix, so a
//      tampered row cannot make this endpoint sign arbitrary bucket objects
//   6. Nothing is signed before authorization passes
// ============================================================================

type Profile = { id: string; role: string; tenant_id: string | null }
type Txn = { id: string; agent_id: string; tenant_id: string | null }
type Doc = { id: string; transaction_id: string | null; uploaded_by: string; file_path: string | null; name: string; original_filename: string; mime_type: string }

const TENANT_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const TENANT_B = 'bbbbbbbb-0000-4000-8000-000000000002'
const TX = 'tx-a'
const DOC_ID = 'doc-1'

let AUTHED: { id: string; email?: string } | null = null
let PROFILES: Profile[] = []
let TXN: Txn | null = null
let DOC: Doc | null = null
let signCalls: { path: string; ttl: number }[] = []

function project(row: any, select?: string) {
  const cols = String(select ?? '').split(',').map((c) => c.trim()).filter(Boolean)
  if (!cols.length) return { ...row }
  const out: any = {}
  for (const c of cols) out[c] = row[c]
  return out
}

function resolve(table: string, f: any) {
  if (table === 'documents') return { data: DOC && DOC.id === f.eq.id ? project(DOC, f.select) : null, error: null }
  if (table === 'transactions') return { data: TXN && TXN.id === f.eq.id ? project(TXN, f.select) : null, error: null }
  if (table === 'profiles') {
    const p = PROFILES.find((x) => x.id === f.eq.id) || null
    return { data: p ? project(p, f.select) : null, error: null }
  }
  throw new Error('unmocked table ' + table)
}

function builder(table: string) {
  const f: any = { eq: {}, is: {} }
  const self: any = {
    select: (s?: string) => { if (s !== undefined) f.select = s; return self },
    eq: (k: string, v: any) => { f.eq[k] = v; return self },
    is: (k: string, v: any) => { f.is[k] = v; return self },
    single: async () => resolve(table, f),
    maybeSingle: async () => resolve(table, f),
    then: (ok: any, err: any) => Promise.resolve(resolve(table, f)).then(ok, err),
  }
  return self
}

jest.mock('@/lib/security', () => ({
  requireAuth: jest.fn(async () => {
    if (!AUTHED) {
      return {
        response: new (require('next/server').NextResponse)(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        user: null,
      }
    }
    return { response: null, user: AUTHED }
  }),
  adminClient: jest.fn(() => ({
    from: (t: string) => builder(t),
    storage: {
      from: () => ({
        createSignedUrl: async (path: string, ttl: number) => {
          signCalls.push({ path, ttl })
          return { data: { signedUrl: 'https://signed.example/' + path + '?token=x' }, error: null }
        },
      }),
    },
  })),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('@/app/api/compliance/document/[id]/route')

const call = (id = DOC_ID) =>
  GET(new Request('https://portal.test/api/compliance/document/' + id) as any, { params: { id } })

const OWNER = 'owner-1', OTHER = 'other-1', BROKER_A = 'broker-a', ADMIN_A = 'admin-a', BROKER_B = 'broker-b', STAFFLESS = 'internal-1'

beforeEach(() => {
  jest.clearAllMocks()
  signCalls = []
  AUTHED = null
  PROFILES = [
    { id: OWNER, role: 'agent', tenant_id: TENANT_A },
    { id: OTHER, role: 'agent', tenant_id: TENANT_A },
    { id: BROKER_A, role: 'broker', tenant_id: TENANT_A },
    { id: ADMIN_A, role: 'admin', tenant_id: TENANT_A },
    { id: BROKER_B, role: 'broker', tenant_id: TENANT_B },
    { id: STAFFLESS, role: 'internal_staff', tenant_id: TENANT_A },
  ]
  TXN = { id: TX, agent_id: OWNER, tenant_id: TENANT_A }
  DOC = { id: DOC_ID, transaction_id: TX, uploaded_by: OWNER, file_path: `${TX}/listing_intake/1_disclosure.pdf`, name: 'Seller Disclosure', original_filename: 'disclosure.pdf', mime_type: 'application/pdf' }
})

describe('SEC-COMPLIANCE-DOWNLOAD-1 — permitted', () => {
  it.each([
    ['the transaction owner', OWNER],
    ['a same-tenant broker', BROKER_A],
    ['a same-tenant admin', ADMIN_A],
  ])('signs for %s', async (_who, id) => {
    AUTHED = { id }
    const res = await call()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('signed.example')
    expect(body.expires_in).toBe(300)
    expect(signCalls).toHaveLength(1)
    expect(signCalls[0].path).toBe(`${TX}/listing_intake/1_disclosure.pdf`)
  })

  it('permits an owner whose role is NOT "agent" (ownership, not role)', async () => {
    // The owner branch of the documents policy carries no role term. Without
    // this case, regressing `ownsTransaction` to `role === 'agent' && ...`
    // goes unnoticed, because every other owner fixture happens to be an agent.
    TXN = { ...(TXN as Txn), agent_id: STAFFLESS }
    AUTHED = { id: STAFFLESS }
    const res = await call()
    expect(res.status).toBe(200)
    expect(signCalls).toHaveLength(1)
  })

  it('permits an owner even when the transaction has no tenant (owner branch has no tenant term)', async () => {
    TXN = { ...(TXN as Txn), tenant_id: null }
    AUTHED = { id: OWNER }
    const res = await call()
    expect(res.status).toBe(200)
    expect(signCalls).toHaveLength(1)
  })
})

describe('SEC-COMPLIANCE-DOWNLOAD-1 — refused, and nothing is signed', () => {
  it('refuses anonymous', async () => {
    AUTHED = null
    const res = await call()
    expect(res.status).toBe(401)
    expect(signCalls).toEqual([])
  })

  it('refuses a non-owning agent in the same tenant', async () => {
    AUTHED = { id: OTHER }
    const res = await call()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(signCalls).toEqual([])
  })

  it('refuses a CROSS-TENANT broker', async () => {
    AUTHED = { id: BROKER_B }
    const res = await call()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(signCalls).toEqual([])
  })

  it('refuses a role outside the staff band that does not own the transaction', async () => {
    AUTHED = { id: STAFFLESS }
    const res = await call()
    expect(res.status).toBe(403)
    expect(signCalls).toEqual([])
  })

  it('fails closed on the STAFF branch when a tenant is missing', async () => {
    TXN = { ...(TXN as Txn), tenant_id: null }
    AUTHED = { id: BROKER_A }
    const res = await call()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ error: 'tenant_required' })
    expect(signCalls).toEqual([])
  })

  it('404s an unknown document without signing', async () => {
    DOC = null
    AUTHED = { id: BROKER_A }
    const res = await call('nope')
    expect(res.status).toBe(404)
    expect(signCalls).toEqual([])
  })

  it('refuses to sign a file_path outside its own transaction prefix', async () => {
    // A tampered or legacy row must not turn this endpoint into a generic
    // signer for the whole bucket.
    DOC = { ...(DOC as Doc), file_path: 'other-tx/secret/payroll.pdf' }
    AUTHED = { id: OWNER }
    const res = await call()
    expect(res.status).toBe(409)
    expect(signCalls).toEqual([])
  })
})

// This file declares top-level fixtures. Without an import/export TypeScript
// treats it as a global script, so two such suites collide on identical names.
export {}
