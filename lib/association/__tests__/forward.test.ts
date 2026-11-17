/**
 * @jest-environment node
 */
// The association forwarder adds no authority: it sends exactly the caller's
// bearer and body to Vault and passes Vault's status through.
import { NextRequest } from 'next/server'
import { forwardToVault } from '../forward'

jest.mock('@/lib/vault-client', () => ({ VAULT_API_URL: 'https://vault.test/api' }))

describe('forwardToVault', () => {
  const fetchMock = jest.fn()
  beforeEach(() => { fetchMock.mockReset(); (global as unknown as { fetch: unknown }).fetch = fetchMock })

  it('forwards the bearer, query and body unchanged and passes the status through', async () => {
    fetchMock.mockResolvedValue({ status: 403, json: async () => ({ refusal: 'not_broker_of_record' }) })
    const r = new NextRequest('https://ap.test/api/association/elections?agent_id=x', {
      method: 'POST', headers: { authorization: 'Bearer agent-jwt' }, body: '{"action":"determine"}',
    })
    const res = await forwardToVault(r, '/association/elections', 'POST')
    expect(res.status).toBe(403)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://vault.test/api/association/elections')
    expect(init.headers).toEqual({ Authorization: 'Bearer agent-jwt', 'Content-Type': 'application/json' })
    expect(init.body).toBe('{"action":"determine"}')
    const g = new NextRequest('https://ap.test/api/association/elections?agent_id=x', { headers: { authorization: 'Bearer t' } })
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({}) })
    await forwardToVault(g, '/association/elections', 'GET')
    expect(fetchMock.mock.calls[1][0]).toBe('https://vault.test/api/association/elections?agent_id=x')
  })
  it('an unreadable or unreachable Vault is a 502, never a success', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => { throw new Error('x') } })
    expect((await forwardToVault(new NextRequest('https://ap.test/x'), '/association/elections', 'GET')).status).toBe(502)
    fetchMock.mockRejectedValue(new Error('down'))
    expect((await forwardToVault(new NextRequest('https://ap.test/x'), '/association/elections', 'GET')).status).toBe(502)
  })
})
