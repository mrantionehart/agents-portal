// ============================================================================
// COMM-1C — Agent Portal Ring feature posture
// ============================================================================
// The Agent Portal cannot read Vault's server env, so it mirrors the two Vault
// Ring flags with its own PUBLIC build-time flags. Both DEFAULT OFF, so the
// shipped surface is DARK-honest: certification progress still loads, but the
// "Start Certification" call-to-action renders an honest "coming soon" state
// instead of a button that would 404 against Vault.
//
// For controlled UAT, BOTH the Vault flag (RING_SELLER_CERT_ASSESSMENT_ENABLED)
// and the matching NEXT_PUBLIC flag here are enabled together. Practice text is
// gated by Vault's own TEXT_PRACTICE flag and simply surfaces an honest
// unavailable state if that route 404s — no separate Portal flag needed.
// ============================================================================

/** True when the Portal should present the active "Start Certification" CTA.
 *  Off by default → dark-honest. Set NEXT_PUBLIC_RING_SELLER_CERT_ASSESSMENT_ENABLED
 *  = "true" only for controlled UAT, in lockstep with the Vault flag. */
export function assessmentEntryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RING_SELLER_CERT_ASSESSMENT_ENABLED === "true";
}
