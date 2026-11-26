// FINSEC closeout (P1) — the pipeline page labels GCI as recorded commission
// only, says how many deals are not yet calculated, and no longer calls a
// stage-weighted gross "Probable Income".
import { render, screen, waitFor } from '@testing-library/react'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/app/providers', () => ({
  useAuth: () => ({ user: { id: 'agent-1', email: 'a@x.test', user_metadata: {} }, role: 'agent', loading: false, signOut: jest.fn() }),
}))
jest.mock('../../providers', () => ({
  useAuth: () => ({ user: { id: 'agent-1', email: 'a@x.test', user_metadata: {} }, role: 'agent', loading: false, signOut: jest.fn() }),
}))
jest.mock('@/app/components/SidebarNav', () => ({ __esModule: true, default: () => null }))

import PipelinePage from '@/app/pipeline/page'

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      pipeline: [],
      totals: { totalDeals: 2, totalVolume: 200000, potentialGCI: 3000, probableGCI: 3000, gciPendingCount: 1, closedDeals: 2, closedVolume: 200000 },
      role: 'agent',
      agents: [],
    }),
  })) as unknown as typeof fetch
})

it('shows "Recorded commissions only · 1 deal not yet calculated" and no "Probable Income"', async () => {
  render(<PipelinePage />)
  await waitFor(() => expect(screen.getByTestId('gci-basis')).toHaveTextContent('Recorded commissions only · 1 deal not yet calculated'))
  expect(screen.getByText('Potential GCI')).toBeInTheDocument()
  expect(screen.getByText('Probable GCI (stage-weighted)')).toBeInTheDocument()
  expect(screen.queryByText('Probable Income')).toBeNull()
})
