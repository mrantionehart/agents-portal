/**
 * @jest-environment node
 */
// ============================================================================
// HARTFELT-P8.1A · GET /api/vault/leads
// ============================================================================
// A proxy is easy to get subtly wrong in ways that still return 200, so what is
// asserted here is the REQUEST IT MAKES: the URL, the pinned `assigned=mine`,
// which params it is willing to forward, and that the caller's bearer token is
// the only authority it passes on.
// ============================================================================

jest.mock('@/lib/vault-client', () => ({ VAULT_API_URL: 'https://vault.test/api' }))

// `withAuth` is the gate. Here it is reduced to the one decision these tests
// are about — authenticated or not — so the assertions stay on the REQUEST the
// proxy makes. Whether the wrapper itself authenticates correctly is
// lib/security's own suite's job, not this file's.
let AUTHED = true
jest.mock('@/lib/security', () => ({
  withAuth:
    (handler: (req: Request, ctx: { user: { id: string } }) => Promise<Response>) =>
    async (req: Request) =>
      AUTHED
        ? handler(req, { user: { id: 'agent-1' } })
        : new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
}))

import { GET } from '../route'

const call = (qs = '', headers: Record<string, string> = { authorization: 'Bearer agent-token' }) =>
  GET(new Request(`http://localhost/api/vault/leads${qs ? `?${qs}` : ''}`, { headers }) as never)

const lastFetch = () => (global.fetch as jest.Mock).mock.calls.at(-1)!
const lastUrl = () => new URL(lastFetch()[0] as string)

beforeEach(() => {
  AUTHED = true
  global.fetch = jest.fn(async () => ({
    status: 200,
    json: async () => ({ data: [], lead_count: 0, page: { has_more: false } }),
  })) as unknown as typeof fetch
})

describe('[P81A-PX] the request it forwards', () => {
  it('[P81A-PX1] 🔑 pins assigned=mine — the agent cannot ask for anyone else', async () => {
    await call()
    expect(lastUrl().pathname).toBe('/api/client-intelligence')
    expect(lastUrl().searchParams.get('assigned')).toBe('mine')
  })

  it('[P81A-PX2] 🔒 a caller-supplied assigned= cannot override it', async () => {
    await call('assigned=all')
    expect(lastUrl().searchParams.get('assigned')).toBe('mine')
  })

  it('[P81A-PX3] 🔒 forwards the caller bearer token and no other authority', async () => {
    await call()
    const headers = lastFetch()[1]!.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer agent-token')
    const names = Object.keys(headers).map((h) => h.toLowerCase())
    // Nothing Vault would read as an identity of its own.
    expect(names).not.toContain('x-user-id')
    expect(names).not.toContain('x-user-role')
    expect(names).not.toContain('apikey')
    expect(JSON.stringify(headers)).not.toMatch(/service_role|SUPABASE_SERVICE/i)
  })

  it('[P81A-PX4] unauthenticated → 401, and Vault is never called', async () => {
    AUTHED = false
    const res = await call('', {})
    expect(res.status).toBe(401)
    expect(global.fetch as jest.Mock).not.toHaveBeenCalled()
  })

  it('[P81A-PX5] forwards the page/search knobs', async () => {
    await call('search=nad&status=new&type=buyer&limit=25&offset=50')
    const p = lastUrl().searchParams
    expect(p.get('search')).toBe('nad')
    expect(p.get('status')).toBe('new')
    expect(p.get('type')).toBe('buyer')
    expect(p.get('limit')).toBe('25')
    expect(p.get('offset')).toBe('50')
  })

  it('[P81A-PX6] 🔒 and forwards NOTHING else — an unlisted param is dropped', async () => {
    await call('tenant_id=00000000-0000-4000-8000-000000000000&band=review&agents=true')
    const p = lastUrl().searchParams
    expect(p.get('tenant_id')).toBeNull()
    expect(p.get('band')).toBeNull()
    expect(p.get('agents')).toBeNull()
  })
})

describe('[P81A-PE] failure is not emptiness', () => {
  it('[P81A-PE1] 🔒 an unreadable body is a 502, not an empty lead list', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      json: async () => { throw new Error('not json') },
    })) as unknown as typeof fetch
    const res = await call()
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe('vault_leads_unreadable')
    expect(body.data).toBeUndefined()
  })

  it('[P81A-PE2] 🔒 an unreachable Vault is a 502, not an empty lead list', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    const res = await call()
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('vault_leads_unreachable')
  })

  it("[P81A-PE3] passes Vault's own status through rather than flattening it", async () => {
    global.fetch = jest.fn(async () => ({
      status: 500,
      json: async () => ({ error: 'Leads could not be read.', code: 'assigned_leads_query_failed' }),
    })) as unknown as typeof fetch
    const res = await call()
    expect(res.status).toBe(500)
    expect((await res.json()).code).toBe('assigned_leads_query_failed')
  })
})
