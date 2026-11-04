/**
 * @jest-environment jsdom
 */
// ============================================================================
// C1 (2026-11-04) — the rate/split fields are an ESTIMATE, and the page says so
// ============================================================================
// The create route used to try to save them in a commission row with the
// agent's token; production never allowed that write, so they were silently
// dropped while the form implied they were recorded. The route no longer
// tries, and the form now states plainly that the figures are an estimate.
// Mounts the real page (jest + RTL).
// ============================================================================

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}))
jest.mock('../../../providers', () => ({
  useAuth: () => ({
    user: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'a@x.co', role: 'agent' },
    role: 'agent',
    loading: false,
    signOut: jest.fn(),
  }),
}))
jest.mock('../../../components/SidebarNav', () => ({ __esModule: true, default: () => null }))

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ groups: [] }) })) as unknown as typeof fetch
})

import NewTransactionPage from '../page'

describe('C1 · New Transaction · commission figures are an estimate', () => {
  it('a brokerage deal says the rate and split are not saved', async () => {
    render(<NewTransactionPage />)
    await waitFor(() => expect(screen.getByText('Business Line')).toBeInTheDocument())
    expect(screen.getByText('Commission Rate %')).toBeInTheDocument()
    expect(screen.getByTestId('commission-estimate-note')).toHaveTextContent(
      /Estimate only — the commission rate and split are not saved/,
    )
  })

  it('an acquisition shows no commission note (acquisitions carry no commission)', async () => {
    render(<NewTransactionPage />)
    await waitFor(() => expect(screen.getByText('Business Line')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Acquisition').closest('button') as HTMLButtonElement)
    await waitFor(() => expect(screen.queryByTestId('commission-estimate-note')).not.toBeInTheDocument())
  })
})
