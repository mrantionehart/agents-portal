// CTM — Broker Agent View: the Broker of Record previews every CTM lesson, simulation,
// module quiz and the final exam in the Agent Portal as agents see them. Sequential
// locks are lifted for the broker; every write control is replaced by a notice, so the
// preview sends ONLY reads (Vault's CTM gate refuses a broker write without an assignment).
// Same fake Vault as ctm-certified-track.test.tsx; only the role differs.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ getAccessToken: async () => 'agent-token' }))
const mockRole = { value: 'broker' as string }
jest.mock('@/app/providers', () => ({
  useAuth: () => ({ user: { id: 'agent-1', email: 'agent@uat.hartfelt.invalid' }, role: mockRole.value }),
}))
jest.mock('@/src/portal/tour/TourProvider', () => ({ useTour: () => ({ start: jest.fn() }) }))
const mockSearch = new URLSearchParams()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => mockSearch,
}))

import CertifiedTrackClient from '../CertifiedTrackClient'
import UnifiedLessonClient from '../UnifiedLessonClient'
import QuizPageClient from '../quiz/QuizPageClient'
import QuizLauncher from '../activities/QuizLauncher'
import { resolveProgramParam } from '../program'
import { CTM_CERTIFICATION_ID, HARTFELT_PLATFORM_CERTIFIED_ID } from '../types'

const CTM = CTM_CERTIFICATION_ID

const lesson = (id: string, module_id: string, requirements: string[], prerequisite: string | null, title: string) => ({
  id, module_id, video_num: id, sort_order: 1, title, description: null, objective_md: null, duration_seconds: null,
  practical_attestation_type: 'none', requires_quiz: requirements.includes('quiz'), quiz_id: null, related_route: null,
  prerequisite_lesson_id: prerequisite, media_status: 'ok', has_media: false, system: 'portal',
  requirements, session_ui_spec: null, practical_ui_spec: null,
})
const track = (id: string, title: string, lessons: unknown[]) => ({
  id, module_num: 1, sort_order: 1, title, description: null, status: 'published', requires_recert: false, version: '1.0.0', lessons,
})
const CATALOG = {
  certification_id: CTM,
  version: '1.0.0',
  tracks: [
    track('ctm-m01', 'Residential Buyer Transactions & Closings', [
      lesson('ctm-l0101', 'ctm-m01', ['acknowledgement'], null, 'Buyer transactions: overview'),
      lesson('ctm-l0109', 'ctm-m01', ['quiz'], 'ctm-l0101', 'Module 1 quiz'),
    ]),
    track('ctm-m17', 'Certification Exam', [lesson('ctm-l1701', 'ctm-m17', ['quiz'], null, 'Certification Exam')]),
    track('ctm-m18', 'Broker of Record Certification Approval', [lesson('ctm-l1801', 'ctm-m18', [], 'ctm-l1701', 'Broker of Record Certification Approval')]),
  ],
}

type LessonState = { status: string; quiz_passed: boolean | null }
const V = {
  open: true, // false => Vault's CTM gate refuses (draft / unassigned)
  lessons: {} as Record<string, LessonState>,
  calls: [] as { method: string; path: string; body: unknown; auth: string | null }[],
  attemptPassed: true,
}
function progress() {
  return {
    certification_id: CTM, version: '1.0.0', status: 'in_progress', blocked_reason: null, assessment_attempts: 0, issuance: null,
    last_updated_at: '2026-11-13T00:00:00Z',
    next_lesson: { track_id: 'ctm-m01', module_id: 'ctm-m01', lesson_id: 'ctm-l0101' },
    tracks: CATALOG.tracks.map((t) => ({
      module_id: t.id, status: 'in_progress', pct: 0,
      lessons: (t.lessons as { id: string }[]).map((l) => ({
        lesson_id: l.id, watched_seconds: 0, watched_pct: 0, attested_at: null,
        status: V.lessons[l.id]?.status ?? 'not_started', quiz_passed: V.lessons[l.id]?.quiz_passed ?? null,
      })),
    })),
  }
}
const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => body }) as unknown as Response
const REFUSED = { error: "You don't have access to this training.", code: 'unknown_certification' }

const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
  const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '')
  const method = init?.method ?? 'GET'
  const body = init?.body ? JSON.parse(String(init.body)) : undefined
  V.calls.push({ method, path, body, auth: (init?.headers as Record<string, string>)?.Authorization ?? null })
  const m = /^\/platform\/certifications\/([^/]+)\/(.*)$/.exec(path)
  if (!m) return json(404, {})
  const [, cert, rest] = m
  if (cert === CTM && !V.open) return json(404, REFUSED)
  if (rest === 'catalog') return json(200, cert === CTM ? CATALOG : { ...CATALOG, certification_id: cert })
  if (rest === 'progress') return json(200, progress())
  let r = /^lessons\/([^/]+)\/content$/.exec(rest)
  if (r) return json(200, {
    lesson_id: r[1], certification_id: CTM, title: 'Buyer transactions: overview', objective: 'Explain the buyer timeline.',
    blocks: [
      { kind: 'callout', variant: 'policy', title: 'DRAFT — PENDING BROKER APPROVAL', text: 'Training only.' },
      { kind: 'heading', text: 'The buyer timeline' },
      { kind: 'paragraph', text: [{ text: 'Effective date ', style: 'bold' }, { text: 'starts every deadline.' }] },
      { kind: 'table', headers: ['Day', 'Event'], rows: [['0', 'Effective date'], ['3', 'Escrow deposit due']] },
    ],
  })
  r = /^lessons\/([^/]+)\/complete$/.exec(rest)
  if (r && method === 'POST') {
    V.lessons[r[1]] = { status: 'completed', quiz_passed: null }
    return json(200, { ok: true, lesson_id: r[1], status: 'completed' })
  }
  r = /^lessons\/([^/]+)\/quiz$/.exec(rest)
  if (r) return json(200, {
    mode: 'learner',
    quiz: {
      quizId: 'hartfelt-ctm-fl.certification-exam.v1', quizVersion: '1.0.0', title: 'Certification Exam', instructions: null,
      passingRule: { kind: 'percentage_threshold', thresholdPercent: 85 },
      retryPolicy: { maxAttempts: 3, attemptCountScope: 'per_certification_version', passIsPermanentForCertVersion: true, revealAnswersAfterAttempt: false },
      questions: [{ id: 'q1', kind: 'single', prompt: 'Who approves CTM certification?', options: [{ id: 'a', label: 'The agent' }, { id: 'b', label: 'The Broker of Record' }] }],
    },
  })
  r = /^lessons\/([^/]+)\/quiz\/attempt$/.exec(rest)
  if (r && method === 'POST') return json(200, {
    status: 'graded',
    certification_issuance: null, // CTM: Vault never issues on the exam
    result: { attempt_id: 'att-1', quizId: body.quiz_id, quizVersion: body.quiz_version, totalCount: 1, correctCount: 1,
      scorePercent: 100, passed: V.attemptPassed, attemptNumber: 1, attemptsRemaining: 2, outcome: V.attemptPassed ? 'passed' : 'failed' },
  })
  return json(404, {})
})
;(global as unknown as { fetch: typeof fetchMock }).fetch = fetchMock

beforeEach(() => {
  V.open = true
  V.lessons = {}
  V.calls = []
  V.attemptPassed = true
  fetchMock.mockClear()
  for (const k of [...mockSearch.keys()]) mockSearch.delete(k)
})

const writes = () => V.calls.filter((c) => c.method !== 'GET')

describe('Broker Agent View · CTM preview', () => {
  beforeEach(() => { mockRole.value = 'broker' })

  it('track page: a lesson locked for an agent opens for the broker', async () => {
    render(<CertifiedTrackClient certificationId={CTM} trackId="ctm-m01" />)
    expect(await screen.findByText('Module 1 quiz')).toBeInTheDocument()
    expect(screen.queryByText('Locked')).toBeNull()
  })

  it('reading lesson / simulation: content renders, no completion button, nothing written', async () => {
    render(<UnifiedLessonClient certificationId={CTM} trackId="ctm-m01" lessonId="ctm-l0101" />)
    expect(await screen.findByText('The buyer timeline')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark complete/i })).toBeNull()
    expect(screen.getAllByTestId('ctm-broker-preview-notice').length).toBeGreaterThan(0)
    expect(writes()).toEqual([])
  })

  it('a prerequisite-locked quiz lesson opens for the broker', async () => {
    render(<UnifiedLessonClient certificationId={CTM} trackId="ctm-m01" lessonId="ctm-l0109" />)
    await waitFor(() => expect(document.querySelector('[data-cert-requirement-blocks]')).not.toBeNull())
    expect(screen.queryByText(/complete .* first|Locked/i)).toBeNull()
  })

  it('quiz / final exam: every question and option renders; there is no submit and no attempt is sent', async () => {
    mockSearch.set('lesson', 'ctm-l1701')
    mockSearch.set('program', CTM)
    render(<QuizPageClient />)
    fireEvent.click(await screen.findByText('The Broker of Record'))
    expect(screen.queryByRole('button', { name: /Submit quiz/ })).toBeNull()
    expect(screen.getByTestId('ctm-broker-preview-notice')).toHaveTextContent('no attempt is used')
    expect(writes()).toEqual([])
  })

  it('an agent still sees the lock and the submit button (preview is broker-only)', async () => {
    mockRole.value = 'agent'
    render(<UnifiedLessonClient certificationId={CTM} trackId="ctm-m01" lessonId="ctm-l0109" />)
    await screen.findByText('Module 1 quiz')
    expect(document.querySelector('[data-cert-requirement-blocks]')).toBeNull()
    expect(screen.queryByTestId('ctm-broker-preview-notice')).toBeNull()
  })

  it('admin and office_manager get no preview (role-exact broker)', async () => {
    for (const role of ['admin', 'office_manager']) {
      mockRole.value = role
      const r = render(<UnifiedLessonClient certificationId={CTM} trackId="ctm-m01" lessonId="ctm-l0101" />)
      await screen.findByText('The buyer timeline')
      expect(screen.getByRole('button', { name: /mark complete/i })).toBeInTheDocument()
      r.unmount()
    }
  })
})
