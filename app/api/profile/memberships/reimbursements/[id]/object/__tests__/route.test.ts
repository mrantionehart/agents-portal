/**
 * @jest-environment node
 *
 * MDC-1 — the objection forwarder: auth first, dark by default, and only the
 * objection text reaches Vault.
 */
const proxyToVault = jest.fn(async () => ({ status: 200 }))
jest.mock('@/lib/vault-forward', () => ({ proxyToVault: (...a: unknown[]) => (proxyToVault as any)(...a) }))
let authed = true
jest.mock('@/lib/security', () => ({ requireAuth: async () => (authed ? { user: { id: 'u' } } : { response: { status: 401 } }) }))
let flag = true
jest.mock('@/src/portal/profile/membership-flag', () => ({ membershipSectionEnabled: () => flag }))

import { POST } from '../route'

const ID = '11111111-1111-4111-8111-111111111111'
const req = (body: unknown) => ({ json: async () => body, headers: { get: () => null } }) as any
const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => { authed = true; flag = true; proxyToVault.mockClear() })

it('401 without a session; 404 while dark; 400 for a bad id', async () => {
  authed = false
  expect((await POST(req({}), params(ID))).status).toBe(401)
  authed = true; flag = false
  expect((await POST(req({}), params(ID))).status).toBe(404)
  flag = true
  expect((await POST(req({}), params('x'))).status).toBe(400)
  expect(proxyToVault).not.toHaveBeenCalled()
})
it('forwards only the objection text', async () => {
  await POST(req({ objection: 'I paid it.', agent_id: 'other', determination: 'not_owed' }), params(ID))
  expect(proxyToVault).toHaveBeenCalledWith(expect.anything(), 'POST', `/agent/membership-compliance/reimbursements/${ID}/object`, { objection: 'I paid it.' })
})
