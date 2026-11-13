// CTM-1 — Agent Portal entry: renders only when Vault's learner gate admits the
// learner, fails closed otherwise, and gives the broker a DRAFT preview pointer.
//
// The REAL client (src/portal/training/certified/api.ts) runs here; only the
// session token and the network (`fetch`) are faked. Vault's responses below are
// the ones its real route handlers give, proven in Vault's
// programs/ctm/__tests__/ctm-draft-gate-routes.test.ts: a draft CTM answers
// 404 {code:"unknown_certification"} to every non-broker. (CTM-1 lesson: an
// earlier version mocked fetchProgress with a refusal production never gave.)
import { render, screen, waitFor } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ getAccessToken: async () => 'agent-token' }))
jest.mock('@/lib/vault-client', () => ({ VAULT_BASE_URL: 'https://vault.test' }))

const vaultResponses: { status: number; body: unknown }[] = []
const mockFetch = jest.fn(async (url: string, init: RequestInit) => {
  const r = vaultResponses.shift() ?? { status: 500, body: {} }
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    statusText: String(r.status),
    json: async () => r.body,
  } as unknown as Response
})
;(global as unknown as { fetch: typeof mockFetch }).fetch = mockFetch
const mockFetchProgress = { mockResolvedValue: (v: unknown) => vaultResponses.push({ status: 200, body: v }) }
const VAULT_DRAFT_REFUSAL = { error: "You don't have access to this training.", code: 'unknown_certification' }

import {
  CtmProgramEntry,
  CTM_CERTIFICATION_ID,
  CTM_DOWNLOADS_HREF,
} from '../CtmProgramEntry'

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

beforeEach(() => { vaultResponses.length = 0; mockFetch.mockClear() })

describe('CtmProgramEntry', () => {
  it('assigned learner: asks Vault for THIS program with the existing client and shows progress + links', async () => {
    mockFetchProgress.mockResolvedValue(progress())
    render(<CtmProgramEntry role="agent" />)
    expect(await screen.findByTestId('ctm-entry')).toBeInTheDocument()
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/platform\/certifications\/hartfelt-real-estate-ctm-fl\/progress$/)
    expect((mockFetch.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer agent-token')
    expect(screen.getByTestId('ctm-entry-summary')).toHaveTextContent('1 of 3 modules complete.')
    // Continue training stays in the Agent Portal (agents have no interactive Vault access)
    expect(screen.getByTestId('ctm-entry-open')).toHaveAttribute('href', '/training/certified/ctm-m01?program=hartfelt-real-estate-ctm-fl')
    expect(screen.getByTestId('ctm-entry-open').getAttribute('href')).not.toMatch(/learning|vault/)
    expect(screen.getByTestId('ctm-entry-downloads')).toHaveAttribute('href', CTM_DOWNLOADS_HREF)
  })

  it('Continue training goes to the next lesson Vault names, inside the Agent Portal', async () => {
    mockFetchProgress.mockResolvedValue(progress({ next_lesson: { track_id: 'ctm-m03', module_id: 'ctm-m03', lesson_id: 'ctm-l0302' } }))
    render(<CtmProgramEntry role="agent" />)
    expect(await screen.findByTestId('ctm-entry-open')).toHaveAttribute(
      'href',
      '/training/certified/ctm-m03/ctm-l0302?program=hartfelt-real-estate-ctm-fl',
    )
  })

  it('exam lesson completed while Vault status is still in_progress → awaiting approval (not "N of 18")', async () => {
    mockFetchProgress.mockResolvedValue(progress({
      status: 'in_progress',
      tracks: [{ module_id: 'ctm-m17', status: 'completed', pct: 1, lessons: [{ lesson_id: 'ctm-l1701', status: 'completed' }] }],
    }))
    render(<CtmProgramEntry role="agent" />)
    expect(await screen.findByTestId('ctm-entry-summary')).toHaveTextContent('awaiting Broker of Record approval')
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

  for (const role of ['agent', 'new_agent', 'tc', 'office_manager', 'admin'] as const) {
    it(`${role}: Vault refuses the DRAFT program (404 unknown_certification) → sees nothing`, async () => {
      vaultResponses.push({ status: 404, body: VAULT_DRAFT_REFUSAL })
      const { container } = render(<CtmProgramEntry role={role} />)
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      await waitFor(() => expect(container).toBeEmptyDOMElement())
      expect(screen.queryByTestId('ctm-entry')).toBeNull()
    })
  }

  it('Vault 401 (no session) and a network failure both fail closed', async () => {
    vaultResponses.push({ status: 401, body: { error: 'Unauthorized' } })
    const a = render(<CtmProgramEntry role="agent" />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(a.container).toBeEmptyDOMElement())
    a.unmount()
    mockFetch.mockImplementationOnce(async () => { throw new Error('offline') })
    const b = render(<CtmProgramEntry role="agent" />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(b.container).toBeEmptyDOMElement())
  })

  it('broker: DRAFT preview pointer to the Vault broker Training Preview; no learner fetch', () => {
    render(<CtmProgramEntry role="broker" />)
    const card = screen.getByTestId('ctm-entry-broker-preview')
    expect(card).toHaveTextContent('DRAFT — PENDING BROKER APPROVAL')
    expect(screen.getByText('Review in Vault').closest('a')).toHaveAttribute('href', 'https://vault.test/broker-training-preview')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
