// ============================================================================
// P8.1C-SEC — the ONE account-standing predicate for the Agent Portal
// ============================================================================
// Both of the Portal's authentication gates — `middleware.ts` STEP 4 (pages)
// and `requireAuth` in `withAuth.ts` (every API route) — read account standing
// from `profiles`. Until this file existed they each read ONE column,
// `is_active`, and a profile could therefore be removed in Vault and still be
// admitted here.
//
// 🛑 THE ACCOUNT THIS EXISTS FOR. `mrhart@hartfeltrei.com`
// (`349fdfb8-9d12-4826-a1a9-5e7e970b5319`), role `broker`, was soft-deleted on
// 2026-04-17 — and carried `is_active = true` for the next six months, because
// the three signals are independent columns and the delete only wrote one of
// them. Vault's middleware and `requireUser` rejected it. The Portal admitted
// it, and so did every API route behind `requireAuth`.
//
// The predicate is Vault's, verbatim: `hartfelt-vault/src/lib/auth/
// active-profile.ts` (BROKER-OPS-003). It is COPIED rather than imported
// because the two repositories do not share a package — so the contract test
// beside this file asserts the predicate AND both call sites, which is the
// only thing that can stop them drifting apart again.
// ============================================================================

export type ActiveProfileShape = {
  is_active?: boolean | null;
  suspended_at?: string | null;
  deleted_at?: string | null;
};

/**
 * 🔑 THE COLUMN LIST IS THE SECURITY CONTROL, NOT A DETAIL.
 *
 * PostgREST omits a column that was not selected, so an unselected
 * `deleted_at` arrives as `undefined` — which is falsy, which reads as "not
 * deleted", which re-opens this hole in full while every behavioural test
 * stays green. Both gates select through this constant, and
 * `active-profile-gate.test.ts` asserts that they do.
 */
export const ACTIVE_PROFILE_SELECT = 'is_active, suspended_at, deleted_at' as const;

/** Why a caller was refused. `deleted` wins over `suspended` wins over inactive. */
export type AccountStanding = 'active' | 'deleted' | 'suspended' | 'inactive';

/**
 * Account standing from the three signals. Fail-closed on every unclear
 * input: a missing row, a null `is_active` and a lookup error all read as
 * NOT active, because the cost of guessing wrong is admitting a removed
 * principal to the brokerage's data.
 */
export function evaluateAccountStanding(
  profile: ActiveProfileShape | null | undefined,
): AccountStanding {
  if (!profile) return 'inactive';
  if (profile.deleted_at != null) return 'deleted';
  if (profile.suspended_at != null) return 'suspended';
  return profile.is_active === true ? 'active' : 'inactive';
}

/** Convenience boolean over `evaluateAccountStanding`. */
export function isActiveProfile(
  profile: ActiveProfileShape | null | undefined,
): boolean {
  return evaluateAccountStanding(profile) === 'active';
}
