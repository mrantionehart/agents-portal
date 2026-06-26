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

import { AlertCircle, Hourglass, Lock, ShieldCheck } from "lucide-react";

import type { ComposedBannerState, PillTone } from "../banner/compose-banner-state";

export interface ComplianceBannerProps {
  state: ComposedBannerState;
}

export default function ComplianceBanner({ state }: ComplianceBannerProps) {
  return (
    <section
      aria-label="Compliance and commission status"
      className="
        rounded-lg border border-[#1a1a2e] bg-[#11111a]
        px-4 py-3 mb-4
      "
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
          label="Commission eligibility"
          pill={state.commission}
        />
      </div>

      {/* Detail line(s): show the first non-empty detail (priority:
          compliance → review → commission) so the banner stays compact. */}
      <DetailLine state={state} />

      <p className="mt-2 text-[10px] text-[#71717A] leading-relaxed inline-flex items-start gap-1">
        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
        Broker confirmation required for every change. Compliance enforcement
        and commission release live in Vault.
      </p>
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

function DetailLine({ state }: { state: ComposedBannerState }) {
  const first =
    state.compliance.detail ??
    state.brokerReview.detail ??
    state.commission.detail ??
    null;
  if (!first) return null;
  return <p className="mt-1.5 text-[11px] text-[#71717A] leading-relaxed">{first}</p>;
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
