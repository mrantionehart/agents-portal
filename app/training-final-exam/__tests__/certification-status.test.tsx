// ============================================================================
// HR-WORKFLOW-3 / HR-E2E-1 — what the agent SEES across the HartFelt Ready
// workflow: progress, the result of the final, and certification status.
// Both real surfaces are mounted: the Training Hub card and the final page.
// ============================================================================
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import FinalExamPage from '../page'
import { FinalExamEntry } from '@/src/portal/training/FinalExamEntry'

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

const base = {
  eligibility: { baseCap: 3, extraGranted: 0, effectiveCap: 3, attemptsUsed: 0, attemptsRemaining: 3, mayAttempt: true, passed: false, needsBrokerGrant: false },
  quiz_id: 'hartfelt-ready.comprehensive-final', quiz_version: '1.1.0', pass_score: 85,
  unlocked: true, lock_reason: null, required_modules: 26, passed_modules: 26, missing_modules: [],
  final_exam: { attempted: false, bestScore: null, passed: false, attemptCount: 0 },
  hartfelt_ready_complete: false, summary: '26 of 26 modules passed.',
  quiz: { title: 'Final', instructions: 'Answer every question.', questions: [{ id: 'q1', prompt: 'Q one?', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }] },
}
const passed = { ...base, eligibility: { ...base.eligibility, attemptsUsed: 1, attemptsRemaining: 2, passed: true }, final_exam: { attempted: true, bestScore: 88, passed: true, attemptCount: 1 }, hartfelt_ready_complete: true }

let getBody: unknown
let postBody: unknown
beforeEach(() => {
  global.fetch = jest.fn(async (_u: string, init?: RequestInit) =>
    ({ ok: true, status: 200, json: async () => (init?.method === 'POST' ? postBody : getBody) }) as Response,
  ) as unknown as typeof fetch
})

describe('Training Hub card + final page show certification status', () => {
  it('locked: progress X of 26 and what is outstanding', async () => {
    getBody = { ...base, unlocked: false, passed_modules: 24, missing_modules: [{ volume: 2, moduleNum: 9, title: 'Deal Structuring' }], quiz: null }
    render(<FinalExamPage />)
    expect(await screen.findByText(/24 of 26 so far/)).toBeInTheDocument()
    expect(screen.getByText(/Volume 2, Module 9 — Deal Structuring/)).toBeInTheDocument()
  })

  it('awaiting broker after a pass — on the card and the page', async () => {
    getBody = { ...passed, certification: { status: 'awaiting_broker', certified_at: null, changes_requested: null } }
    render(<FinalExamEntry />)
    expect(await screen.findByText('Passed at 88%.')).toBeInTheDocument()
    expect(screen.getByTestId('hr-cert-status')).toHaveTextContent('Awaiting your Broker of Record’s approval')
    render(<FinalExamPage />)
    expect(await screen.findByText(/Awaiting your Broker of Record’s approval to certify/)).toBeInTheDocument()
  })

  it('changes requested shows the broker’s note', async () => {
    getBody = { ...passed, certification: { status: 'changes_requested', certified_at: null, changes_requested: { at: '2026-11-12T10:00:00Z', note: 'Re-review the disclosure module.' } } }
    render(<FinalExamEntry />)
    expect(await screen.findByTestId('hr-cert-status')).toHaveTextContent('requested changes before certifying: Re-review the disclosure module.')
  })

  it('certified shows the date the Broker of Record certified', async () => {
    getBody = { ...passed, certification: { status: 'certified', certified_at: '2026-11-12T16:00:00Z', changes_requested: null } }
    render(<FinalExamPage />)
    expect(await screen.findByText(/HartFelt Ready™ Certified on November 12, 2026 by your Broker of Record/)).toBeInTheDocument()
  })

  it('in progress / older Vault response: no certification claim is made', async () => {
    getBody = { ...base }
    render(<FinalExamEntry />)
    expect(await screen.findByText(/Unlocked — 85% to pass/)).toBeInTheDocument()
    expect(screen.queryByTestId('hr-cert-status')).toBeNull()
  })

  it('a paper at 98% that missed a critical question reads as a compliance fail, not a score fail', async () => {
    getBody = base
    postBody = { kind: 'graded', pass_score: 85, result: { scorePercent: 98, passed: false } }
    render(<FinalExamPage />)
    fireEvent.click(await screen.findByRole('radio', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit final exam' }))
    expect(await screen.findByText(/Not passed — 98%/)).toBeInTheDocument()
    expect(screen.getByText(/required compliance question was answered incorrectly/)).toBeInTheDocument()
  })

  it('out of attempts: told to speak to the Broker of Record; no paper', async () => {
    getBody = { ...base, eligibility: { ...base.eligibility, attemptsUsed: 3, attemptsRemaining: 0, mayAttempt: false, needsBrokerGrant: true }, final_exam: { attempted: true, bestScore: 80, passed: false, attemptCount: 3 } }
    render(<FinalExamPage />)
    expect(await screen.findByText(/You have used all/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit final exam' })).toBeNull()
  })
})
