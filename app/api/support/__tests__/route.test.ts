/**
 * @jest-environment node
 */
// ============================================================================
// AP.MAIL.P2.001 — Support route: authenticated Vault proxy (no SendGrid)
// ============================================================================

import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

jest.mock('@/lib/vault-forward', () => ({ proxyToVault: jest.fn() }))
jest.mock('@/lib/security', () => ({ requireAuth: jest.fn() }))

import { proxyToVault } from '@/lib/vault-forward'
import { requireAuth } from '@/lib/security'
import { POST } from '../route'

const mockProxy = proxyToVault as jest.Mock
const mockAuth = requireAuth as jest.Mock

const body = { name: 'Ada', email: 'ada@example.test', subject: 'Help', message: 'It broke' }

function req(): NextRequest {
  return new Request('http://localhost/api/support', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as NextRequest
}

beforeEach(() => {
  mockProxy.mockReset()
  mockAuth.mockReset()
})

describe('POST /api/support (Vault proxy)', () => {
  it('proxies to Vault POST /support/requests with the form body when authenticated', async () => {
    mockAuth.mockResolvedValue({ response: undefined })
    mockProxy.mockResolvedValue(NextResponse.json({ success: true, id: 'req-1' }, { status: 200 }))

    const res = await POST(req())

    expect(mockProxy).toHaveBeenCalledTimes(1)
    const [, method, path, forwarded] = mockProxy.mock.calls[0]
    expect(method).toBe('POST')
    expect(path).toBe('/support/requests')
    expect(forwarded).toEqual(body)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, id: 'req-1' })
  })

  it('returns the auth failure and never proxies when unauthenticated', async () => {
    mockAuth.mockResolvedValue({
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    })
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(mockProxy).not.toHaveBeenCalled()
  })

  it('passes a Vault validation failure straight through (normalized, not swallowed)', async () => {
    mockAuth.mockResolvedValue({ response: undefined })
    mockProxy.mockResolvedValue(NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 }))
    const res = await POST(req())
    expect(res.status).toBe(400)
  })

  it('returns an honest error when Vault is unavailable', async () => {
    mockAuth.mockResolvedValue({ response: undefined })
    mockProxy.mockResolvedValue(NextResponse.json({ error: 'vault_unreachable' }, { status: 502 }))
    const res = await POST(req())
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'vault_unreachable' })
  })

  it('contains no SendGrid / email-provider responsibility', () => {
    const src = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8')
    // No provider import or invocation (prose mentioning "SendGrid removed" is fine).
    expect(src).not.toMatch(/@sendgrid\/mail|sgMail/)
    expect(src).toMatch(/\brequireAuth\b/) // check-api-routes marker
    expect(src).toContain('proxyToVault')
  })
})
