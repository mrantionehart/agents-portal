/**
 * @jest-environment jsdom
 */
// ============================================================================
// AP · Agent Visibility · CommissionsPage — auth + error/empty state tests
// ============================================================================
// Same guarantees as DealsPage: authFetch canonical, no UUID-as-Bearer,
// visible error on non-2xx, empty state only on 200 with zero records.
// ============================================================================

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}))
jest.mock('../../providers', () => {
  const u = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'a@x.co' }
  return { useAuth: () => ({ user: u, loading: false, signOut: jest.fn() }) }
})
const authFetchMock = jest.fn()
jest.mock('@/lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
  supabase: { auth: {} },
}))
beforeEach(() => {
  authFetchMock.mockReset()
  global.fetch = jest.fn()
})

import CommissionsPage from '../page'

function mkResp(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response
}

describe('CommissionsPage · auth + error/empty state', () => {
  it('calls authFetch("/api/vault/commissions") — never raw fetch — on mount', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(200, { commissions: [] }))
    render(<CommissionsPage />)
    await waitFor(() => expect(authFetchMock).toHaveBeenCalled())
    expect(authFetchMock).toHaveBeenCalledWith('/api/vault/commissions')
    expect((global.fetch as jest.Mock)).not.toHaveBeenCalled()
  })

  it('does NOT send the profile UUID as a Bearer token', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(200, { commissions: [] }))
    render(<CommissionsPage />)
    await waitFor(() => expect(authFetchMock).toHaveBeenCalled())
    const args = authFetchMock.mock.calls[0]
    const init = (args[1] as RequestInit | undefined) || {}
    const headers = new Headers((init.headers as HeadersInit) || {})
    const auth = headers.get('Authorization') || headers.get('authorization')
    if (auth) {
      expect(auth).not.toMatch(/^Bearer [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }
  })

  it('renders visible error state on 401 (not silent empty)', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(401, { error: 'Unauthorized' }))
    render(<CommissionsPage />)
    await waitFor(() => {
      expect(screen.queryByText('No commissions found')).not.toBeInTheDocument()
      expect(
        screen.getByText(/couldn't load|unable to load|failed to load|error/i)
      ).toBeInTheDocument()
    })
  })

  it('renders visible error state on 500', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(500, { error: 'server' }))
    render(<CommissionsPage />)
    await waitFor(() => {
      expect(screen.queryByText('No commissions found')).not.toBeInTheDocument()
      expect(
        screen.getByText(/couldn't load|unable to load|failed to load|error/i)
      ).toBeInTheDocument()
    })
  })

  it('renders visible error state on network failure', async () => {
    authFetchMock.mockRejectedValueOnce(new Error('network down'))
    render(<CommissionsPage />)
    await waitFor(() => {
      expect(
        screen.getByText(/couldn't load|unable to load|failed to load|error/i)
      ).toBeInTheDocument()
    })
  })

  it('shows the empty-state message ONLY on 200 with an empty commissions array', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(200, { commissions: [] }))
    render(<CommissionsPage />)
    await waitFor(() => {
      expect(screen.getByText('No commissions found')).toBeInTheDocument()
    })
    expect(
      screen.queryByText(/couldn't load|unable to load|failed to load/i)
    ).not.toBeInTheDocument()
  })

  it('renders commission rows on a successful response with data', async () => {
    authFetchMock.mockResolvedValueOnce(
      mkResp(200, {
        commissions: [
          {
            id: 'c1',
            gross_commission: 20000,
            // COMMISSION-CANONICAL-FORMULA-1 — "Your Amount" is the PAYABLE
            // figure (net_commission), not agent_amount. agent_amount is kept
            // here, deliberately different, so the assertion below proves
            // which field the cell reads.
            agent_amount: 15000,
            net_commission: 13650,
            commission_status: 'paid',
            paid_at: '2026-11-01',
            transactions: { property_address: '9 Fidelity Pl', client_name: 'Jane Doe' },
          },
        ],
      })
    )
    render(<CommissionsPage />)
    await waitFor(() => expect(screen.getByText('9 Fidelity Pl')).toBeInTheDocument())
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    // $20,000 appears twice: total-gross summary card + the row's cell.
    expect(screen.getAllByText('$20,000').length).toBeGreaterThanOrEqual(1)
    // the payable amount, in the row AND the "Your Earned Amount" card
    expect(screen.getAllByText('$13,650').length).toBeGreaterThanOrEqual(2)
    // and NOT the figure this Portal's own create path would have written
    expect(screen.queryByText('$15,000')).not.toBeInTheDocument()
  })

  // COMMISSION-CANONICAL-FORMULA-1
  it('shows "Pending calculation" instead of a figure when none was calculated', async () => {
    authFetchMock.mockResolvedValueOnce(
      mkResp(200, {
        commissions: [
          {
            id: 'c1',
            gross_commission: 19500,
            // exactly the shape this Portal's create path leaves behind: a
            // seeded agent_amount and no calculated net_commission.
            agent_amount: 13650,
            net_commission: null,
            commission_status: 'pending_calculation',
            paid_at: null,
            transactions: { property_address: '1 Pending Way', client_name: 'Ann Roe' },
          },
        ],
      })
    )
    render(<CommissionsPage />)
    await waitFor(() => expect(screen.getByText('1 Pending Way')).toBeInTheDocument())
    expect(screen.getByText('Pending calculation')).toBeInTheDocument()
    // the uncalculated row contributes nothing to the earned total...
    expect(screen.queryByText('$13,650')).not.toBeInTheDocument()
    // ...and the gap is stated rather than left as a silently short total
    expect(
      screen.getByText(/1 commission not yet\s+calculated/)
    ).toBeInTheDocument()
  })
})
