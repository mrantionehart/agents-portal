/**
 * @jest-environment node
 */
// D6 — the Module 14 quiz is refused (409) until the caller completed all six
// reading lessons; the progress read is scoped to the CALLER; modules without
// reading lessons are unaffected. The database enforces the same rule
// (Vault m14-reading-lessons.pg.test.ts).
const quizInserts: any[] = []
const eqCalls: Record<string, [string, unknown][]> = {}
let lessons: any[] = []
let completed: string[] = []

function chain(table: string): any {
  const c: any = {}
  eqCalls[table] ??= []
  for (const m of ['select', 'in', 'is', 'order']) c[m] = jest.fn(() => c)
  c.eq = jest.fn((k: string, v: unknown) => { eqCalls[table].push([k, v]); return c })
  c.insert = jest.fn(async (p: any) => { if (table === 'training_quiz_results') quizInserts.push(p); return { data: null, error: null } })
  c.update = jest.fn(() => c)
  c.maybeSingle = jest.fn(async () => {
    if (table === 'training_modules') return { data: { required_role: null }, error: null }
    if (table === 'profiles') return { data: { role: 'agent' }, error: null }
    return { data: null, error: null }
  })
  c.then = (res: any, rej: any) => {
    let data: any = null
    if (table === 'training_videos') data = lessons
    if (table === 'training_video_progress') data = completed.map((id) => ({ video_id: id, completed: true }))
    return Promise.resolve({ count: 0, data, error: null }).then(res, rej)
  }
  return c
}
const client = { from: jest.fn((t: string) => chain(t)) }
jest.mock('@/lib/security', () => ({
  requireAuth: jest.fn(async () => ({ user: { id: 'agent-1', email: 'a@example.com' } })),
  userClient: jest.fn(() => client),
  adminClient: jest.fn(() => client),
}))

import { POST } from '@/app/api/training/quiz/route'
import { getQuizForModule } from '@/app/data/quizzes'

const M14 = ['1', '2', '3', '4', '5', '6'].map((n) => ({ id: `v_v1_14_${n}`, body_markdown: '## Lesson\n\nText.', certification_id: null }))
const quiz = getQuizForModule(1, 14)!
const withCorrect = (n: number) =>
  Object.fromEntries(quiz.questions.map((q, i) => [q.id, i < n ? q.correct : (['a', 'b', 'c', 'd'].find((o) => o !== q.correct) as string)]))
const req = (body: unknown): any => ({ json: async () => body, headers: { get: () => null } })

beforeEach(() => {
  quizInserts.length = 0
  for (const k of Object.keys(eqCalls)) delete eqCalls[k]
  lessons = M14
  completed = []
  ;(global as any).fetch = jest.fn()
  delete process.env.SENDGRID_API_KEY
})

describe('Module 14 quiz requires its reading lessons', () => {
  it('no lessons read → 409 lessons_incomplete, nothing written', async () => {
    const res = await POST(req({ volume: 1, module_num: 14, answers: withCorrect(12) }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ reason: 'lessons_incomplete', done: 0, required: 6 })
    expect(quizInserts).toHaveLength(0)
  })
  it('five of six → still 409', async () => {
    completed = M14.slice(0, 5).map((l) => l.id)
    const res = await POST(req({ volume: 1, module_num: 14, answers: withCorrect(12) }))
    expect(res.status).toBe(409)
    expect((await res.json()).done).toBe(5)
  })
  it('progress is read for the CALLER only', async () => {
    await POST(req({ volume: 1, module_num: 14, answers: withCorrect(12) }))
    expect(eqCalls['training_video_progress']).toContainEqual(['user_id', 'agent-1'])
  })
  it('all six read: 10/12 passes (83), 9/12 fails (75)', async () => {
    completed = M14.map((l) => l.id)
    const pass = await POST(req({ volume: 1, module_num: 14, answers: withCorrect(10) }))
    expect(pass.status).toBe(200)
    expect(await pass.json()).toMatchObject({ score: 83, passed: true })
    const fail = await POST(req({ volume: 1, module_num: 14, answers: withCorrect(9) }))
    expect(await fail.json()).toMatchObject({ score: 75, passed: false })
  })
  it('a video-only module (every existing course) is unaffected', async () => {
    lessons = [{ id: 'v_v1_1_1', body_markdown: null, certification_id: null }]
    const q1 = getQuizForModule(1, 1)!
    const res = await POST(req({ volume: 1, module_num: 1, answers: Object.fromEntries(q1.questions.map((q) => [q.id, q.correct])) }))
    expect(res.status).toBe(200)
    expect(quizInserts).toHaveLength(1)
  })
})
