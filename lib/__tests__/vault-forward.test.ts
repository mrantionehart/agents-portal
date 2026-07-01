/**
 * @jest-environment node
 */
// ============================================================================
// AGENT.SIGN.1B (Phase 0) — vault-forward (ensureVaultForms) tests
// ============================================================================

import { VAULT_API_URL } from '../vault-client'

// Mock @supabase/ssr so the cookie-session fallback is controllable.
let mockSession: { access_token: string } | null = null
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getSession: async () => ({ data: { session: mockSession } }) },
  }),
}))

import { ensureVaultForms } from '../vault-forward'

function reqWith(bearer?: string): any {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' && bearer ? bearer : null) },
    cookies: { get: () => undefined },
  }
}

beforeEach(() => {
  mockSession = null
  global.fetch = jest.fn()
})

describe('ensureVaultForms', () => {
  it('forwards the Bearer token and posts to the Vault ensure-forms endpoint', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, materialized: 2, requirements: [], documents: [] }),
    })

    const res = await ensureVaultForms(reqWith('Bearer TOK123'), 'txn-1', 'listing')

    expect(res.ok).toBe(true)
    expect(res.body?.materialized).toBe(2)
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`${VAULT_API_URL}/paperwork/agents/transactions/txn-1/ensure-forms`)
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer TOK123')
    // AGENT.SIGN.1B.5 — mapped Vault type forwarded in the body.
    expect(JSON.parse(opts.body)).toEqual({ transaction_type: 'listing' })
  })

  it('omits transaction_type from the body when none is provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    await ensureVaultForms(reqWith('Bearer TOK'), 'txn-1')
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual({})
  })

  it('propagates a non-OK Vault status without throwing', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Transaction not found' }),
    })
    const res = await ensureVaultForms(reqWith('Bearer TOK123'), 'txn-x')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  it('returns 401 and does NOT call Vault when no token can be resolved', async () => {
    mockSession = null // no bearer + no cookie session
    const res = await ensureVaultForms(reqWith(undefined), 'txn-1')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
    expect(global.fetch as jest.Mock).not.toHaveBeenCalled()
  })

  it('falls back to the cookie session token when no Bearer header is present', async () => {
    mockSession = { access_token: 'COOKIE_TOK' }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    await ensureVaultForms(reqWith(undefined), 'txn-2')
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer COOKIE_TOK')
  })

  it('returns 502 (not a throw) when the Vault fetch rejects', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    const res = await ensureVaultForms(reqWith('Bearer TOK'), 'txn-3')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(502)
  })
})
