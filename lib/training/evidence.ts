// HR-PROGRESS-SECURITY — what counts as training evidence.
//
// `training_progress` (completed_modules / volume_completed /
// certification_date) is written by the CLIENT: EASE, the Agent Portal quiz
// route under the user's JWT, and the browser-graded training-interactive
// page all upsert it, and RLS lets a learner insert/update their own row
// freely. It is a progress DISPLAY, never an authority.
//
// Authority comes from:
//   • module passes — `training_quiz_results` rows with passed = true and
//     certification_id/quiz_id NULL. Since Vault 20271161000000 every such row
//     is either server-written (service role, after server grading) or graded
//     by the database itself; a client cannot author a pass.
//   • HartFelt Ready certification — onboarding_pipeline.hartfelt_ready_verified_at,
//     written only by Vault complete_training, which requires the designated
//     Broker of Record and the full evidence gate.

export interface QuizEvidenceRow {
  readonly volume: number | null
  readonly module_num: number | null
  readonly passed: boolean | null
  readonly certification_id: string | null
  readonly quiz_id: string | null
}

/** Module numbers with a passing, gate-valid quiz row in this volume, ascending. */
export function passedModulesForVolume(rows: readonly QuizEvidenceRow[] | null | undefined, volume: number): number[] {
  const out = new Set<number>()
  for (const r of rows ?? []) {
    if (r.certification_id !== null || r.quiz_id !== null) continue
    if (r.passed !== true || r.volume !== volume || typeof r.module_num !== 'number') continue
    out.add(r.module_num)
  }
  return [...out].sort((a, b) => a - b)
}

export interface PipelineCertRow {
  readonly hartfelt_ready_verified_at: string | null
}

/** Broker-of-Record-verified HartFelt Ready certification date, or null. QA profiles never hold one. */
export function verifiedCertificationDate(
  pipeline: PipelineCertRow | null | undefined,
  isQaUser: boolean | null | undefined,
): string | null {
  if (isQaUser === true) return null
  return pipeline?.hartfelt_ready_verified_at ?? null
}
