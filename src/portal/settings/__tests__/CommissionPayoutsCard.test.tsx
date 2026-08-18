import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import CommissionPayoutsCard from '@/src/portal/settings/CommissionPayoutsCard'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const statusRes = (readiness: string, enabled = true) => ({
  ok: true,
  json: async () => ({ enabled, readiness }),
})

const originalLocation = window.location
beforeEach(() => {
  jest.clearAllMocks()
  // The existing behavior suites exercise the ENABLED rail.
  process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED = 'true'
  Object.defineProperty(window, 'location', {
    value: { href: '', pathname: '/settings', search: '' },
    writable: true,
    configurable: true,
  })
})
afterEach(() => {
  delete process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED
  Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
})

describe('CommissionPayoutsCard', () => {
  it('shows a loading state first (never blocks)', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<CommissionPayoutsCard />)
    expect(screen.getByText(/Checking payout status/i)).toBeInTheDocument()
  })

  it('not_started → Connect with Stripe', async () => {
    mockFetch.mockResolvedValue(statusRes('not_started'))
    render(<CommissionPayoutsCard />)
    expect(await screen.findByRole('button', { name: /Connect with Stripe/i })).toBeInTheDocument()
  })

  it('incomplete → Continue Stripe Setup', async () => {
    mockFetch.mockResolvedValue(statusRes('incomplete'))
    render(<CommissionPayoutsCard />)
    expect(await screen.findByRole('button', { name: /Continue Stripe Setup/i })).toBeInTheDocument()
  })

  it('pending_verification → Check Status (re-fetch, no connect)', async () => {
    mockFetch.mockResolvedValue(statusRes('pending_verification'))
    render(<CommissionPayoutsCard />)
    expect(await screen.findByText(/verification in progress/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Check Status/i })).toBeInTheDocument()
  })

  it('ready → connected message, no connect button', async () => {
    mockFetch.mockResolvedValue(statusRes('ready'))
    render(<CommissionPayoutsCard />)
    expect(await screen.findByText(/Payout account connected/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Connect with Stripe/i })).not.toBeInTheDocument()
  })

  it('not_configured → informational, no connect button', async () => {
    mockFetch.mockResolvedValue(statusRes('not_configured', false))
    render(<CommissionPayoutsCard />)
    expect(await screen.findByText(/aren.t enabled on this brokerage/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Connect with Stripe/i })).not.toBeInTheDocument()
  })

  it('Connect posts the agent_portal context and redirects to the Stripe URL', async () => {
    mockFetch.mockImplementation(async (_url: string, opts?: { method?: string; body?: string }) => {
      if (opts?.method === 'POST') return { ok: true, json: async () => ({ url: 'https://connect.stripe.test/onb' }) }
      return statusRes('not_started')
    })
    render(<CommissionPayoutsCard />)
    const btn = await screen.findByRole('button', { name: /Connect with Stripe/i })
    fireEvent.click(btn)
    await waitFor(() => expect(window.location.href).toBe('https://connect.stripe.test/onb'))
    // POST body carries ONLY the bounded context — no agent id / account.
    const postCall = mockFetch.mock.calls.find((c) => c[1]?.method === 'POST')
    expect(postCall[0]).toMatch(/\/stripe\/connect$/)
    const body = JSON.parse(postCall[1].body)
    expect(body).toEqual({ context: 'agent_portal' })
  })

  it('never renders bank/routing/account numbers or raw Stripe object', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, readiness: 'ready', payouts_enabled: true, charges_enabled: true }),
    })
    const { container } = render(<CommissionPayoutsCard />)
    await screen.findByText(/Payout account connected/i)
    const text = container.textContent || ''
    for (const leak of ['routing', 'account number', 'acct_', 'sk_live', 'sk_test', 'bank_account']) {
      expect(text.toLowerCase()).not.toContain(leak)
    }
    // Discloses HartFelt does not store bank info.
    expect(container.textContent).toMatch(/not stored by HartFelt/i)
  })

  describe('rail disabled (payout provider transition)', () => {
    beforeEach(() => {
      // Default OFF: flag absent means the connect rail is disabled.
      delete process.env.NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED
    })

    it('shows the neutral updating message and NO connect CTA', async () => {
      mockFetch.mockResolvedValue(statusRes('not_started'))
      render(<CommissionPayoutsCard />)
      expect(await screen.findByText(/updating how commission payouts/i)).toBeInTheDocument()
      // No CTA of any kind.
      expect(screen.queryByRole('button', { name: /Connect with Stripe/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Continue Stripe Setup/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Check Status/i })).not.toBeInTheDocument()
    })

    it('never calls the Vault connect endpoint while disabled', async () => {
      mockFetch.mockResolvedValue(statusRes('not_started'))
      render(<CommissionPayoutsCard />)
      await screen.findByText(/updating how commission payouts/i)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('names no payment provider in the disabled copy', async () => {
      const { container } = render(<CommissionPayoutsCard />)
      await screen.findByText(/updating how commission payouts/i)
      expect((container.textContent || '').toLowerCase()).not.toContain('stripe')
    })
  })

  it('Connect failure renders the bounded Vault message, never the machine code or raw provider text', async () => {
    // Vault returns the SANITIZED shape: bounded `message` + a machine `error` code.
    mockFetch.mockImplementation(async (_url: string, opts?: { method?: string }) => {
      if (opts?.method === 'POST') {
        return {
          ok: false,
          json: async () => ({
            error: 'PAYOUT_SETUP_TEMPORARILY_UNAVAILABLE',
            message:
              'Payout setup is temporarily unavailable. HARTFELT is working to restore this service. Please try again later or contact us for assistance.',
          }),
        }
      }
      return statusRes('not_started')
    })
    const { container } = render(<CommissionPayoutsCard />)
    fireEvent.click(await screen.findByRole('button', { name: /Connect with Stripe/i }))

    // The agent sees the bounded product copy…
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
    const text = (container.textContent || '').toLowerCase()
    // …and NEVER the machine code or any raw provider terminology.
    for (const leak of [
      'payout_setup_temporarily_unavailable',
      'rejected',
      'cannot create',
      'your account has been',
      'acct_',
    ]) {
      expect(text).not.toContain(leak)
    }
  })

  it('Connect network failure (no JSON) falls back to bounded copy, not a raw error', async () => {
    mockFetch.mockImplementation(async (_url: string, opts?: { method?: string }) => {
      if (opts?.method === 'POST') throw new Error('You cannot create new accounts because your account has been rejected.')
      return statusRes('not_started')
    })
    const { container } = render(<CommissionPayoutsCard />)
    fireEvent.click(await screen.findByRole('button', { name: /Connect with Stripe/i }))
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
    expect((container.textContent || '').toLowerCase()).not.toContain('rejected')
  })
})
