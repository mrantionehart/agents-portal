/**
 * @jest-environment node
 */
// ============================================================================
// Slice 2 Phase 3B-4 · AP composer proxy tests
// ============================================================================
// Covers the 3 AP proxy routes:
//   * GET  /api/signing/transactions/[id]/documents
//   * POST /api/signing/transactions/[id]/packages/compose-preview
//   * POST /api/signing/transactions/[id]/packages
//
// Asserts:
//   * requireAuth gate — unauth returns 401 without touching Vault
//   * AP_SIGNING_COMPOSER_ENABLED gate — flag OFF returns 404, no leak
//   * flag ON + authenticated → forwards to Vault via proxyToVault
//   * URL-encoded transactionId
//   * exact Vault path per route
// ============================================================================
import { NextResponse } from 'next/server'

let flagEnabled = true

jest.mock('@/lib/vault-forward', () => ({
  proxyToVault: jest.fn(async () => NextResponse.json({ ok: true }, { status: 200 })),
}))
jest.mock('@/lib/security', () => ({
  requireAuth: jest.fn(async () => ({ user: { id: 'agent-1' } })),
}))
jest.mock('@/lib/signing/composer-flag', () => ({
  isSigningComposerEnabled: () => flagEnabled,
}))

import { GET as documentsGet } from '@/app/api/signing/transactions/[transactionId]/documents/route'
import { POST as previewPost } from '@/app/api/signing/transactions/[transactionId]/packages/compose-preview/route'
import { POST as submitPost } from '@/app/api/signing/transactions/[transactionId]/packages/route'
import { proxyToVault } from '@/lib/vault-forward'
import { requireAuth } from '@/lib/security'

const pv = proxyToVault as jest.Mock
const ra = requireAuth as jest.Mock

const TXN = '00000000-0000-4000-8000-000000000001'

function req(body?: unknown): any {
  return {
    headers: { get: () => null },
    json: async () => body,
  }
}
const params = () => ({ params: Promise.resolve({ transactionId: TXN }) })

beforeEach(() => {
  pv.mockClear()
  ra.mockReset()
  ra.mockResolvedValue({ user: { id: 'agent-1' } })
  flagEnabled = true
})

describe('GET /api/signing/transactions/[id]/documents', () => {
  it('unauth → 401, no Vault call', async () => {
    ra.mockResolvedValueOnce({ response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) })
    const res = await documentsGet(req(), params())
    expect((res as Response).status).toBe(401)
    expect(pv).not.toHaveBeenCalled()
  })
  it('flag OFF → 404, no Vault call (no leak)', async () => {
    flagEnabled = false
    const res = await documentsGet(req(), params())
    expect((res as Response).status).toBe(404)
    expect(pv).not.toHaveBeenCalled()
  })
  it('flag ON + auth → proxies to paperwork agents docs path', async () => {
    await documentsGet(req(), params())
    expect(pv).toHaveBeenCalledTimes(1)
    const [, method, path] = pv.mock.calls[0]
    expect(method).toBe('GET')
    expect(path).toBe(`/paperwork/agents/transactions/${TXN}/documents`)
  })
})

describe('POST /api/signing/transactions/[id]/packages/compose-preview', () => {
  it('unauth → 401, no Vault call', async () => {
    ra.mockResolvedValueOnce({ response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) })
    const res = await previewPost(req({}), params())
    expect((res as Response).status).toBe(401)
    expect(pv).not.toHaveBeenCalled()
  })
  it('flag OFF → 404 without touching Vault or reading body', async () => {
    flagEnabled = false
    const res = await previewPost(req({}), params())
    expect((res as Response).status).toBe(404)
    expect(pv).not.toHaveBeenCalled()
  })
  it('flag ON + auth → forwards body to compose-preview path', async () => {
    const body = { plan_version: 'v2', document_ids: [TXN], routing_order: 'parallel' }
    await previewPost(req(body), params())
    expect(pv).toHaveBeenCalledTimes(1)
    const [, method, path, forwarded] = pv.mock.calls[0]
    expect(method).toBe('POST')
    expect(path).toBe(`/signing/transactions/${TXN}/packages/compose-preview`)
    expect(forwarded).toEqual(body)
  })
})

describe('POST /api/signing/transactions/[id]/packages (V2 submit)', () => {
  it('unauth → 401', async () => {
    ra.mockResolvedValueOnce({ response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) })
    const res = await submitPost(req({}), params())
    expect((res as Response).status).toBe(401)
    expect(pv).not.toHaveBeenCalled()
  })
  it('flag OFF → 404, no Vault call (protects against accidental submission)', async () => {
    flagEnabled = false
    const res = await submitPost(req({}), params())
    expect((res as Response).status).toBe(404)
    expect(pv).not.toHaveBeenCalled()
  })
  it('flag ON + auth → forwards body to submit path', async () => {
    const body = {
      plan_version: 'v2',
      document_ids: [TXN],
      recipients: [],
      routing_order: 'parallel',
      command_idempotency_key: 'idem-key-1234567890',
    }
    await submitPost(req(body), params())
    expect(pv).toHaveBeenCalledTimes(1)
    const [, method, path, forwarded] = pv.mock.calls[0]
    expect(method).toBe('POST')
    expect(path).toBe(`/signing/transactions/${TXN}/packages`)
    expect(forwarded).toEqual(body)
  })
})
