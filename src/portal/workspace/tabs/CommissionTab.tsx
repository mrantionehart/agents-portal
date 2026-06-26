// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Commission tab
// ============================================================================
// Placeholder. The commission release gate (hard-coupled to
// `compliance-summary.ready_for_commission`) ships in Workflow 3.3.
// Today's `/api/commissions/get` endpoint exists (per Vault) but
// agent-facing read with blocker-explanation surface isn't wired yet.
//
// READ-ONLY. Commission cannot be released, approved, or paid from the
// Agent Portal. All release flows live in Vault gated by compliance.
// ============================================================================

import { Lock, Wallet } from "lucide-react";

export default function CommissionTab() {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <Wallet className="h-3.5 w-3.5 text-[#C9A84C]" />
        Commission
      </h2>

      <div className="rounded-md border border-amber-700/40 bg-amber-900/15 px-4 py-3 mb-3 text-xs text-amber-200 inline-flex items-start gap-2">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">Commission blocked until compliance is approved.</div>
          <div className="text-amber-200/80 mt-0.5">
            The compliance gate ships in Workflow 3.3. Commission cannot be
            released from the Agent Portal — release requires broker approval
            in Vault, gated by{" "}
            <code className="text-amber-100">compliance-summary.ready_for_commission</code>.
          </div>
        </div>
      </div>

      <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] py-6 px-5">
        <p className="text-sm text-[#A1A1AA] mb-2">
          When the compliance gate ships, this tab will surface:
        </p>
        <ul className="text-xs text-[#A1A1AA] space-y-1 list-disc list-inside">
          <li>Commission status (pending / calculated / broker_approved / paid / disputed)</li>
          <li>Calculation breakdown (gross, splits, cap, net to agent)</li>
          <li>Release checklist (compliance gates that must pass)</li>
          <li>Blocker reasons (what specifically is holding release)</li>
          <li>Commission timeline (transitions + timestamps)</li>
          <li>Payment record (when paid: method, reference, masked Stripe payout id)</li>
        </ul>
      </div>

      <p className="mt-3 text-[10px] text-[#71717A] leading-relaxed">
        Read-only placeholder. No approve, pay, release, or override
        actions live in the Agent Portal.
      </p>
    </section>
  );
}
