// ONBOARD-002 — where an agent lands after login, from SERVER-VERIFIED evidence.
//
// This is PLATFORM ONBOARDING, not HartFelt Ready certification. An agent is
// "onboarded" (lands on /home instead of /training) when either:
//   • they completed the first Platform Certification lesson — a
//     `training_lesson_attestations` row for lesson `pcert-l01`, written only
//     by Vault's lesson-complete route with the service role (clients hold no
//     privilege on that table); or
//   • they passed every Volume 1 base module (1-9) — the original onboarding
//     milestone — read from graded `training_quiz_results` (server- or
//     database-graded since Vault 20271161000000).
//
// It used to read `training_progress.volume_completed` for volume-1, which is
// client-writable AND overwritten by unrelated writers (the AP quiz route and
// EASE recompute it from module counts), so it both let a learner set their
// own landing page and silently reset legitimately onboarded agents to
// /training. Office managers bypass the training gate and land on /home.
// Routing only: /home is not access-controlled by this decision.
import { passedModulesForVolume, type QuizEvidenceRow } from '@/lib/training/evidence'

export const ONBOARDING_LESSON_ID = 'pcert-l01'
const VOL1_BASE = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function isOnboarded(input: { attested: boolean; vol1Passes: readonly QuizEvidenceRow[] | null | undefined }): boolean {
  if (input.attested) return true
  const passed = passedModulesForVolume(input.vol1Passes, 1)
  return VOL1_BASE.every((m) => passed.includes(m))
}

/** Landing for a non-admin, non-broker, ACTIVE user. */
export function agentLanding(role: string | null | undefined, onboarded: boolean): '/home' | '/training' {
  if (role === 'office_manager') return '/home'
  return onboarded ? '/home' : '/training'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reader = { from: (t: string) => any }

/**
 * `svc` must be a service-role client: `authenticated` holds no SELECT on
 * training_lesson_attestations. Both reads are scoped to `userId` only.
 */
export async function loadOnboarded(svc: Reader, userId: string): Promise<boolean> {
  const [{ data: att }, { data: passes }] = await Promise.all([
    svc
      .from('training_lesson_attestations')
      .select('lesson_id')
      .eq('user_id', userId)
      .eq('lesson_id', ONBOARDING_LESSON_ID)
      .limit(1),
    svc
      .from('training_quiz_results')
      .select('volume, module_num, passed, certification_id, quiz_id')
      .eq('user_id', userId)
      .eq('volume', 1)
      .eq('passed', true)
      .is('certification_id', null)
      .is('quiz_id', null),
  ])
  return isOnboarded({ attested: Array.isArray(att) && att.length > 0, vol1Passes: (passes ?? []) as QuizEvidenceRow[] })
}
