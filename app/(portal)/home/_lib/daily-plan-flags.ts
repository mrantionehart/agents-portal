// ============================================================================
// EASE-2.0-PLAN-SURFACE-AP-1 — Daily Game Plan pilot cohort
// ============================================================================
// Visibility is gated in the PORTAL, not in Vault. `GET /api/ease/daily-plan`
// stays generic: it always returns the caller's own plan, and knows nothing
// about pilots. This file decides only whether the Portal asks.
//
// ── WHY THIS IS NOT A `NEXT_PUBLIC_` FLAG ───────────────────────────────────
// The Ring flags next door use `NEXT_PUBLIC_` because they gate a CLIENT
// component and have no other option. This gate runs inside the Home page,
// which is a server component, so the variable stays on the server — and it
// must, because `NEXT_PUBLIC_*` is inlined into the client bundle at build
// time. A public cohort list would publish the identities of the two agents
// being trialled to every browser that loads the Portal.
//
// ── FAIL CLOSED ─────────────────────────────────────────────────────────────
// Unset, empty, or whitespace-only → nobody. There is no wildcard, no "all",
// and no default-on branch: the only way to be in the cohort is for your exact
// user id to appear in the list. Getting this wrong in the safe direction
// hides a card; getting it wrong in the other direction shows an unfinished
// surface to the whole brokerage.
// ============================================================================

export const DAILY_PLAN_COHORT_ENV = "EASE_DAILY_PLAN_AGENT_IDS";

/** Only a string map is needed here; `process.env` satisfies it. Narrower than
 *  NodeJS.ProcessEnv so a test can pass a plain object without inventing a
 *  NODE_ENV it does not care about. */
type EnvLike = Record<string, string | undefined>;

/**
 * The pilot cohort, as a set of Supabase auth user ids.
 *
 * Ids rather than emails on purpose: the id is stable, it is already the key
 * Vault resolves scope from, and it never has to be rendered — so the cohort
 * cannot leak into the UI by accident.
 */
export function dailyPlanCohort(env: EnvLike = process.env): ReadonlySet<string> {
  const raw = env[DAILY_PLAN_COHORT_ENV];
  if (typeof raw !== "string") return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

/**
 * Whether this caller sees the Daily Game Plan.
 *
 * Exact membership only — no prefix match, no case folding. A UUID that
 * differs by one character is a different person.
 */
export function dailyPlanEnabledFor(
  userId: string | null | undefined,
  env: EnvLike = process.env,
): boolean {
  if (typeof userId !== "string" || userId.trim().length === 0) return false;
  return dailyPlanCohort(env).has(userId);
}
