// ============================================================================
// AGENT PORTAL 2.0 — Workspace transaction card
// ============================================================================
// Beautiful card that visualizes ONE WorkspaceCard from Vault. Read-only.
// NEVER renders a send / envelope / broker-approval button.
// ============================================================================

"use client";

import Link from "next/link";
import { ExternalLink, FileText, Sparkles } from "lucide-react";

import {
  badgeForCard,
  riskLabel,
  stageLabel,
  typeLabel,
} from "./helpers";
import type { WorkspaceCard as WorkspaceCardData, CardLifecycle, DeadlineSummary } from "./types";
import { hasLifecycle, lifecycleChipVM } from "./lifecycle-view";
import { hasDeadlineSummary, deadlineChipVM } from "./deadline-view";

interface Props {
  card: WorkspaceCardData;
  vaultBase: string;
}

export default function WorkspaceCard({ card, vaultBase }: Props) {
  const badge = badgeForCard(card);

  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5 hover:border-[#252538] transition-colors duration-[180ms]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[#71717A]">
            {typeLabel(card.transaction_type)}
          </div>
          <h2 className="text-base font-semibold text-[#F1F1F3] truncate">
            {card.property_address ?? "(no property address)"}
          </h2>
          <div className="text-sm text-[#A1A1AA] truncate">
            {card.client_name ?? "(no client name)"}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-semibold text-[#F1F1F3] tabular-nums leading-none">
            {card.readiness_score}
            <span className="text-base text-[#71717A]">%</span>
          </div>
          <div className="text-[10px] text-[#71717A] mt-1">readiness</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <Badge tone="muted">{stageLabel(card.stage)}</Badge>
        {card.risk_tier !== "unknown" && (
          <Badge tone={riskTone(card.risk_tier)}>{riskLabel(card.risk_tier)}</Badge>
        )}
        {card.broker_confirmation_required && (
          <Badge tone="muted">Broker Confirmation Required</Badge>
        )}
      </div>

      {/* TXN-OS.3.1D — Transaction Stage indicator (distinct from the paperwork
          stage above). Additive + fail-graceful: hidden when lifecycle is null. */}
      {hasLifecycle(card.lifecycle) && (
        <TransactionStageIndicator lifecycle={card.lifecycle} />
      )}

      {/* TXN-OS.3.2D — Deadline section (distinct from the paperwork stage badge
          and the Transaction Stage indicator above). Additive + fail-graceful:
          hidden when deadline_summary is null or empty. */}
      {hasDeadlineSummary(card.deadline_summary) && (
        <DeadlineIndicator summary={card.deadline_summary} />
      )}

      <p className="text-sm text-[#A1A1AA] mb-4 leading-relaxed">
        {card.suggested_prompt}
      </p>

      <div className="grid grid-cols-5 gap-1.5 mb-4 text-center">
        <Stat label="Req"     value={card.required_forms_count} tone="muted" />
        <Stat label="Ready"   value={card.ready_forms_count}    tone="info" />
        <Stat label="Signed"  value={card.signed_forms_count}   tone="ok" />
        <Stat label="Blocked" value={card.blocked_forms_count}  tone={card.blocked_forms_count > 0 ? "warn" : "muted"} />
        <Stat label="Env"     value={card.pending_envelopes_count} tone={card.pending_envelopes_count > 0 ? "info" : "muted"} />
      </div>

      <div className="flex flex-wrap gap-3 pt-3 border-t border-[#1a1a2e] text-xs">
        <Link
          href={`/workspace/${card.transaction_id}`}
          className="text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
        >
          Continue
        </Link>
        <Link
          href={`/workspace/${card.transaction_id}`}
          className="text-[#A1A1AA] hover:text-[#F1F1F3] inline-flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" /> Open Transaction
        </Link>
        <Link
          href={`/workspace/${card.transaction_id}?tab=documents`}
          className="text-[#A1A1AA] hover:text-[#F1F1F3] inline-flex items-center gap-1"
        >
          <FileText className="h-3 w-3" /> Open Paperwork
        </Link>
        <Link
          href={`/workspace/${card.transaction_id}#ai-assistant`}
          className="text-[#A1A1AA] hover:text-[#F1F1F3] inline-flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> Continue with AI
        </Link>
      </div>
    </div>
  );
}

// ── TXN-OS.3.1D — Transaction Stage indicator ───────────────────────
// Thin shell over the pure lifecycle-view helpers. Renders only labels/counts
// from Vault's projection — never recalculates lifecycle.
function TransactionStageIndicator({ lifecycle }: { lifecycle: CardLifecycle }) {
  const vm = lifecycleChipVM(lifecycle);
  return (
    <div className="mb-3 rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wide text-[#71717A] mb-1">
        {vm.section_label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="muted">{vm.current_stage_label}</Badge>
        {vm.next_stage_label && (
          <span className="text-[10px] text-[#71717A]">→ {vm.next_stage_label}</span>
        )}
        <Badge tone={vm.readiness_tone}>{vm.readiness_label}</Badge>
        {vm.blocker_count > 0 && (
          <Badge tone="warn">
            {vm.blocker_count} blocker{vm.blocker_count === 1 ? "" : "s"}
          </Badge>
        )}
        <Badge tone={vm.priority_tone}>{vm.priority}</Badge>
      </div>
      {vm.next_action_label && (
        <div className="mt-1 text-[10px] text-sky-300 truncate">{vm.next_action_label}</div>
      )}
    </div>
  );
}

// ── TXN-OS.3.2D — Deadline indicator ────────────────────────────────
// Thin shell over the pure deadline-view helpers. Renders only labels/dates/
// counts from Vault's deadline_summary — never recalculates, never shows the
// internal next_deadline key. Priority colors match the Transaction Stage.
function DeadlineIndicator({ summary }: { summary: DeadlineSummary }) {
  const vm = deadlineChipVM(summary);
  return (
    <div className="mb-3 rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wide text-[#71717A] mb-1">
        {vm.section_label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {vm.next_deadline_label && <Badge tone="muted">{vm.next_deadline_label}</Badge>}
        {vm.due_date_label && (
          <span className="text-[10px] text-[#71717A]">{vm.due_date_label}</span>
        )}
        {vm.days_label && <Badge tone={vm.days_tone}>{vm.days_label}</Badge>}
        {vm.overdue_count > 0 && <Badge tone="warn">{vm.overdue_count} overdue</Badge>}
        {vm.at_risk_count > 0 && <Badge tone="info">{vm.at_risk_count} at risk</Badge>}
        <Badge tone={vm.priority_tone}>{vm.priority}</Badge>
      </div>
    </div>
  );
}

// ── Small UI atoms ──────────────────────────────────────────────────

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
    <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: Tone;
}) {
  const v =
    tone === "ok" ? "text-emerald-300"
    : tone === "info" ? "text-sky-300"
    : tone === "warn" ? "text-amber-300"
    : "text-[#A1A1AA]";
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-1.5 py-1.5">
      <div className={`text-lg font-semibold tabular-nums leading-none ${v}`}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-[#71717A] mt-0.5">
        {label}
      </div>
    </div>
  );
}

function riskTone(risk: WorkspaceCardData["risk_tier"]): Tone {
  switch (risk) {
    case "low": return "ok";
    case "medium": return "info";
    case "high":
    case "critical":
      return "warn";
    default:
      return "muted";
  }
}
