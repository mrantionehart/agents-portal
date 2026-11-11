// CTM-1 — Agent Portal entry: renders only when Vault's learner gate admits the
// learner (existing authenticated client), fails closed otherwise, and gives the
// broker a DRAFT preview pointer. Content/quiz/final stay in Vault's renderer.
import { render, screen, waitFor } from '@testing-library/react'

const mockFetchProgress = jest.fn()
jest.mock('@/src/portal/training/certified/api', () => ({
  fetchProgress: (...a: unknown[]) => mockFetchProgress(...a),
}))
jest.mock('@/lib/vault-client', () => ({ VAULT_BASE_URL: 'https://vault.test' }))

import {
  CtmProgramEntry,
  CTM_CERTIFICATION_ID,
  CTM_DOWNLOADS_HREF,
} from '../CtmProgramEntry'

class CertApiError extends Error {
  constructor(public status: number) { super(`HTTP ${status}`) }
}

const progress = (over: Record<string, unknown> = {}) => ({
  certification_id: CTM_CERTIFICATION_ID,
  version: '1.0.0',
  status: 'in_progress',
  tracks: [
    { module_id: 'ctm-m01', status: 'completed', pct: 100, lessons: [] },
    { module_id: 'ctm-m02', status: 'in_progress', pct: 50, lessons: [] },
    { module_id: 'ctm-m03', status: 'not_started', pct: 0, lessons: [] },
  ],
  next_lesson: null,
  blocked_reason: null,
  assessment_attempts: 0,
  issuance: null,
  ...over,
})

beforeEach(() => mockFetchProgress.mockReset())

describe('CtmProgramEntry', () => {
  it('assigned learner: asks Vault for THIS program with the existing client and shows progress + links', async () => {
    mockFetchProgress.mockResolvedValue(progress())
    render(<CtmProgramEntry role="agent" />)
    expect(await screen.findByTestId('ctm-entry')).toBeInTheDocument()
    expect(mockFetchProgress).toHaveBeenCalledWith(CTM_CERTIFICATION_ID)
    expect(screen.getByTestId('ctm-entry-summary')).toHaveTextContent('1 of 3 modules complete.')
    expect(screen.getByTestId('ctm-entry-open')).toHaveAttribute('href', 'https://vault.test/learning/hartfelt-real-estate-ctm-fl')
    expect(screen.getByTestId('ctm-entry-downloads')).toHaveAttribute('href', CTM_DOWNLOADS_HREF)
  })

  it('final passed but not yet approved: says it awaits the Broker of Record (eligibility, not certification)', async () => {
    mockFetchProgress.mockResolvedValue(progress({ status: 'completed' }))
    render(<CtmProgramEntry role="tc" />)
    expect(await screen.findByTestId('ctm-entry-summary')).toHaveTextContent('awaiting Broker of Record approval')
  })

  it('issued credential: shows certified', async () => {
    mockFetchProgress.mockResolvedValue(progress({ status: 'certified', issuance: { id: 'i', revoked_at: null } }))
    render(<CtmProgramEntry role="agent" />)
    expect(await screen.findByTestId('ctm-entry-summary')).toHaveTextContent('Certified by your Broker of Record.')
  })

  for (const [role, status] of [['agent', 403], ['new_agent', 404], ['office_manager', 403], ['admin', 403]] as const) {
    it(`${role} refused by Vault (${status}: draft / unassigned / denied) sees nothing`, async () => {
      mockFetchProgress.mockRejectedValue(new CertApiError(status))
      const { container } = render(<CtmProgramEntry role={role} />)
      await waitFor(() => expect(mockFetchProgress).toHaveBeenCalled())
      await waitFor(() => expect(container).toBeEmptyDOMElement())
      expect(screen.queryByTestId('ctm-entry')).toBeNull()
    })
  }

  it('broker: DRAFT preview pointer to the Vault broker Training Preview; no learner fetch', () => {
    render(<CtmProgramEntry role="broker" />)
    const card = screen.getByTestId('ctm-entry-broker-preview')
    expect(card).toHaveTextContent('DRAFT — PENDING BROKER APPROVAL')
    expect(screen.getByText('Review in Vault').closest('a')).toHaveAttribute('href', 'https://vault.test/broker-training-preview')
    expect(mockFetchProgress).not.toHaveBeenCalled()
  })
})
