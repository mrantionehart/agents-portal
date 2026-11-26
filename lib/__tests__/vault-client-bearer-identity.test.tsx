// ============================================================================
// FINSEC P0-4 — lib/vault-client.ts asserts identity ONLY with a Bearer JWT
// ============================================================================
// vault-client used to tell Vault who the caller was with client-set
// `X-User-ID` / `X-User-Role` headers — values any browser can forge. Every
// request now goes through authFetch (Supabase Bearer from the cached session)
// and carries no identity header of its own, whatever the call site passes.
//
// Includes an RTL test of the real Commission Calculator page: pressing
// "Calculate with Vault" (app/commission-calculator/page.tsx:33) issues the
// Vault call through authFetch with no X-User-* header.
// ============================================================================
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockAuthFetch = authFetch as jest.Mock

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
jest.mock('@/app/providers', () => ({
  useAuth: () => ({ user: { id: 'agent-1' }, role: 'admin', loading: false, signOut: jest.fn() }),
}))

import { vaultAPI } from '@/lib/vault-client'
import CommissionCalculatorPage from '@/app/commission-calculator/page'

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

const headerNames = (init: RequestInit | undefined): string[] => {
  const h = init?.headers
  if (!h) return []
  if (h instanceof Headers) return Array.from(h.keys()).map((k) => k.toLowerCase())
  return Object.keys(h as Record<string, string>).map((k) => k.toLowerCase())
}

const originalFetch = global.fetch
let rawFetch: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthFetch.mockResolvedValue(okJson({ commissions: [] }))
  rawFetch = jest.fn(async () => okJson({}))
  global.fetch = rawFetch as unknown as typeof fetch
})
afterEach(() => {
  global.fetch = originalFetch
})

function expectNoIdentityHeaders() {
  expect(mockAuthFetch).toHaveBeenCalled()
  for (const [, init] of mockAuthFetch.mock.calls) {
    const names = headerNames(init)
    expect(names).not.toContain('x-user-id')
    expect(names).not.toContain('x-user-role')
  }
  // Nothing bypasses authFetch with a bare fetch (which would carry no Bearer).
  expect(rawFetch).not.toHaveBeenCalled()
}

describe('FINSEC P0-4 — vault-client identity transport', () => {
  it('[P04-VCL1] commissions.list → authFetch to /commissions/get, no X-User-* headers', async () => {
    await vaultAPI.commissions.list('agent-1', 'admin')
    expect(mockAuthFetch.mock.calls[0][0]).toMatch(/\/commissions\/get$/)
    expectNoIdentityHeaders()
  })

  it('[P04-VCL2] JSON POST (commissions.calculate) → no X-User-* headers', async () => {
    await vaultAPI.commissions.calculate({ salePrice: 1, commissionRate: 1, brokerSplit: 1 }, 'agent-1', 'broker')
    expect(mockAuthFetch.mock.calls[0][1].method).toBe('POST')
    expectNoIdentityHeaders()
  })

  it('[P04-VCL3] multipart uploads → authFetch, no X-User-* headers', async () => {
    const file = new File(['x'], 'x.pdf')
    await vaultAPI.documents.upload(file, 'deal-1', 'agent-1', 'stage', 'admin')
    await vaultAPI.ai.analyzeDocument(file, 'agent-1', 'admin')
    await vaultAPI.ai.extractDeadlines(file, 'agent-1', 'admin')
    await vaultAPI.onboarding.uploadDocument(file, 'doc', 'agent-1', 'admin')
    expect(mockAuthFetch).toHaveBeenCalledTimes(4)
    expectNoIdentityHeaders()
  })

  it('[P04-VCL4] a Vault 401 fails closed to empty data, not an exception', async () => {
    mockAuthFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) })
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await vaultAPI.commissions.list('agent-1')
    expect(res.commissions).toEqual([])
    err.mockRestore()
  })
})

describe('FINSEC P0-4 — Commission Calculator page (RTL)', () => {
  it('[P04-CALC1] "Calculate with Vault" is visible and its press sends Bearer-only identity', async () => {
    mockAuthFetch.mockResolvedValue(okJson({ netCommission: 1 }))
    render(<CommissionCalculatorPage />)
    const btn = screen.getByRole('button', { name: /Calculate with Vault/i })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    // The page also reads /api/vault/compensation on mount (FINSEC closeout).
    await waitFor(() =>
      expect(mockAuthFetch.mock.calls.some(([u]) => /\/commissions\/calculate$/.test(u))).toBe(true),
    )
    expectNoIdentityHeaders()
  })
})
