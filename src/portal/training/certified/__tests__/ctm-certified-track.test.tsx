// CTM-1 — agents take Closing & Transaction Management in the Agent Portal's
// EXISTING certified-track pages (never Vault /learning).
//
// The REAL client (certified/api.ts) runs: only the session token and `fetch`
// are faked. The fake Vault answers in the shapes Vault's real routes return
// (registry catalog, progress, lesson content, acknowledgement completion,
// learner-safe quiz, quiz attempt) and REFUSES exactly as Vault's CTM gate does
// (404 unknown_certification) when the program is not open to the caller.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ getAccessToken: async () => 'agent-token' }))
jest.mock('@/app/providers', () => ({
  useAuth: () => ({ user: { id: 'agent-1', email: 'agent@uat.hartfelt.invalid' }, role: 'agent' }),
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

describe('program selector is allowlisted', () => {
  it('no param → platform; CTM → CTM; anything else → null (fail closed)', () => {
    expect(resolveProgramParam(undefined)).toBe(HARTFELT_PLATFORM_CERTIFIED_ID)
    expect(resolveProgramParam(CTM)).toBe(CTM)
    expect(resolveProgramParam('hartfelt-real-estate-bpo-fl-certified')).toBeNull()
    expect(resolveProgramParam('../../etc')).toBeNull()
  })
})

describe('CTM track page (existing certified-track renderer)', () => {
  it('reads CTM catalog + progress with the learner session and links lessons inside the Agent Portal', async () => {
    render(<CertifiedTrackClient certificationId={CTM} trackId="ctm-m01" />)
    expect(await screen.findByText('Residential Buyer Transactions & Closings')).toBeInTheDocument()
    const link = screen.getByText('Buyer transactions: overview').closest('a')
    expect(link).toHaveAttribute('href', `/training/certified/ctm-m01/ctm-l0101?program=${CTM}`)
    expect(V.calls.map((c) => c.path)).toEqual(expect.arrayContaining([`/platform/certifications/${CTM}/catalog`, `/platform/certifications/${CTM}/progress`]))
    expect(V.calls.every((c) => c.auth === 'Bearer agent-token')).toBe(true)
    // The quiz lesson is locked until the reading lesson is complete.
    expect(screen.getByText('Module 1 quiz').closest('a')).toBeNull()
  })

  it('draft or unassigned (Vault 404) → "not available", no lesson list, no further calls', async () => {
    V.open = false
    render(<CertifiedTrackClient certificationId={CTM} trackId="ctm-m01" />)
    expect(await screen.findByText('This training is not available to you.')).toBeInTheDocument()
    expect(screen.queryByText('Buyer transactions: overview')).toBeNull()
    expect(V.calls.filter((c) => /content|quiz/.test(c.path))).toHaveLength(0)
  })

  it('platform certification is unchanged: no program → platform endpoints, links without ?program', async () => {
    render(<CertifiedTrackClient trackId="ctm-m01" />)
    await screen.findByText('Residential Buyer Transactions & Closings')
    expect(V.calls[0].path).toBe(`/platform/certifications/${HARTFELT_PLATFORM_CERTIFIED_ID}/catalog`)
    expect(screen.getByText('Buyer transactions: overview').closest('a')).toHaveAttribute('href', '/training/certified/ctm-m01/ctm-l0101')
  })
})

describe('CTM reading lesson — read, acknowledge, progress persists through Vault', () => {
  it('renders the lesson prose and records completion with { acknowledgement: true }', async () => {
    render(<UnifiedLessonClient certificationId={CTM} trackId="ctm-m01" lessonId="ctm-l0101" />)
    expect(await screen.findByText('The buyer timeline')).toBeInTheDocument()
    expect(screen.getByText('DRAFT — PENDING BROKER APPROVAL')).toBeInTheDocument()
    expect(screen.getByText('Escrow deposit due')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mark complete/i }))
    await waitFor(() => expect(document.querySelector('[data-cert-acknowledged]')).not.toBeNull())
    const post = V.calls.find((c) => c.method === 'POST')!
    expect(post.path).toBe(`/platform/certifications/${CTM}/lessons/ctm-l0101/complete`)
    expect(post.body).toEqual({ acknowledgement: true })
    // Completion shown came from Vault's re-read progress, not local state.
    expect(V.calls.filter((c) => c.path.endsWith('/progress')).length).toBeGreaterThanOrEqual(2)
  })

  it('refused by Vault → no content and no completion button', async () => {
    V.open = false
    render(<UnifiedLessonClient certificationId={CTM} trackId="ctm-m01" lessonId="ctm-l0101" />)
    expect(await screen.findByText('This training is not available to you.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark complete/i })).toBeNull()
    expect(V.calls.filter((c) => c.path.endsWith('/content'))).toHaveLength(0)
  })

  it('the Broker of Record approval lesson offers the learner nothing to submit', async () => {
    V.lessons['ctm-l1701'] = { status: 'completed', quiz_passed: true }
    render(<UnifiedLessonClient certificationId={CTM} trackId="ctm-m18" lessonId="ctm-l1801" />)
    expect(await screen.findByText(/Your Broker of Record reviews your results and approves certification/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('CTM quizzes and the certification exam', () => {
  it('quiz links stay in the Agent Portal and carry the program', () => {
    render(<QuizLauncher certificationId={CTM} lessonId="ctm-l0109" />)
    expect(screen.getByText('Take the quiz').closest('a')).toHaveAttribute('href', `/training/quiz?lesson=ctm-l0109&program=${CTM}`)
  })

  it('the exam launcher says passing makes you ELIGIBLE, not certified', () => {
    render(<QuizLauncher certificationId={CTM} lessonId="ctm-l1701" />)
    expect(screen.getByText(/Passing makes you eligible; your Broker of Record approves certification/)).toBeInTheDocument()
    expect(screen.queryByText(/issues your/)).toBeNull()
  })

  it('a passing exam submits to the CTM attempt route and shows eligibility only — no credential', async () => {
    mockSearch.set('lesson', 'ctm-l1701')
    mockSearch.set('program', CTM)
    render(<QuizPageClient />)
    fireEvent.click(await screen.findByText('The Broker of Record'))
    fireEvent.click(screen.getByRole('button', { name: /Submit quiz/ }))
    expect(await screen.findByText('Eligible for certification')).toBeInTheDocument()
    expect(screen.getByText(/You are not certified yet/)).toBeInTheDocument()
    expect(document.querySelector('[data-cert-issuance-block]')).toBeNull()
    const attempt = V.calls.find((c) => c.method === 'POST')!
    expect(attempt.path).toBe(`/platform/certifications/${CTM}/lessons/ctm-l1701/quiz/attempt`)
    expect(attempt.body).toMatchObject({ quiz_id: 'hartfelt-ctm-fl.certification-exam.v1', quiz_version: '1.0.0', answers: { q1: 'b' } })
  })

  it('an unknown ?program= never loads a quiz', async () => {
    mockSearch.set('lesson', 'ctm-l1701')
    mockSearch.set('program', 'hartfelt-real-estate-bpo-fl-certified')
    render(<QuizPageClient />)
    expect(await screen.findByText(/This training is not available/)).toBeInTheDocument()
    expect(V.calls).toHaveLength(0)
  })
})
