'use client'

// ============================================================================
// Commission Payouts — dashboard readiness prompt
// ============================================================================
// FINSEC D5 — HARD DISABLED in code (src/portal/payouts/payout-rail.ts).
// This card used to call Vault GET /api/stripe/connect and nudge agents to
// "Connect with Stripe", gated only by NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED. There
// is no connect flow to nudge toward, so it renders nothing and makes no network
// call regardless of any env value. The Settings → Earnings card carries the
// neutral "payout setup is being updated" copy. Kept as a component so the Home
// page's mount point is unchanged; re-enabling is a reviewed code change.
// ============================================================================

export default function PayoutReadinessPrompt() {
  return null
}
