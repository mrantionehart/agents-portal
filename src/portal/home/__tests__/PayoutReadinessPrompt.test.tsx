// ============================================================================
// FINSEC D5 — PayoutReadinessPrompt: hard-disabled in code
// ============================================================================
// The prompt used to call Vault /stripe/connect and nudge "Connect with Stripe"
// whenever NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED === "true". The env var is set to
// "true" here deliberately: it must no longer have any effect.
// ============================================================================
import { render, screen, act } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockAuthFetch = authFetch as jest.Mock

import PayoutReadinessPrompt from '@/src/portal/home/PayoutReadinessPrompt'

const originalFetch = global.fetch
let fetchSpy: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED = 'true'
  fetchSpy = jest.fn(async () => ({ ok: true, json: async () => ({ readiness: 'not_started' }) }))
  global.fetch = fetchSpy as unknown as typeof fetch
  mockAuthFetch.mockResolvedValue({ ok: true, json: async () => ({ readiness: 'not_started' }) })
  try { sessionStorage.clear() } catch { /* jsdom has it */ }
})
afterEach(() => {
  delete process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED
  global.fetch = originalFetch
})

describe('FINSEC D5 — PayoutReadinessPrompt (rail hard-disabled)', () => {
  it('[D5-P1] renders nothing, no connect CTA, no fetch — even with the env flag "true"', async () => {
    const { container } = render(<PayoutReadinessPrompt />)
    await act(async () => {
      await Promise.resolve()
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryByText(/Set Up Payouts/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Stripe/i)).not.toBeInTheDocument()
    expect(mockAuthFetch).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
