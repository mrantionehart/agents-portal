// ============================================================================
// P4H-13 · a stale DocuSign connection has to OFFER the fix
// ============================================================================
// Measured in production 2026-10-27: an agent's row read status "connected"
// with an access token 112 days past its expiry. This card rendered a green
// "Connected" badge off `connected === true` and kept the Connect button in
// the `else`, so she was shown reassurance and no remedy.
//
// `needs_reconnect` is derived by Vault from the stored expiry, with no call to
// DocuSign. These mount the real card and assert what she can see and click.
// ============================================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ConnectedAccountsCard from '@/src/portal/settings/ConnectedAccountsCard'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

const LIVE = {
  connected: true,
  provider: 'docusign',
  provider_label: 'DocuSign',
  email: 'mallory.guth@hartfeltrealestate.com',
  account_id: 'acct-1',
  status: 'connected',
  connected_at: '2026-10-27T15:00:00Z',
  last_used_at: '2026-10-27T15:00:00Z',
  expires_at: '2026-10-28T06:00:00Z',
  needs_reconnect: false,
  reconnect_reason: null,
  reconnect_detail: null,
}

// Verbatim from the production row.
const STALE = {
  ...LIVE,
  connected_at: '2026-07-06T15:32:56.336Z',
  last_used_at: '2026-07-06T15:32:56.336Z',
  expires_at: '2026-07-06T23:32:56.335Z',
  needs_reconnect: true,
  reconnect_reason: 'token_expired',
  reconnect_detail:
    "This connection's authorisation expired 112 days ago. Sending may still " +
    'work if DocuSign renews it automatically, but reconnecting is the only ' +
    'way to be sure.',
}

// GET /esign/status returns the status object DIRECTLY. (POST /esign/disconnect
// wraps it as { status }, which is why the card reads json.status there and
// json here — two shapes on one resource, pre-existing.)
const statusRes = (status: unknown) => ({ ok: true, json: async () => status })

const originalLocation = window.location
beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(window, 'location', {
    value: { href: '', pathname: '/settings', search: '' },
    writable: true,
    configurable: true,
  })
})
afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation, writable: true, configurable: true,
  })
})

describe('ConnectedAccountsCard — stale connections', () => {
  it('[RECON-1] a STALE connection offers Reconnect, and says why', async () => {
    mockFetch.mockResolvedValueOnce(statusRes(STALE))
    render(<ConnectedAccountsCard />)

    expect(
      await screen.findByRole('button', { name: /Reconnect DocuSign/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/expired 112 days ago/i)).toBeInTheDocument()
    // It does not claim the connection is dead — only DocuSign knows that.
    expect(screen.getByText(/may still\s+work/i)).toBeInTheDocument()
  })

  it('[RECON-2] and it does NOT claim to be healthy', async () => {
    mockFetch.mockResolvedValueOnce(statusRes(STALE))
    render(<ConnectedAccountsCard />)

    // Target the BADGE, not the "Connected" <dt> in the details list.
    expect(
      await screen.findByRole('status', { name: /needs reconnect/i }),
    ).toBeInTheDocument()
    // The defect: a green "Connected" badge over an expired credential.
    expect(screen.queryByRole('status', { name: /: connected$/i })).not.toBeInTheDocument()
  })

  it('[RECON-3] the account details still show, so she can see WHICH account', async () => {
    mockFetch.mockResolvedValueOnce(statusRes(STALE))
    render(<ConnectedAccountsCard />)
    expect(
      await screen.findByText('mallory.guth@hartfeltrealestate.com'),
    ).toBeInTheDocument()
  })

  it('[RECON-4] pressing Reconnect starts the OAuth connect, not a refresh', async () => {
    mockFetch.mockResolvedValueOnce(statusRes(STALE))
    render(<ConnectedAccountsCard />)
    const btn = await screen.findByRole('button', { name: /Reconnect DocuSign/i })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ redirectUrl: 'https://account.docusign.com/oauth/auth' }),
    })
    fireEvent.click(btn)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    const [url, init] = mockFetch.mock.calls[1]
    // A fresh OAuth authorise, which is what "reconnect" has to mean. The
    // portal must never try to refresh the credential itself.
    expect(String(url)).toMatch(/\/esign\/docusign\/connect$/)
    expect(init?.method).toBe('GET')
    const everyUrl = mockFetch.mock.calls.map((c) => String(c[0])).join(' ')
    expect(everyUrl).not.toMatch(/refresh/i)
  })

  it('[RECON-5] CONTROL — a LIVE connection shows Connected and no Reconnect', async () => {
    mockFetch.mockResolvedValueOnce(statusRes(LIVE))
    render(<ConnectedAccountsCard />)

    expect(
      await screen.findByRole('status', { name: /: connected$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Reconnect DocuSign/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /needs reconnect/i })).not.toBeInTheDocument()
  })

  it('[RECON-6] an older Vault that omits the field renders as before', async () => {
    // Forward compatibility: `undefined` must not read as "needs reconnect".
    const { needs_reconnect: _a, reconnect_reason: _b, reconnect_detail: _c, ...legacy } = LIVE
    mockFetch.mockResolvedValueOnce(statusRes(legacy))
    render(<ConnectedAccountsCard />)

    expect(
      await screen.findByRole('status', { name: /: connected$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Reconnect DocuSign/i }),
    ).not.toBeInTheDocument()
  })

  it('[RECON-7] NOT connected still offers Connect, unchanged', async () => {
    mockFetch.mockResolvedValueOnce(
      statusRes({ ...LIVE, connected: false, status: 'disconnected', needs_reconnect: true, reconnect_reason: 'not_connected' }),
    )
    render(<ConnectedAccountsCard />)

    expect(
      await screen.findByRole('button', { name: /Connect DocuSign/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status', { name: /not connected/i })).toBeInTheDocument()
  })
})
