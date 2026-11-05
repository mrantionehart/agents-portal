/**
 * @jest-environment node
 */
jest.mock('@/lib/vault-client', () => ({ VAULT_API_URL: 'https://vault.test/api' }))
let AUTHED = true
jest.mock('@/lib/security', () => ({
  withAuth:
    (handler: (req: Request, ctx: unknown) => Promise<Response>) =>
    async (req: Request) =>
      AUTHED ? handler(req, { user: { id: 'u1' } }) : new Response('{}', { status: 401 }),
}))

import { POST } from '../route'

const SHA = 'AbCdEf0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
const call = (body: unknown) =>
  POST(
    new Request('http://localhost/api/policies/accept', {
      method: 'POST',
      headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
  )
let reply: { status: number; json: () => Promise<unknown> }
beforeEach(() => {
  AUTHED = true
  reply = { status: 201, json: async () => ({ ok: true }) }
  global.fetch = jest.fn(async () => reply) as unknown as typeof fetch
})
const lastFetch = () => (global.fetch as jest.Mock).mock.calls.at(-1)!

describe('[A4-FW-A] POST /api/policies/accept forwarder', () => {
  it('[A4-FW-A1] forwards only the contract keys, client pinned to agent_portal, hash untouched', async () => {
    await call({
      policy_version_id: 'pv-1', document_sha256: SHA, sections: ['s1'],
      client: 'vault', tenant_id: 't-evil', user_id: 'someone-else', accepted_at: '2020-01-01',
    })
    expect(lastFetch()[0]).toBe('https://vault.test/api/policies/accept')
    const init = lastFetch()[1]
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({
      policy_version_id: 'pv-1', document_sha256: SHA, client: 'agent_portal', sections: ['s1'],
    })
  })

  it('[A4-FW-A2] omits sections when absent', async () => {
    await call({ policy_version_id: 'pv-1', document_sha256: SHA })
    expect(JSON.parse(lastFetch()[1].body)).toEqual({ policy_version_id: 'pv-1', document_sha256: SHA, client: 'agent_portal' })
  })

  it.each([
    [409, { ok: false, refusal: 'stale_document' }],
    [403, { ok: false, refusal: 'not_in_audience' }],
    [404, { ok: false }],
    [200, { ok: true, already: true }],
  ])('[A4-FW-A3] passes Vault status %s and body through', async (status, body) => {
    reply = { status, json: async () => body }
    const res = await call({ policy_version_id: 'pv-1', document_sha256: SHA })
    expect(res.status).toBe(status)
    expect(await res.json()).toEqual(body)
  })

  it.each([
    ['not json', '{nope'],
    ['missing hash', { policy_version_id: 'pv-1' }],
    ['non-string sections', { policy_version_id: 'pv-1', document_sha256: SHA, sections: [1] }],
    ['array body', [1]],
  ])('[A4-FW-A4] %s → 400, Vault not called', async (_n, body) => {
    const res = await call(body)
    expect(res.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('[A4-FW-A5] unreadable Vault body → 502 ok:false', async () => {
    reply = { status: 201, json: async () => { throw new Error('x') } }
    const res = await call({ policy_version_id: 'pv-1', document_sha256: SHA })
    expect(res.status).toBe(502)
    expect((await res.json()).ok).toBe(false)
  })

  it('[A4-FW-A6] unauthenticated → 401 and Vault is not called', async () => {
    AUTHED = false
    expect((await call({ policy_version_id: 'pv-1', document_sha256: SHA })).status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
