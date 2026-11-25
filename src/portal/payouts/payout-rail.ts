// ============================================================================
// Payout rail — HARD DISABLED in code (FINSEC D5)
// ============================================================================
// The Agent Portal used to send agents into Vault's Stripe Connect onboarding
// whenever the build-time env `NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED === "true"`.
// An env var is not a control the owner reviews: anyone with project-settings
// access could flip it and re-open a provider flow HartFelt has decided not to
// use. Enablement is therefore no longer read from the environment at all.
//
// Re-enabling a payout-connect flow requires a reviewed code change: a new
// provider integration, a new component, and changing this constant. Setting
// the old env var does nothing — the tests pin that it is ignored.
//
// Nothing here touches historical payout data; it only decides whether the
// Portal offers a connect flow (it does not).
// ============================================================================

export const PAYOUT_CONNECT_ENABLED = false as const

/** Always false. Kept as a function so call sites read the same as before. */
export function payoutConnectEnabled(): false {
  return PAYOUT_CONNECT_ENABLED
}

/** Neutral copy shown while payout setup is unavailable — names no provider. */
export const PAYOUT_UPDATING_COPY =
  'We’re updating how commission payouts are handled. You don’t need to do anything right now — HARTFELT will let you know as soon as payout setup is ready.'
