/**
 * @jest-environment jsdom
 */
// ============================================================================
// P4H-14 — New Transaction wizard: Business Line selector (RTL render test)
// ============================================================================
// UX-DONE-1 UI evidence (jest + RTL mounts the real page):
//   • entry point: the Business Line selector renders with both options
//   • primary action: selecting "Acquisition" fires and is reflected
//   • result: the GCI/commission preview shows for brokerage-with-a-price and
//     is SUPPRESSED for acquisition (acquisitions have no agent commission)
// ============================================================================

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}))

jest.mock('../../providers', () => ({
  useAuth: () => ({
    user: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'a@x.co', role: 'agent' },
    role: 'agent',
    loading: false,
    signOut: jest.fn(),
  }),
}))

// Stub the sidebar (unrelated deps) so the page mounts in isolation.
jest.mock('../../components/SidebarNav', () => ({
  __esModule: true,
  default: () => null,
}))

beforeEach(() => {
  // loadAgents() does fetch('/api/pipeline'); keep it harmless.
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ groups: [] }),
  })) as unknown as typeof fetch
})

import NewTransactionPage from '../page'

const acquisitionButton = () =>
  (screen.getByText('Acquisition').closest('button') as HTMLButtonElement)
const brokerageButton = () =>
  (screen.getByText('Brokerage').closest('button') as HTMLButtonElement)

describe('P4H-14 · New Transaction · Business Line selector', () => {
  it('renders the Business Line selector with both options (entry point)', async () => {
    render(<NewTransactionPage />)
    await waitFor(() => expect(screen.getByText('Business Line')).toBeInTheDocument())
    expect(brokerageButton()).toBeInTheDocument()
    expect(acquisitionButton()).toBeInTheDocument()
    // Acquisition option explains no-commission to the user.
    expect(screen.getByText(/no agent commission, split, cap, or payout/i)).toBeInTheDocument()
  })

  it('suppresses the GCI preview for acquisitions and shows it for brokerage (primary action + result)', async () => {
    render(<NewTransactionPage />)
    await waitFor(() => expect(screen.getByText('Business Line')).toBeInTheDocument())

    // Enter a contract price (first "0.00" number input is Contract Price).
    const priceInput = screen.getAllByPlaceholderText('0.00')[0]
    fireEvent.change(priceInput, { target: { value: '500000' } })

    // Default is brokerage → the GCI preview is visible.
    await waitFor(() => expect(screen.getByText(/Estimated GCI/i)).toBeInTheDocument())

    // Switch to Acquisition → GCI preview is gone.
    fireEvent.click(acquisitionButton())
    await waitFor(() => expect(screen.queryByText(/Estimated GCI/i)).not.toBeInTheDocument())

    // Switch back to Brokerage → GCI preview returns.
    fireEvent.click(brokerageButton())
    await waitFor(() => expect(screen.getByText(/Estimated GCI/i)).toBeInTheDocument())
  })
})
