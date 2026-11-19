/**
 * @jest-environment node
 *
 * R7d — the evidence forwarder passes a reimbursement case id through (Vault
 * re-checks it is the agent's own noticed case) and still never forwards
 * agent_id / tenant_id / storage fields.
 */
jest.mock('@/lib/vault-forward', () => ({ resolveAccessToken: async () => 'tok' }))
jest.mock('@/lib/security', () => ({ requireAuth: async () => ({ user: { id: 'u' } }) }))
jest.mock('@/lib/vault-client', () => ({ VAULT_API_URL: 'https://vault.test/api' }))
jest.mock('@/src/portal/profile/membership-flag', () => ({ membershipSectionEnabled: () => true }))

import { POST } from '../route'

const sent: Array<{ url: string; body: FormData }> = []
beforeEach(() => {
  sent.length = 0
  ;(global as any).fetch = jest.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, body: init.body as FormData })
    return { status: 201, json: async () => ({ ok: true, id: 'e1' }) }
  })
})

it('forwards kind + financial_item_id; never agent_id, tenant_id or storage fields', async () => {
  const fd = new FormData()
  fd.append('file', new Blob(['%PDF'], { type: 'application/pdf' }), 'paid.pdf')
  fd.append('kind', 'reimbursement_agent_response')
  fd.append('financial_item_id', 'n9')
  for (const k of ['agent_id', 'tenant_id', 'storage_path', 'sha256']) fd.append(k, 'x')
  const res = await POST({ formData: async () => fd, headers: { get: () => null } } as any)
  expect(res.status).toBe(201)
  expect(sent[0].url).toBe('https://vault.test/api/agent/membership-compliance/evidence')
  expect(sent[0].body.get('kind')).toBe('reimbursement_agent_response')
  expect(sent[0].body.get('financial_item_id')).toBe('n9')
  for (const k of ['agent_id', 'tenant_id', 'storage_path', 'sha256']) expect(sent[0].body.get(k)).toBeNull()
})
