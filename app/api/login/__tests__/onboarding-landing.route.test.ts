/**
 * @jest-environment node
 */
// ONBOARD-002 — the real login handler: a forged training_progress flag no
// longer routes to /home, and a legitimately onboarded agent whose flag was
// reset by another writer still lands on /home.
let PROFILE: { role: string; is_active: boolean } = { role: 'agent', is_active: true }
let PROGRESS: { volume_completed: boolean } | null = null
let ATTESTED = false
let PASSES: any[] = []
const userReads: string[] = []

jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { signInWithPassword: async () => ({ data: { user: { id: 'u1', email: 'a@x.test' } }, error: null }) },
    from: (table: string) => {
      userReads.push(table)
      const c: any = {}
      c.select = () => c
      c.eq = () => c
      c.single = async () => ({ data: table === 'profiles' ? PROFILE : null, error: null })
      c.maybeSingle = async () => ({ data: table === 'training_progress' ? PROGRESS : table === 'profiles' ? PROFILE : null, error: null })
      return c
    },
  }),
}))
jest.mock('@/lib/ratelimit', () => ({ normalizeEmail: (e: string) => e.toLowerCase() }))
jest.mock('@/lib/security', () => ({
  clientIp: () => '127.0.0.1',
  requireRateLimit: async () => ({}),
  adminClient: () => ({
    from: (t: string) => {
      const c: any = {}
      for (const m of ['select', 'eq', 'is']) c[m] = () => c
      c.limit = async () => ({ data: t === 'training_lesson_attestations' && ATTESTED ? [{ lesson_id: 'pcert-l01' }] : [], error: null })
      c.then = (res: any) => Promise.resolve({ data: t === 'training_quiz_results' ? PASSES : [], error: null }).then(res)
      return c
    },
  }),
}))
import { POST } from '@/app/api/login/route'

const login = async () =>
  (await (await POST({ json: async () => ({ email: 'a@x.test', password: 'pw' }), headers: new Headers(), cookies: { get: () => undefined } } as any)).json()).redirectPath

beforeEach(() => {
  PROFILE = { role: 'agent', is_active: true }
  PROGRESS = null
  ATTESTED = false
  PASSES = []
  userReads.length = 0
})

describe('POST /api/login — onboarding landing (ONBOARD-002)', () => {
  it('🛑 a learner-forged training_progress.volume_completed=true does NOT route to /home', async () => {
    PROGRESS = { volume_completed: true }
    expect(await login()).toBe('/training')
    expect(userReads).not.toContain('training_progress')
  })
  it('✅ an onboarded agent (pcert-l01 attested) whose flag was reset to false still lands on /home', async () => {
    PROGRESS = { volume_completed: false }
    ATTESTED = true
    expect(await login()).toBe('/home')
  })
  it('✅ Volume 1 base modules all passed → /home', async () => {
    PASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => ({ volume: 1, module_num: m, passed: true, certification_id: null, quiz_id: null }))
    expect(await login()).toBe('/home')
  })
  it('new agent → /training', async () => {
    expect(await login()).toBe('/training')
  })
  it('inactive → /pending-activation regardless of evidence', async () => {
    PROFILE = { role: 'agent', is_active: false }
    ATTESTED = true
    expect(await login()).toBe('/pending-activation')
  })
  it('office_manager → /home', async () => {
    PROFILE = { role: 'office_manager', is_active: true }
    expect(await login()).toBe('/home')
  })
})
