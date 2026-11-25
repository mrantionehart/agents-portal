// ============================================================================
// FINSEC D5 — CommissionPayoutsCard: payout connect is hard-disabled in code
// ============================================================================
// The card used to POST to Vault /stripe/connect and redirect to a Stripe URL
// whenever NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED === "true". These tests set that
// env var to "true" on purpose: the disable must hold against it. Every network
// seam the old card used (authFetch and raw fetch) is a spy that must stay cold.
// ============================================================================
import { render, screen, act } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockAuthFetch = authFetch as jest.Mock

import CommissionPayoutsCard from '@/src/portal/settings/CommissionPayoutsCard'
import { PAYOUT_CONNECT_ENABLED, payoutConnectEnabled } from '@/src/portal/payouts/payout-rail'

const originalFetch = global.fetch
const originalLocation = window.location
let fetchSpy: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED = 'true'
  fetchSpy = jest.fn(async () => ({ ok: true, json: async () => ({ readiness: 'not_started' }) }))
  global.fetch = fetchSpy as unknown as typeof fetch
  Object.defineProperty(window, 'location', {
    value: { href: '', pathname: '/settings', search: '?stripe=success' },
    writable: true,
    configurable: true,
  })
})
afterEach(() => {
  delete process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED
  global.fetch = originalFetch
  Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
})

async function renderCard() {
  const utils = render(<CommissionPayoutsCard />)
  // Let any (erroneous) effect or promise chain run before asserting silence.
  await act(async () => {
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
  })
  return utils
}

describe('FINSEC D5 — CommissionPayoutsCard (rail hard-disabled)', () => {
  it('[D5-C1] the entry point renders: heading + neutral "being updated" copy', async () => {
    await renderCard()
    expect(screen.getByRole('heading', { name: 'Commission Payouts' })).toBeInTheDocument()
    expect(screen.getByText(/updating how commission payouts are handled/i)).toBeInTheDocument()
  })

  it('[D5-C2] offers NO button or link of any kind, even with the env flag "true"', async () => {
    await renderCard()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByText(/Connect with Stripe/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Continue Stripe Setup/i)).not.toBeInTheDocument()
  })

  it('[D5-C3] makes no network call — no authFetch, no fetch, nothing to /stripe/connect', async () => {
    await renderCard()
    expect(mockAuthFetch).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    const urls = [...mockAuthFetch.mock.calls, ...fetchSpy.mock.calls].map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/stripe/connect'))).toBe(false)
  })

  it('[D5-C4] never redirects (no hand-off to a provider-hosted URL)', async () => {
    await renderCard()
    expect(window.location.href).toBe('')
  })

  it('[D5-C5] names no payment provider and shows no bank/account fields', async () => {
    const { container } = await renderCard()
    const text = (container.textContent || '').toLowerCase()
    for (const leak of ['stripe', 'routing', 'account number', 'acct_', 'bank_account']) {
      expect(text).not.toContain(leak)
    }
  })

  it('[D5-C6] the rail constant is false and ignores the env var', () => {
    process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED = 'true'
    expect(PAYOUT_CONNECT_ENABLED).toBe(false)
    expect(payoutConnectEnabled()).toBe(false)
  })
})
