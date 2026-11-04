// HR-CERT-SECURITY D1 — the server owns every HartFelt Ready module result.
//
// `training_quiz_results` is the evidence Vault's HartFelt Ready gate counts.
// Until this change any signed-in user could INSERT their own row with
// `passed = true` (RLS checked only `auth.uid() = user_id`), and EASE graded
// on the phone and did exactly that. Now:
//   * the client sends ANSWERS only — never a score or a pass flag;
//   * this route grades against the Agent Portal bank (app/data/quizzes.ts);
//   * the row is written with the service role, after the module is proven
//     to be in the HartFelt Ready curriculum and open to the caller's role;
//   * the Vault migration that follows revokes INSERT from `authenticated`,
//     so a forged client row is refused by the database itself.
// Pure helpers live here so they can be tested without a database.

export type ModuleEligibility =
  | { ok: true }
  | { ok: false; status: 403 | 404; reason: 'not_in_curriculum' | 'role_not_permitted' }

export interface CurriculumRow {
  readonly required_role: readonly string[] | null
}

/**
 * Mirrors Vault's `roleMayTake` (src/lib/onboarding/hartfelt-ready.ts):
 * `required_role` null/empty = unrestricted; otherwise the role must be listed.
 */
export function moduleEligibility(row: CurriculumRow | null, role: string | null): ModuleEligibility {
  if (!row) return { ok: false, status: 404, reason: 'not_in_curriculum' }
  const req = row.required_role
  if (!req || req.length === 0) return { ok: true }
  if (role && req.includes(role)) return { ok: true }
  return { ok: false, status: 403, reason: 'role_not_permitted' }
}

export type ParsedSubmission =
  | { ok: true; volume: number; moduleNum: number; answers: Record<string, string> }
  | { ok: false; error: string }

const isPosInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 100

/**
 * Accept ONLY volume, module_num and answers. Anything else the client sends —
 * score, passed, attempt_num, user_id — is ignored by construction, because
 * nothing else is read from the body.
 */
export function parseSubmission(body: unknown, questionIds?: readonly string[]): ParsedSubmission {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' }
  const b = body as Record<string, unknown>
  if (!isPosInt(b.volume) || !isPosInt(b.module_num)) {
    return { ok: false, error: 'Missing required fields: volume, module_num, answers' }
  }
  const raw = b.answers
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Missing required fields: volume, module_num, answers' }
  }
  const answers: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (questionIds && !questionIds.includes(k)) continue
    if (typeof v !== 'string' || v.length > 16) return { ok: false, error: 'Invalid answer value' }
    answers[k] = v
  }
  return { ok: true, volume: b.volume, moduleNum: b.module_num, answers }
}
