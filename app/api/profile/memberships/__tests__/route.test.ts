/**
 * @jest-environment node
 *
 * MDC-1 — Agent Portal membership forwarders: auth first, flag-dark, and only
 * allowlisted declaration fields ever reach Vault (never agent_id / tenant_id
 * / verified fields).
 */
const proxyToVault = jest.fn(async () => ({ status: 200 }))
jest.mock('@/lib/vault-forward', () => ({ proxyToVault: (...a: unknown[]) => (proxyToVault as any)(...a), resolveAccessToken: async () => 'tok' }))
let authed = true
jest.mock('@/lib/security', () => ({
  requireAuth: async () => (authed ? { user: { id: 'u' } } : { response: { status: 401 } }),
}))
let flag = true
jest.mock('@/src/portal/profile/membership-flag', () => ({ membershipSectionEnabled: () => flag }))

import { GET, POST } from '../route'

const req = (body?: unknown) => ({ json: async () => body, headers: { get: () => null } }) as any

beforeEach(() => {
  authed = true
  flag = true
  proxyToVault.mockClear()
})

describe('/api/profile/memberships', () => {
  it('401 without a session; Vault is never called', async () => {
    authed = false
    expect((await GET(req())).status).toBe(401)
    expect((await POST(req({ kind: 'membership' }))).status).toBe(401)
    expect(proxyToVault).not.toHaveBeenCalled()
  })
  it('404 while dark', async () => {
    flag = false
    expect((await GET(req())).status).toBe(404)
    expect(proxyToVault).not.toHaveBeenCalled()
  })
  it('GET forwards to the Vault agent endpoint', async () => {
    await GET(req())
    expect(proxyToVault).toHaveBeenCalledWith(expect.anything(), 'GET', '/agent/membership-compliance')
  })
  it('membership POST forwards only declaration fields', async () => {
    await POST(req({ kind: 'membership', declared_status: 'nonmember', agent_id: 'x', tenant_id: 'y', verified_status: 'active', record_state: 'verified', renewal_date_verified: true }))
    expect(proxyToVault).toHaveBeenCalledWith(expect.anything(), 'POST', '/agent/membership-compliance/memberships', { declared_status: 'nonmember' })
  })
  it('MLS POST forwards only MLS fields', async () => {
    await POST(req({ kind: 'mls', mls_provider: 'Synthetic MLS', eligibility_status: 'eligible', agent_id: 'x' }))
    expect(proxyToVault).toHaveBeenCalledWith(expect.anything(), 'POST', '/agent/membership-compliance/mls', { mls_provider: 'Synthetic MLS' })
  })
  it('unknown kind is refused', async () => {
    expect((await POST(req({ kind: 'financial_item' }))).status).toBe(400)
    expect(proxyToVault).not.toHaveBeenCalled()
  })
})
