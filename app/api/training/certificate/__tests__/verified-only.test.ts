/**
 * @jest-environment node
 */
// HR-PROGRESS-SECURITY — a certificate is earned only by a Broker-of-Record
// verified HartFelt Ready certification, never by client-written progress.
type Row = Record<string, any>
let PROFILE: Row = {}
let PIPELINE: Row | null = null
let PROGRESS: Row[] = []
let FINALS: Row[] = []

function chain(table: string): any {
  const c: any = {}
  for (const m of ['select', 'eq', 'is', 'not', 'order', 'limit']) c[m] = jest.fn(() => c)
  c.single = jest.fn(async () => ({ data: table === 'profiles' ? PROFILE : table === 'training_progress' ? PROGRESS[0] ?? null : null, error: null }))
  c.maybeSingle = jest.fn(async () => ({ data: table === 'profiles' ? PROFILE : table === 'onboarding_pipeline' ? PIPELINE : null, error: null }))
  c.then = (res: any, rej: any) =>
    Promise.resolve({ data: table === 'training_quiz_results' ? FINALS : table === 'training_progress' ? PROGRESS : [], error: null }).then(res, rej)
  return c
}
jest.mock('@/lib/security', () => ({
  requireAuth: jest.fn(async () => ({ user: { id: 'u1', email: 'a@x.test', user_metadata: {} } })),
  userClient: jest.fn(() => ({ from: (t: string) => chain(t) })),
}))
import { GET } from '@/app/api/training/certificate/route'
import { verifiedCertificationDate } from '@/lib/training/evidence'

const get = async (q = '') => (await GET({ url: `http://x/api/training/certificate${q}`, headers: { get: () => null } } as any)).json()
const forged = { volume: 'volume-1', volume_completed: true, certification_date: '2026-01-01', final_exam_score: 100 }

beforeEach(() => {
  PROFILE = { full_name: 'Ann Agent', role: 'agent', is_qa_user: false }
  PIPELINE = null
  PROGRESS = []
  FINALS = []
})

describe('training certificate — Broker-of-Record verified only', () => {
  it('🛑 forged progress (volume_completed + certification_date) earns NOTHING', async () => {
    PROGRESS = [forged]
    expect(await get('?volume=volume-1')).toMatchObject({ earned: false })
    expect((await get()).certificates).toEqual([])
  })
  it('🛑 a LEGACY certification (certified, never verified) earns no certificate', async () => {
    PIPELINE = null // the query requires hartfelt_ready_verified_at IS NOT NULL
    expect((await get('?volume=volume-1')).earned).toBe(false)
  })
  it('✅ a verified certification earns the certificate, dated by the BoR verification', async () => {
    PIPELINE = { hartfelt_ready_verified_at: '2026-11-05T12:00:00Z' }
    FINALS = [{ score: 92 }]
    const b = await get('?volume=volume-1')
    expect(b.earned).toBe(true)
    expect(b.certificate).toMatchObject({ name: 'Ann Agent', volumeKey: 'volume-1', score: 92 })
    expect(b.certificate.date).toMatch(/2026/)
    expect((await get()).certificates).toHaveLength(3)
  })
  it('🛑 a QA profile never earns an official certificate, even if verified', async () => {
    PROFILE = { ...PROFILE, is_qa_user: true }
    PIPELINE = { hartfelt_ready_verified_at: '2026-11-05T12:00:00Z' }
    expect((await get('?volume=volume-1')).earned).toBe(false)
    expect(verifiedCertificationDate({ hartfelt_ready_verified_at: 'x' }, true)).toBeNull()
  })
})
