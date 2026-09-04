/**
 * @jest-environment jsdom
 */
// ============================================================================
// AP · Agent Visibility · DealsPage — auth + error/empty state tests
// ============================================================================
// Proves that the fixed DealsPage:
//   1. uses the canonical authFetch helper (which sends Bearer <access_token>)
//   2. never sends the profile UUID as a Bearer token
//   3. surfaces a visible error state when Vault returns 401 / 500 / network err
//      (not a silent "No deals found" that masks the auth defect)
//   4. shows the empty state only on a successful 200 with an empty array
//   5. renders real rows when Vault returns data
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

// Guard against any raw fetch smuggling — if the page falls back to fetch(),
// the test will detect it via this mock.
beforeEach(() => {
  authFetchMock.mockReset()
  global.fetch = jest.fn()
})

import DealsPage from '../page'

function mkResp(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response
}

describe('DealsPage · auth + error/empty state', () => {
  it('calls authFetch("/api/vault/deals") — never raw fetch — on mount', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(200, { deals: [] }))
    render(<DealsPage />)
    await waitFor(() => expect(authFetchMock).toHaveBeenCalled())
    expect(authFetchMock).toHaveBeenCalledWith('/api/vault/deals')
    // Never uses raw fetch for the Vault call:
    expect((global.fetch as jest.Mock)).not.toHaveBeenCalled()
  })

  it('does NOT send the profile UUID as a Bearer token', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(200, { deals: [] }))
    render(<DealsPage />)
    await waitFor(() => expect(authFetchMock).toHaveBeenCalled())
    // authFetch receives (url) or (url, init). If init is provided, it must
    // NOT set Authorization to 'Bearer <uuid>' — authFetch derives the real
    // Bearer from the cached Supabase session.
    const args = authFetchMock.mock.calls[0]
    const init = (args[1] as RequestInit | undefined) || {}
    const headers = new Headers((init.headers as HeadersInit) || {})
    const auth = headers.get('Authorization') || headers.get('authorization')
    if (auth) {
      expect(auth).not.toMatch(/^Bearer [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }
  })

  it('renders visible error state on 401 (not a silent empty list)', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(401, { error: 'Unauthorized' }))
    render(<DealsPage />)
    await waitFor(() => {
      // Must NOT show the empty-result copy on an auth failure.
      expect(screen.queryByText('No deals found')).not.toBeInTheDocument()
    })
    // Some visible error indication should appear.
    expect(
      screen.getByText(/couldn't load|unable to load|failed to load|error/i)
    ).toBeInTheDocument()
  })

  it('renders visible error state on 500', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(500, { error: 'server' }))
    render(<DealsPage />)
    await waitFor(() => {
      expect(screen.queryByText('No deals found')).not.toBeInTheDocument()
      expect(
        screen.getByText(/couldn't load|unable to load|failed to load|error/i)
      ).toBeInTheDocument()
    })
  })

  it('renders visible error state on network failure', async () => {
    authFetchMock.mockRejectedValueOnce(new Error('network down'))
    render(<DealsPage />)
    await waitFor(() => {
      expect(
        screen.getByText(/couldn't load|unable to load|failed to load|error/i)
      ).toBeInTheDocument()
    })
  })

  it('shows the empty-state message ONLY on 200 with an empty deals array', async () => {
    authFetchMock.mockResolvedValueOnce(mkResp(200, { deals: [] }))
    render(<DealsPage />)
    await waitFor(() => {
      expect(screen.getByText('No deals found')).toBeInTheDocument()
    })
    // No error copy on a real 200.
    expect(
      screen.queryByText(/couldn't load|unable to load|failed to load/i)
    ).not.toBeInTheDocument()
  })

  it('renders deal rows on a successful response with data', async () => {
    authFetchMock.mockResolvedValueOnce(
      mkResp(200, {
        deals: [
          {
            id: 'd1',
            property_address: '123 Main St',
            city: 'Miami',
            client_name: 'Jane Doe',
            type: 'purchase',
            status: 'submitted',
            contract_price: 500000,
            closing_date: '2026-12-15',
          },
        ],
      })
    )
    render(<DealsPage />)
    await waitFor(() => expect(screen.getByText('123 Main St')).toBeInTheDocument())
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('$500,000')).toBeInTheDocument()
  })
})
