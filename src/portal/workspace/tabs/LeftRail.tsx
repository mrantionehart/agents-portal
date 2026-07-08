// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Transaction Workspace left rail
// ============================================================================
// Sticky summary panel rendered alongside every tab. Pure presentation —
// reads pre-loaded WorkspaceCard + agent name + Deal Portal status; no
// fetches, no mutations. Vault deep-links absorbed here from the old
// "Quick Links" block.
// ============================================================================

import Link from "next/link";
import {
  Building2,
  CircleAlert,
  ExternalLink,
  FileText,
  Share2,
  User,
} from "lucide-react";

import type { WorkspaceCard } from "../types";
import {
  riskLabel,
  stageLabel,
  transactionTypeLabel,
} from "../transaction-helpers";

export interface LeftRailDealPortal {
  kind: "linked" | "not_linked" | "unknown";
  url?: string;
}

export interface LeftRailProps {
  card: WorkspaceCard;
  vaultBase: string;
  agentName?: string | null;
  /** Optional Deal Portal status. R2A surface; placeholder when unknown. */
  dealPortal?: LeftRailDealPortal;
}

export default function LeftRail({
  card,
  vaultBase,
  agentName,
  dealPortal,
}: LeftRailProps) {
  const dp = dealPortal ?? { kind: "unknown" as const };

  return (
    <aside
      className="
        rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5
        lg:sticky lg:top-4 lg:self-start
        space-y-4
      "
    >
      {/* Property + client */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[#71717A]">
          {transactionTypeLabel(card.transaction_type)}
        </div>
        <h1 className="text-base font-semibold text-[#F1F1F3] mt-0.5 leading-tight">
          {card.property_address ?? "(no property address)"}
        </h1>
        <div className="text-xs text-[#A1A1AA] mt-1 inline-flex items-center gap-1">
          <User className="h-3 w-3 text-[#71717A]" />
          {card.client_name ?? "(no client name)"}
        </div>
      </div>

      {/* Readiness ring + stage */}
      <div className="flex items-center gap-4 pt-2 border-t border-[#1a1a2e]">
        <div className="shrink-0 text-center">
          <div className="text-3xl font-semibold text-[#F1F1F3] tabular-nums leading-none">
            {card.readiness_score}
            <span className="text-base text-[#71717A]">%</span>
          </div>
          <div className="text-[10px] text-[#71717A] mt-0.5 uppercase tracking-wide">
            readiness
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Badge tone="info">{stageLabel(card.stage)}</Badge>
          <Badge tone="muted">
            tier: {card.readiness_tier.replace(/_/g, " ")}
          </Badge>
          {card.risk_tier !== "unknown" && (
            <Badge tone="warn">{riskLabel(card.risk_tier)}</Badge>
          )}
        </div>
      </div>

      {/* Next action intentionally removed (3.5 Phase 1): the Coordinator strip
          is the single source of the workflow next action. The left rail keeps
          identity + readiness + stage only. */}

      {/* Agent */}
      {agentName && (
        <div className="pt-2 border-t border-[#1a1a2e]">
          <div className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1">
            Agent
          </div>
          <div className="text-xs text-[#F1F1F3] inline-flex items-center gap-1">
            <User className="h-3 w-3 text-[#71717A]" />
            {agentName}
          </div>
        </div>
      )}

      {/* In-portal quick links + Deal Portal */}
      <div className="pt-2 border-t border-[#1a1a2e] space-y-1.5">
        <Link
          href={`/workspace/${card.transaction_id}`}
          className="block text-[11px] text-[#A1A1AA] hover:text-[#F1F1F3] inline-flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" /> Open transaction
        </Link>
        <Link
          href={`/workspace/${card.transaction_id}?tab=documents`}
          className="block text-[11px] text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
        >
          <FileText className="h-3 w-3" /> Open paperwork
        </Link>
        {dp.kind === "linked" && dp.url ? (
          <Link
            href={dp.url}
            className="block text-[11px] text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
          >
            <Share2 className="h-3 w-3" /> Open Deal Portal
          </Link>
        ) : dp.kind === "not_linked" ? (
          <span className="block text-[11px] text-[#71717A] inline-flex items-center gap-1">
            <Share2 className="h-3 w-3" /> Deal Portal not linked
          </span>
        ) : (
          <span className="block text-[11px] text-[#71717A] inline-flex items-center gap-1">
            <Share2 className="h-3 w-3 opacity-60" /> Deal Portal status
            unknown
          </span>
        )}
      </div>

      {/* Read-only footer */}
      <p className="pt-2 border-t border-[#1a1a2e] text-[10px] text-[#71717A] leading-relaxed inline-flex items-start gap-1">
        <Building2 className="h-3 w-3 mt-0.5 shrink-0" />
        Read-only workspace. Broker confirmation lives in Vault.
      </p>
    </aside>
  );
}

// ── Atom ──────────────────────────────────────────────────────────

type Tone = "ok" | "info" | "warn" | "muted";
function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <div className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] ${cls}`}>
      {children}
    </div>
  );
}
