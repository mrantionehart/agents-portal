/**
 * @jest-environment node
 */
// ONBOARD-002 — the post-login landing decision for new, active, onboarded,
// QA and office-manager users, from server-verified evidence. Before: the
// learner-writable training_progress.volume_completed flag decided it, and
// unrelated writers reset it, sending onboarded agents back to /training.
import { HOME_ROLES, agentLanding, isOnboarded, loadOnboarded } from '@/lib/training/onboarding-landing'

const pass = (m: number, extra = {}) => ({ volume: 1, module_num: m, passed: true, certification_id: null, quiz_id: null, ...extra })
const all9 = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function svc(opts: { attested?: boolean; passes?: any[] }) {
  const reads: { table: string; filters: [string, unknown][] }[] = []
  return {
    reads,
    client: {
      from: (table: string) => {
        const filters: [string, unknown][] = []
        reads.push({ table, filters })
        const c: any = {}
        c.select = () => c
        c.eq = (k: string, v: unknown) => (filters.push([k, v]), c)
        c.is = (k: string, v: unknown) => (filters.push([k, v]), c)
        c.limit = async () => ({ data: opts.attested ? [{ lesson_id: 'pcert-l01' }] : [], error: null })
        c.then = (res: any) => Promise.resolve({ data: opts.passes ?? [], error: null }).then(res)
        return c
      },
    },
  }
}

describe('isOnboarded / agentLanding', () => {
  it('new agent (no attestation, no passes) → /training', () => {
    expect(agentLanding('new_agent', isOnboarded({ attested: false, vol1Passes: [] }))).toBe('/training')
  })
  it('pcert-l01 attested → /home (platform onboarding complete)', () => {
    expect(agentLanding('agent', isOnboarded({ attested: true, vol1Passes: [] }))).toBe('/home')
  })
  it('all nine Volume 1 base modules passed → /home; eight → /training', () => {
    expect(isOnboarded({ attested: false, vol1Passes: all9.map((m) => pass(m)) })).toBe(true)
    expect(isOnboarded({ attested: false, vol1Passes: all9.slice(0, 8).map((m) => pass(m)) })).toBe(false)
  })
  it('failed or assessment rows never count', () => {
    expect(isOnboarded({ attested: false, vol1Passes: [...all9.slice(0, 8).map((m) => pass(m)), pass(9, { passed: false })] })).toBe(false)
    expect(isOnboarded({ attested: false, vol1Passes: [...all9.slice(0, 8).map((m) => pass(m)), pass(9, { quiz_id: 'hartfelt-ready.comprehensive-final' })] })).toBe(false)
  })
  it('QA agents follow the same evidence (attested QA → /home, un-evidenced QA → /training)', () => {
    expect(agentLanding('agent', true)).toBe('/home')
    expect(agentLanding('agent', false)).toBe('/training')
  })
  it('ONBOARD-003: a role /home refuses (internal_staff) lands on /training even when onboarded', () => {
    expect(agentLanding('internal_staff', true)).toBe('/training')
    expect(agentLanding('internal_staff', false)).toBe('/training')
    expect(agentLanding(null, true)).toBe('/training')
  })
  it('ONBOARD-003: every agent-tier role /home serves follows onboarding evidence', () => {
    for (const r of ['agent', 'new_agent', 'tc', 'manager']) {
      expect(agentLanding(r, true)).toBe('/home')
      expect(agentLanding(r, false)).toBe('/training')
    }
  })
  it('ONBOARD-003: HOME_ROLES is exactly Vault ALL_GATED_ROLES minus admin/broker (which land on Vault)', () => {
    expect([...HOME_ROLES].sort()).toEqual(['agent', 'manager', 'new_agent', 'office_manager', 'tc'])
  })
  it('office_manager lands on /home (bypasses the training gate)', () => {
    expect(agentLanding('office_manager', false)).toBe('/home')
  })
})

describe('loadOnboarded', () => {
  it('reads ONLY the caller-scoped attestation and quiz evidence — never training_progress', async () => {
    const s = svc({ attested: true })
    expect(await loadOnboarded(s.client, 'u1')).toBe(true)
    expect(s.reads.map((r) => r.table).sort()).toEqual(['training_lesson_attestations', 'training_quiz_results'])
    for (const r of s.reads) expect(r.filters).toContainEqual(['user_id', 'u1'])
    expect(s.reads.find((r) => r.table === 'training_lesson_attestations')!.filters).toContainEqual(['lesson_id', 'pcert-l01'])
  })
  it('no evidence → not onboarded', async () => {
    expect(await loadOnboarded(svc({}).client, 'u1')).toBe(false)
  })
})
