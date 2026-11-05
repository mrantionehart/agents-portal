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

import { GET } from '../route'

const call = () =>
  GET(new Request('http://localhost/api/policies/required', { headers: { authorization: 'Bearer tok' } }) as never)
let reply: { status: number; json: () => Promise<unknown> }
beforeEach(() => {
  AUTHED = true
  reply = { status: 200, json: async () => ({ required: [] }) }
  global.fetch = jest.fn(async () => reply) as unknown as typeof fetch
})
const lastFetch = () => (global.fetch as jest.Mock).mock.calls.at(-1)!

describe('[A4-FW-R] GET /api/policies/required forwarder', () => {
  it('[A4-FW-R1] forwards only the bearer to Vault, no-store', async () => {
    await call()
    expect(lastFetch()[0]).toBe('https://vault.test/api/policies/required')
    const init = lastFetch()[1]
    expect(init.headers).toEqual({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' })
    expect(init.cache).toBe('no-store')
  })

  it('[A4-FW-R2] a 503 stays a 503 with its body', async () => {
    reply = { status: 503, json: async () => ({ required: null, failClosed: true }) }
    const res = await call()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ required: null, failClosed: true })
  })

  it('[A4-FW-R3] an unreadable Vault body is 502 failClosed, never required:[]', async () => {
    reply = { status: 200, json: async () => { throw new Error('x') } }
    const res = await call()
    expect(res.status).toBe(502)
    expect((await res.json()).required).toBeNull()
  })

  it('[A4-FW-R4] Vault unreachable → 502 failClosed', async () => {
    global.fetch = jest.fn(async () => { throw new Error('down') }) as unknown as typeof fetch
    const res = await call()
    expect(res.status).toBe(502)
    expect((await res.json()).failClosed).toBe(true)
  })

  it('[A4-FW-R5] unauthenticated → 401 and Vault is not called', async () => {
    AUTHED = false
    expect((await call()).status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
