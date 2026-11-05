/**
 * @jest-environment node
 */
// HR-PROGRESS-SECURITY — the training gate cannot be opened by client-written
// progress. Before: gateOpen = training_progress.completed_modules ⊇ 1..9, a
// row any learner can insert/update for themselves. After: the gate reads the
// learner's PASSED, gate-valid quiz rows (server- or database-graded).
type Row = Record<string, any>
let PROFILE: Row | null = null
let PROGRESS: Row[] = []
let QUIZ: Row[] = []
const tablesRead: string[] = []

function chain(table: string): any {
  const filters: [string, string, any][] = []
  const c: any = {}
  const rows = () => (table === 'training_progress' ? PROGRESS : table === 'training_quiz_results' ? QUIZ : [])
  const match = () => rows().filter((r) => filters.every(([k, kind, v]) => (kind === 'eq' ? r[k] === v : kind === 'is' ? (r[k] ?? null) === v : true)))
  c.select = jest.fn(() => c)
  c.eq = jest.fn((k: string, v: any) => (filters.push([k, 'eq', v]), c))
  c.is = jest.fn((k: string, v: any) => (filters.push([k, 'is', v]), c))
  c.single = jest.fn(async () => ({ data: table === 'profiles' ? PROFILE : null, error: null }))
  c.then = (res: any, rej: any) => { tablesRead.push(table); return Promise.resolve({ data: match(), error: null }).then(res, rej) }
  return c
}
jest.mock('@/lib/security', () => ({
  requireAuth: jest.fn(async () => ({ user: { id: 'u1' } })),
  userClient: jest.fn(() => ({ from: (t: string) => chain(t) })),
}))
import { GET } from '@/app/api/training/gate/route'

const pass = (vol: number, m: number, extra: Row = {}) => ({ user_id: 'u1', volume: vol, module_num: m, passed: true, certification_id: null, quiz_id: null, ...extra })
const all9 = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const call = async () => (await GET({ headers: { get: () => null } } as any)).json()

beforeEach(() => {
  PROFILE = { role: 'agent', is_qa_user: false }
  PROGRESS = []
  QUIZ = []
  tablesRead.length = 0
})

describe('training gate — evidence, not client progress', () => {
  it('🛑 a forged training_progress row (completed_modules 1-9, volume_completed) does NOT open the gate', async () => {
    PROGRESS = [{ user_id: 'u1', volume: 'volume-1', completed_modules: all9, volume_completed: true }]
    const b = await call()
    expect(b.gateOpen).toBe(false)
    expect(b.vol1.completed).toEqual([])
    expect(tablesRead).not.toContain('training_progress')
  })
  it('✅ passing all nine Volume 1 module quizzes opens it (legitimate completion)', async () => {
    QUIZ = all9.map((m) => pass(1, m))
    const b = await call()
    expect(b.gateOpen).toBe(true)
    expect(b.vol1).toEqual({ completed: all9, total: 9, done: true })
  })
  it('🛑 eight of nine is still closed', async () => {
    QUIZ = all9.slice(0, 8).map((m) => pass(1, m))
    expect((await call()).gateOpen).toBe(false)
  })
  it('🛑 failed attempts and assessment/platform rows never count as module passes', async () => {
    QUIZ = [
      ...all9.slice(0, 8).map((m) => pass(1, m)),
      { ...pass(1, 9), passed: false },
      pass(1, 9, { certification_id: 'hartfelt-matrix-rental-practical' }),
      pass(1, 9, { quiz_id: 'hartfelt-ready.comprehensive-final' }),
    ]
    expect((await call()).gateOpen).toBe(false)
  })
  it('vol2.done comes from Volume 2 passes, not a client volume_completed flag', async () => {
    PROGRESS = [{ user_id: 'u1', volume: 'volume-2', completed_modules: [], volume_completed: true }]
    expect((await call()).vol2.done).toBe(false)
    QUIZ = [8, 9, 10, 11, 12, 13, 14].map((m) => pass(2, m))
    expect((await call()).vol2.done).toBe(true)
  })
  it('unchanged: broker / admin / office_manager / QA profiles bypass the gate', async () => {
    for (const p of [{ role: 'broker' }, { role: 'admin' }, { role: 'office_manager' }, { role: 'agent', is_qa_user: true }]) {
      PROFILE = p
      expect((await call()).gateOpen).toBe(true)
    }
  })
})
