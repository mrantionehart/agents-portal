// ============================================================================
// DEVINTEL-P12A — submitting research, and reading the broker back
// ============================================================================
// 🔒 UX-DONE-1: these mount the real component, click the real buttons and
// assert on the request that actually left `authFetch` — including the ones
// that must not leave. A grep proving `submit-research` exists would prove
// only that the string exists.
//
// The claims that matter:
//   · the submit sends NO findings — Vault snapshots the saved row, so an
//     agent cannot submit notes that were never saved;
//   · a source goes as `addSource`, never as a whole `evidence_refs` array;
//   · an agent has no way to record a verdict on their own submission;
//   · when the broker asks for changes, the agent can read what was asked and
//     submit a revision.
//
// Jest, not vitest — AP runs `jest` and has no vitest config.
// ============================================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

import DeveloperOpportunities from '@/src/portal/developer-opportunities/DeveloperOpportunities'

const OPP = 'opp-1'
const SUB1 = 'sub-1'
const SUB2 = 'sub-2'

const task = (id: string, done = false) => ({ id, label: `Do ${id}`, why: `because ${id}`, settled: null, done })
const claim = (confidence: string) => ({ confidence, value: null, note: null, url: null, checked: [] })

const detail = (sources: Array<{ label: string; url: string }> = []) => ({
  derived: {
    checklist: [task('contact', true), task('developer'), task('representation'), task('permits'), task('inventory')],
    progress: { done: 1, total: 5 },
    nextAction: { label: 'Work the research tasks', because: 'Research is approved.', gate: null, brokerOnly: false },
    representation: claim('UNKNOWN'),
    developer: { name: 'EPIC DEVELOPMENTS LLC', status: claim('VERIFIED'), url: null },
    contact: claim('UNKNOWN'), inventory: claim('UNKNOWN'),
    sources,
    pursuitStrategy: claim('UNKNOWN'),
  },
  opportunity: {
    id: OPP, opportunity_type: 'EXCLUSIVE_LISTING', stage: 'research', score: 104,
    assigned_agent_id: 'agent-1', assigned_at: '2026-10-22T09:00:00Z',
    research_notes: 'Sunbiz shows Zvi Yosifon as manager.', evidence_refs: [],
  },
  projects: [{
    id: 'p1', parcel_id: '0141150240310', project_name: null,
    addresses: ['1953 TIGERTAIL AV'], category: null, category_basis: null,
    tenure: null, max_total_sqft: null, zones: [], units: null, asset_class: null,
    acreage: null, link: { is_primary: true, link_basis: 'primary parcel' },
  }],
  filings: [], owners: [], approvals: [], followups: [],
  viewer: { isBrokerTier: false, userId: 'agent-1' },
})

const summary = {
  id: OPP, opportunity_type: 'EXCLUSIVE_LISTING', stage: 'research', score: 104,
  assigned_agent_id: 'agent-1', assigned_at: null, research_notes: null,
  created_at: '2026-10-22T09:00:00Z',
}

const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) })
const fail = (status: number, body: unknown) => ({ ok: false, status, text: async () => JSON.stringify(body) })

/** The reviews GET's answer, swapped per test. */
let log: Record<string, unknown>
/** What the submit POST answers. */
let submitAnswer: () => unknown
/** What the addSource PATCH answers. */
let sourceAnswer: () => unknown
let currentSources: Array<{ label: string; url: string }>

const submission = (over: Record<string, unknown> = {}) => ({
  id: SUB1, submitted_at: '2026-10-30T14:02:11.000Z', submitted_by: 'agent-1',
  tasks_done: 3, research_notes: 'Sunbiz shows Zvi Yosifon as manager.',
  evidence_snapshot: [], supersedes_submission_id: null, ...over,
})

beforeEach(() => {
  mockFetch.mockReset()
  currentSources = []
  log = { submissions: [], reviews: [], state: 'not_submitted', latestSubmissionId: null }
  submitAnswer = () => ok({ submission: { id: SUB1 }, supersedes: null })
  sourceAnswer = () => ok({ id: OPP, updated: ['evidence_refs'], source: { label: 'Sunbiz', url: 'https://sunbiz.org/x' } })
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const u = String(url)
    const method = init?.method ?? 'GET'
    if (u.includes('/research/reviews')) return ok(log)
    if (u.includes('/research/submit')) return submitAnswer()
    if (u.endsWith('/research') && method === 'PATCH') return sourceAnswer()
    if (/\/opportunities\/[^/?]+$/.test(u)) return ok(detail(currentSources))
    return ok({ opportunities: [summary], page: { size: 25, count: 1, nextCursor: null } })
  })
})

const writes = () => mockFetch.mock.calls.filter((c) => (c[1]?.method ?? 'GET') !== 'GET')
const submitPosts = () => mockFetch.mock.calls.filter((c) => String(c[0]).includes('/research/submit'))
const bodyOf = (c: unknown[]) => JSON.parse(String((c[1] as RequestInit | undefined)?.body ?? '{}'))

const mount = async () => {
  render(<DeveloperOpportunities />)
  await waitFor(() => expect(screen.getByTestId('submission')).toBeTruthy())
}

// ---------------------------------------------------------------------------

describe('[P12A-AP-1] the state the agent is in', () => {
  it('offers the submit when nothing has been sent', async () => {
    await mount()
    await waitFor(() => expect(screen.getByTestId('submission-state-not_submitted')).toBeTruthy())
    expect(screen.getByTestId('submission-state-not_submitted').textContent).toBe('NOT SUBMITTED')
    expect(screen.getByTestId('submit-research').textContent).toBe('Submit for broker review')
    expect(screen.queryByTestId('submit-unavailable')).toBeNull()
  })

  it('[CRITICAL] offers no second submit while a broker is reading the first', async () => {
    log = { submissions: [submission()], reviews: [], state: 'awaiting_review', latestSubmissionId: SUB1 }
    await mount()
    await waitFor(() => expect(screen.getByTestId('submission-state-awaiting_review')).toBeTruthy())
    expect(screen.getByTestId('submission-state-awaiting_review').textContent).toBe('PENDING REVIEW')
    expect(screen.queryByTestId('submit-research')).toBeNull()
    expect(screen.getByTestId('submit-unavailable').textContent).toContain('Waiting on your broker')
  })

  it('[CRITICAL] offers no submit once the research is accepted', async () => {
    log = {
      submissions: [submission()],
      reviews: [{ id: 'r1', submission_id: SUB1, decision: 'accepted', note: null, reviewed_by: 'broker', reviewed_at: '2026-10-30T15:00:00Z' }],
      state: 'accepted', latestSubmissionId: SUB1,
    }
    await mount()
    await waitFor(() => expect(screen.getByTestId('submission-state-accepted')).toBeTruthy())
    expect(screen.queryByTestId('submit-research')).toBeNull()
  })

  it('says plainly that an accepted research is not permission to make contact', async () => {
    log = {
      submissions: [submission()],
      reviews: [{ id: 'r1', submission_id: SUB1, decision: 'accepted', note: null, reviewed_by: 'broker', reviewed_at: '2026-10-30T15:00:00Z' }],
      state: 'accepted', latestSubmissionId: SUB1,
    }
    await mount()
    await waitFor(() => expect(screen.getByTestId('submission-explainer')).toBeTruthy())
    expect(screen.getByTestId('submission-explainer').textContent).toContain('OUTREACH')
  })
})

describe('[P12A-AP-2] submitting', () => {
  it('[CRITICAL] posts to research/submit with an EMPTY body', async () => {
    await mount()
    fireEvent.click(screen.getByTestId('submit-research'))
    await waitFor(() => expect(submitPosts()).toHaveLength(1))
    const call = submitPosts()[0]
    expect((call[1] as RequestInit).method).toBe('POST')
    expect(bodyOf(call)).toEqual({})
    // 🔒 Nothing the server would have to trust travels with it.
    const raw = String((call[1] as RequestInit).body)
    for (const f of ['research_notes', 'tasks_done', 'evidence', 'tenant', 'agent', 'stage']) {
      expect(raw.toLowerCase()).not.toContain(f.toLowerCase())
    }
  })

  it('[CRITICAL] submitting writes nothing else — no approval, no assignment, no notes save', async () => {
    await mount()
    fireEvent.click(screen.getByTestId('submit-research'))
    await waitFor(() => expect(submitPosts()).toHaveLength(1))
    for (const c of writes()) {
      const u = String(c[0])
      expect(u).not.toContain('/approvals')
      expect(u).not.toMatch(/\/assign\b/)
      expect(u).not.toContain('/notify-assignment')
      expect(u).not.toContain('/research/reviews')
    }
    // and exactly one write in total
    expect(writes()).toHaveLength(1)
  })

  it('re-reads the state afterwards rather than claiming success', async () => {
    await mount()
    log = { submissions: [submission()], reviews: [], state: 'awaiting_review', latestSubmissionId: SUB1 }
    fireEvent.click(screen.getByTestId('submit-research'))
    await waitFor(() => expect(screen.getByTestId('submission-state-awaiting_review')).toBeTruthy())
    expect(screen.queryByTestId('submit-research')).toBeNull()
  })

  it('[CRITICAL] a refusal shows the server\'s own reason and the state that exists', async () => {
    submitAnswer = () => fail(409, { error: 'That research is already awaiting review.', code: 'awaiting_review' })
    await mount()
    log = { submissions: [submission()], reviews: [], state: 'awaiting_review', latestSubmissionId: SUB1 }
    fireEvent.click(screen.getByTestId('submit-research'))
    await waitFor(() => expect(screen.getByTestId('detail-error').textContent).toContain('already awaiting review'))
    await waitFor(() => expect(screen.getByTestId('submission-state-awaiting_review')).toBeTruthy())
  })
})

describe('[P12A-AP-3] what the broker asked for, and the revision', () => {
  beforeEach(() => {
    log = {
      submissions: [submission()],
      reviews: [{
        id: 'r1', submission_id: SUB1, decision: 'changes_requested',
        note: 'Add a source independent of the owner record.',
        reviewed_by: 'broker', reviewed_at: '2026-10-30T15:00:00Z',
      }],
      state: 'changes_requested', latestSubmissionId: SUB1,
    }
  })

  it('[CRITICAL] shows the feedback the agent has to act on', async () => {
    await mount()
    await waitFor(() => expect(screen.getByTestId('broker-feedback')).toBeTruthy())
    expect(screen.getByTestId('broker-feedback-note').textContent)
      .toContain('independent of the owner record')
    expect(screen.getByTestId('submission-state-changes_requested').textContent).toBe('CHANGES REQUESTED')
  })

  it('offers a revision, and submitting it is the same empty POST', async () => {
    await mount()
    await waitFor(() => expect(screen.getByTestId('submit-research')).toBeTruthy())
    expect(screen.getByTestId('submit-research').textContent).toBe('Submit revision for review')
    fireEvent.click(screen.getByTestId('submit-research'))
    await waitFor(() => expect(submitPosts()).toHaveLength(1))
    expect(bodyOf(submitPosts()[0])).toEqual({})
  })

  it('[CRITICAL] the note shown is the OPEN submission\'s, not whichever review came first', async () => {
    // A revision that is itself sent back. Both submissions carry a
    // changes_requested review, and the array is ordered oldest-first — so
    // reading `reviews[0]` would print the superseded instruction and the
    // agent would act on the wrong one. The state gate hides that defect when
    // only ONE review exists, which is why this case is here.
    log = {
      submissions: [
        submission({ id: SUB2, submitted_at: '2026-10-30T16:00:00Z', supersedes_submission_id: SUB1 }),
        submission(),
      ],
      reviews: [
        { id: 'r1', submission_id: SUB1, decision: 'changes_requested',
          note: 'Add a source independent of the owner record.',
          reviewed_by: 'broker', reviewed_at: '2026-10-30T15:00:00Z' },
        { id: 'r2', submission_id: SUB2, decision: 'changes_requested',
          note: 'Now add the permit number.',
          reviewed_by: 'broker', reviewed_at: '2026-10-30T17:00:00Z' },
      ],
      state: 'changes_requested', latestSubmissionId: SUB2,
    }
    await mount()
    await waitFor(() => expect(screen.getByTestId('broker-feedback-note')).toBeTruthy())
    expect(screen.getByTestId('broker-feedback-note').textContent).toBe('Now add the permit number.')
    expect(screen.getByTestId('broker-feedback-note').textContent)
      .not.toContain('independent of the owner record')
  })

  it('[CRITICAL] an older verdict is not shown as outstanding once a revision replaced it', async () => {
    log = {
      submissions: [submission({ id: SUB2, submitted_at: '2026-10-30T16:00:00Z', supersedes_submission_id: SUB1 }), submission()],
      reviews: [{
        id: 'r1', submission_id: SUB1, decision: 'changes_requested',
        note: 'Add a source independent of the owner record.',
        reviewed_by: 'broker', reviewed_at: '2026-10-30T15:00:00Z',
      }],
      state: 'awaiting_review', latestSubmissionId: SUB2,
    }
    await mount()
    await waitFor(() => expect(screen.getByTestId('submission-state-awaiting_review')).toBeTruthy())
    // The old "changes requested" belongs to SUB1, which SUB2 replaced.
    expect(screen.queryByTestId('broker-feedback')).toBeNull()
    // It is still readable as history.
    fireEvent.click(screen.getByText(/Submission history/))
    expect(screen.getByTestId(`history-${SUB1}`).textContent).toContain('changes requested')
    expect(screen.getByTestId(`history-${SUB2}`).textContent).toContain('awaiting review')
  })
})

describe('[P12A-AP-4] source documents', () => {
  it('[CRITICAL] sends addSource with the label and url, and nothing else', async () => {
    await mount()
    fireEvent.change(screen.getByTestId('source-label'), { target: { value: 'Sunbiz officer record' } })
    fireEvent.change(screen.getByTestId('source-url'), { target: { value: ' https://sunbiz.org/officer/42 ' } })
    fireEvent.click(screen.getByTestId('add-source-button'))
    await waitFor(() => expect(writes()).toHaveLength(1))
    const c = writes()[0]
    expect(String(c[0])).toMatch(/\/research$/)
    expect((c[1] as RequestInit).method).toBe('PATCH')
    expect(bodyOf(c)).toEqual({
      addSource: { url: 'https://sunbiz.org/officer/42', label: 'Sunbiz officer record' },
    })
    // 🔒 never the whole array
    expect(String((c[1] as RequestInit).body)).not.toContain('evidence_refs')
  })

  it('a label is optional', async () => {
    await mount()
    fireEvent.change(screen.getByTestId('source-url'), { target: { value: 'https://bcpa.net/x' } })
    fireEvent.click(screen.getByTestId('add-source-button'))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(bodyOf(writes()[0])).toEqual({ addSource: { url: 'https://bcpa.net/x', label: '' } })
  })

  it('[CRITICAL] shows the server\'s refusal of a javascript: URL and keeps what was typed', async () => {
    // The rule is Vault's — this side must report its answer, not pre-judge it
    // and not silently drop the attempt.
    sourceAnswer = () => fail(400, { error: 'A source URL must be an http:// or https:// address.', code: 'url_not_http' })
    await mount()
    fireEvent.change(screen.getByTestId('source-url'), { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(screen.getByTestId('add-source-button'))
    await waitFor(() => expect(screen.getByTestId('source-error').textContent).toContain('http://'))
    expect((screen.getByTestId('source-url') as HTMLInputElement).value).toBe('javascript:alert(1)')
  })

  it('clears the boxes and re-reads the list on success', async () => {
    await mount()
    fireEvent.change(screen.getByTestId('source-label'), { target: { value: 'Sunbiz' } })
    fireEvent.change(screen.getByTestId('source-url'), { target: { value: 'https://sunbiz.org/x' } })
    currentSources = [{ label: 'Sunbiz', url: 'https://sunbiz.org/x' }]
    fireEvent.click(screen.getByTestId('add-source-button'))
    await waitFor(() => expect(screen.getByTestId('source-list')).toBeTruthy())
    expect((screen.getByTestId('source-url') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('source-label') as HTMLInputElement).value).toBe('')
    const a = screen.getByTestId('source-link') as HTMLAnchorElement
    expect(a.textContent).toBe('Sunbiz')
    expect(a.getAttribute('href')).toBe('https://sunbiz.org/x')
    expect(a.getAttribute('rel')).toContain('noopener')
  })

  it('[CRITICAL] the list is Vault\'s derived one — a javascript: ref never arrives as a link', async () => {
    // Vault's `readSourceRefs` drops it server-side, so the Portal is handed a
    // list that cannot contain one. This pins that the Portal renders THAT
    // list rather than parsing `evidence_refs` itself.
    currentSources = [{ label: 'BCPA folio', url: 'https://bcpa.net/folio/9' }]
    await mount()
    await waitFor(() => expect(screen.getByTestId('source-list')).toBeTruthy())
    expect(screen.getAllByTestId('source-link').map((e) => e.getAttribute('href')))
      .toEqual(['https://bcpa.net/folio/9'])
    expect(document.body.innerHTML).not.toContain('javascript:')
  })

  it('the button is unavailable until a URL is typed', async () => {
    await mount()
    expect((screen.getByTestId('add-source-button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('source-url'), { target: { value: 'https://x.test/a' } })
    expect((screen.getByTestId('add-source-button') as HTMLButtonElement).disabled).toBe(false)
    expect(writes()).toHaveLength(0)
  })

  it('says so when nothing has been recorded', async () => {
    await mount()
    await waitFor(() => expect(screen.getByTestId('source-list-empty')).toBeTruthy())
  })
})

describe('[P12A-AP-5] an agent cannot review their own work', () => {
  it('[CRITICAL] no accept or request-changes control exists on this surface', async () => {
    log = { submissions: [submission()], reviews: [], state: 'awaiting_review', latestSubmissionId: SUB1 }
    await mount()
    await waitFor(() => expect(screen.getByTestId('submission-state-awaiting_review')).toBeTruthy())
    const labels = screen.getAllByRole('button').map((b) => (b.textContent ?? '').toLowerCase())
    for (const l of labels) {
      expect(l).not.toContain('accept')
      expect(l).not.toContain('request changes')
      expect(l).not.toContain('approve')
      expect(l).not.toContain('reject')
    }
    expect(screen.queryByTestId('accept-research')).toBeNull()
    expect(screen.queryByTestId('request-changes')).toBeNull()
    expect(screen.queryByTestId('research-feedback')).toBeNull()
  })

  it('[CRITICAL] the reviews endpoint is only ever READ', async () => {
    log = { submissions: [submission()], reviews: [], state: 'awaiting_review', latestSubmissionId: SUB1 }
    await mount()
    const reviewCalls = mockFetch.mock.calls.filter((c) => String(c[0]).includes('/research/reviews'))
    expect(reviewCalls.length).toBeGreaterThan(0)
    for (const c of reviewCalls) expect(c[1]?.method ?? 'GET').toBe('GET')
  })
})
