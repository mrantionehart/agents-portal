// ============================================================================
// Commission Payouts card (Agent Portal, Settings → Earnings)
// ============================================================================
// FINSEC D5 — the payout-connect flow is HARD DISABLED in code
// (src/portal/payouts/payout-rail.ts). This card used to read Vault
// GET /api/stripe/connect for readiness and POST to it to obtain a Stripe-hosted
// onboarding URL, gated only by the env var NEXT_PUBLIC_PAYOUT_CONNECT_ENABLED.
// That path is removed: the card renders a calm, neutral "being updated" state,
// offers no button, names no provider and makes no network call of any kind.
// Re-introducing a connect flow is a reviewed code change, not an env flip.
// ============================================================================

"use client";

import { CreditCard } from "lucide-react";
import { PAYOUT_UPDATING_COPY } from "@/src/portal/payouts/payout-rail";

export default function CommissionPayoutsCard() {
  return (
    <div className="rounded-xl border border-[#1a1a2e] bg-[#11111a] p-5">
      <div className="flex items-start gap-2">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-[#F1F1F3]">Commission Payouts</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#A1A1AA]">{PAYOUT_UPDATING_COPY}</p>
        </div>
      </div>
    </div>
  );
}
