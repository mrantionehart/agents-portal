// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Compliance + Commission banner
// ============================================================================
// Top informational strip rendered above the tab content. Surfaces
// existing data only (no compliance recomputation, no commission gate);
// the real `compliance-summary` endpoint ships in Workflow 3.3.
//
// READ-ONLY. NO approve / send / release / close buttons here.
// ============================================================================

import { AlertCircle, Hourglass, Lock, ShieldCheck } from "lucide-react";

import type { WorkspaceCard } from "../types";

export interface ComplianceBannerProps {
  card: WorkspaceCard;
}

/** Coarse derived state from the card. Real signals land in 3.3. */
function brokerReviewLabel(card: WorkspaceCard): {
  tone: "ok" | "info" | "warn" | "muted";
  label: string;
} {
  if (card.broker_confirmation_required) {
    return { tone: "warn", label: "Broker confirmation required" };
  }
  if (card.readiness_tier === "ready_for_review") {
    return { tone: "info", label: "Ready for broker review" };
  }
  if (card.readiness_tier === "ready_for_signature") {
    return { tone: "ok", label: "Ready for signature" };
  }
  return { tone: "muted", label: "Broker review pending" };
}

export default function ComplianceBanner({ card }: ComplianceBannerProps) {
  const broker = brokerReviewLabel(card);

  return (
    <section
      aria-label="Compliance and commission status"
      className="
        rounded-lg border border-[#1a1a2e] bg-[#11111a]
        px-4 py-3 mb-4
      "
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {/* Compliance — placeholder for 3.3 */}
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#71717A]" />
          <span className="text-[#A1A1AA]">Compliance review</span>
          <Pill tone="muted">Not yet connected</Pill>
        </span>

        {/* Broker review — derived from existing card data */}
        <span className="inline-flex items-center gap-1.5">
          <Hourglass className="h-3.5 w-3.5 text-[#71717A]" />
          <span className="text-[#A1A1AA]">Broker review</span>
          <Pill tone={broker.tone}>{broker.label}</Pill>
        </span>

        {/* Commission eligibility — pending compliance engine */}
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-[#71717A]" />
          <span className="text-[#A1A1AA]">Commission eligibility</span>
          <Pill tone="muted">Pending compliance engine</Pill>
        </span>
      </div>

      <p className="mt-2 text-[10px] text-[#71717A] leading-relaxed inline-flex items-start gap-1">
        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
        Compliance + commission release flows live in Vault. The release
        gate ships in Workflow 3.3. No commission may be released from the
        Agent Portal.
      </p>
    </section>
  );
}

// ── Atom ──────────────────────────────────────────────────────────

type Tone = "ok" | "info" | "warn" | "muted";
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}
