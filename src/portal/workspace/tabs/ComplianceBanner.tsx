// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.1 — Compliance + Commission banner
// ============================================================================
// Top informational strip above the tab content. Surfaces three pills
// derived from EXISTING Vault-published signals (WorkspaceCard counts +
// transactions.broker_review_status + transactions.status +
// missing-fields aggregates). NO commission amounts. NO broker notes.
// NO Stripe data. NO release / approve / pay / reject actions.
//
// State is composed at the page layer via composeBannerState(); this
// component is pure presentation.
//
// W3.1 placeholder copy ("Not yet connected", "Pending compliance
// engine") removed — all 3 pills now show real signals.
// ============================================================================

import { Hourglass, Lock, ShieldCheck } from "lucide-react";

import type { ComposedBannerState, PillTone } from "../banner/compose-banner-state";

export interface ComplianceBannerProps {
  state: ComposedBannerState;
}

// 3.5 Phase 3A — compact single-row gate status. The three pills stay
// (Compliance · Broker Review · Commission); the secondary detail line and the
// Vault disclaimer were removed to lift the Coordinator hero higher. Signals +
// composition are unchanged (presentation only).
export default function ComplianceBanner({ state }: ComplianceBannerProps) {
  return (
    <section
      aria-label="Compliance and commission status"
      className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-4 py-2 mb-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <PillRow
          icon={<ShieldCheck className="h-3.5 w-3.5 text-[#71717A]" />}
          label="Compliance"
          pill={state.compliance}
        />
        <PillRow
          icon={<Hourglass className="h-3.5 w-3.5 text-[#71717A]" />}
          label="Broker review"
          pill={state.brokerReview}
        />
        <PillRow
          icon={<Lock className="h-3.5 w-3.5 text-[#71717A]" />}
          label="Commission"
          pill={state.commission}
        />
      </div>
    </section>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

function PillRow({
  icon,
  label,
  pill,
}: {
  icon: React.ReactNode;
  label: string;
  pill: { tone: PillTone; label: string };
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span className="text-[#A1A1AA]">{label}</span>
      <Pill tone={pill.tone}>{pill.label}</Pill>
    </span>
  );
}

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}
