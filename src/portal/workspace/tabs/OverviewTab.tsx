// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Overview tab
// ============================================================================
// Reuses the existing Next Action + Forms Summary content from the
// pre-3.1 single-column page. Adds quick links to Documents / Compliance
// / Commission tabs so agents discover them without leaving Overview.
//
// READ-ONLY. No buttons that mutate. Vault paperwork-package link is
// the only outbound deep-link.
// ============================================================================

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import type { WorkspaceCard, LifecycleTone } from "../types";
import {
  nextActionLabel,
  readinessLanguage,
  statusExplanation,
  vaultPaperworkUrl,
} from "../transaction-helpers";
import { tabHref } from "./tab-config";
// Transaction OS 3.3E — reuse the grid card's pure view helpers so the detail
// Overview shows Transaction Stage (3.1) + Deadline (3.2). No recreated logic.
import { hasLifecycle, lifecycleChipVM } from "../lifecycle-view";
import { hasDeadlineSummary, deadlineChipVM } from "../deadline-view";

const TONE_CLASS: Record<LifecycleTone, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  muted: "bg-white/[0.04] text-[#A1A1AA] border-white/[0.08]",
};

function ToneBadge({ tone, children }: { tone: LifecycleTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

function StageDeadlineRow({ card }: { card: WorkspaceCard }) {
  const showStage = hasLifecycle(card.lifecycle);
  const showDeadline = hasDeadlineSummary(card.deadline_summary);
  if (!showStage && !showDeadline) return null;

  const lc = showStage ? lifecycleChipVM(card.lifecycle!) : null;
  const dl = showDeadline ? deadlineChipVM(card.deadline_summary!) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {lc && (
        <section
          data-testid="overview-transaction-stage"
          className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5"
        >
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-2">
            {lc.section_label}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#F1F1F3] text-base font-medium">
              {lc.current_stage_label}
            </span>
            {lc.next_stage_label && (
              <span className="text-xs text-[#71717A]">→ {lc.next_stage_label}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ToneBadge tone={lc.readiness_tone}>{lc.readiness_label}</ToneBadge>
            <ToneBadge tone={lc.priority_tone}>{lc.priority}</ToneBadge>
            {lc.blocker_count > 0 && (
              <span className="text-xs text-amber-400">{lc.blocker_count} blocker{lc.blocker_count === 1 ? "" : "s"}</span>
            )}
          </div>
          {lc.next_action_label && (
            <p className="mt-2 text-xs text-[#A1A1AA]">{lc.next_action_label}</p>
          )}
        </section>
      )}

      {dl && (
        <section
          data-testid="overview-deadline"
          className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5"
        >
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-2">
            {dl.section_label}
          </h2>
          {dl.next_deadline_label ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[#F1F1F3] text-base font-medium">
                  {dl.next_deadline_label}
                </span>
                {dl.due_date_label && (
                  <span className="text-xs text-[#71717A]">{dl.due_date_label}</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {dl.days_label && <ToneBadge tone={dl.days_tone}>{dl.days_label}</ToneBadge>}
                {dl.overdue_count > 0 && <ToneBadge tone="warn">{dl.overdue_count} overdue</ToneBadge>}
                {dl.at_risk_count > 0 && <ToneBadge tone="warn">{dl.at_risk_count} at risk</ToneBadge>}
              </div>
            </>
          ) : (
            <p className="text-sm text-[#71717A]">No upcoming deadline.</p>
          )}
        </section>
      )}
    </div>
  );
}

export interface OverviewTabProps {
  card: WorkspaceCard;
  vaultBase: string;
}

export default function OverviewTab({ card, vaultBase }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <StageDeadlineRow card={card} />

      {/* Next Action + Forms Summary side-by-side on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-1 rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">
            Next Action
          </h2>
          <div className="text-[#E8D5A3] text-base font-medium mb-2">
            {nextActionLabel(card.next_action)}
          </div>
          <p className="text-sm text-[#A1A1AA] leading-relaxed mb-2">
            {card.suggested_prompt}
          </p>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            {statusExplanation(card)}
          </p>
          <p className="mt-3 text-[11px] text-[#71717A]">
            {readinessLanguage(card)}
          </p>
        </section>

        <section className="lg:col-span-2 rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">
            Forms Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
            <Stat label="Required" value={card.required_forms_count} tone="muted" />
            <Stat label="Ready" value={card.ready_forms_count} tone="info" />
            <Stat label="Signed" value={card.signed_forms_count} tone="ok" />
            <Stat
              label="Blocked"
              value={card.blocked_forms_count}
              tone={card.blocked_forms_count > 0 ? "warn" : "muted"}
            />
            <Stat
              label="Pending Env"
              value={card.pending_envelopes_count}
              tone={card.pending_envelopes_count > 0 ? "info" : "muted"}
            />
          </div>
          <a
            href={vaultPaperworkUrl(card.transaction_id, vaultBase)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
          >
            <FileText className="h-3 w-3" /> Open the paperwork package in Vault
          </a>
        </section>
      </div>

      {/* Priority blockers — placeholder for 3.3 compliance-summary */}
      <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">
          Priority Blockers
        </h2>
        {card.blocked_forms_count > 0 ? (
          <p className="text-sm text-[#A1A1AA]">
            {card.blocked_forms_count} form
            {card.blocked_forms_count === 1 ? "" : "s"} blocked. See the{" "}
            <Link
              href={tabHref(card.transaction_id, "documents")}
              className="text-[#E8D5A3] hover:underline"
            >
              Documents tab
            </Link>{" "}
            for details.
          </p>
        ) : (
          <p className="text-sm text-[#A1A1AA]">
            No active blockers reported by the workspace card. The full
            compliance-blocker list arrives with the Compliance engine in
            Workflow 3.3.
          </p>
        )}
      </section>

      {/* Recent Activity — placeholder for 3.4 timeline */}
      <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">
          Recent Activity
        </h2>
        <p className="text-sm text-[#A1A1AA]">
          The merged event feed (paperwork audit log + broker review +
          envelope events + commission events) connects in Workflow 3.4.
        </p>
        <Link
          href={tabHref(card.transaction_id, "timeline")}
          className="mt-2 inline-flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-[#F1F1F3]"
        >
          Open Timeline tab <ArrowRight className="h-3 w-3" />
        </Link>
      </section>

      {/* Cross-tab nav */}
      <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">
          Jump to
        </h2>
        <div className="flex flex-wrap gap-3 text-xs">
          <TabLink id="documents" txn={card.transaction_id} label="Documents" />
          <TabLink id="compliance" txn={card.transaction_id} label="Compliance" />
          <TabLink id="commission" txn={card.transaction_id} label="Commission" />
          <TabLink id="ai" txn={card.transaction_id} label="AI Assistant" />
        </div>
        <p className="mt-3 text-[11px] text-[#71717A]">
          Read-only workspace. No send, approval, or release actions live in
          the Agent Portal. Broker confirmation flows live in Vault.
        </p>
      </section>
    </div>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

type Tone = "ok" | "info" | "warn" | "muted";

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
    tone === "ok"
      ? "text-emerald-300"
      : tone === "info"
      ? "text-sky-300"
      : tone === "warn"
      ? "text-amber-300"
      : "text-[#A1A1AA]";
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-2 py-2 text-center">
      <div className={`text-xl font-semibold tabular-nums leading-none ${v}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-[#71717A] mt-1">{label}</div>
    </div>
  );
}

function TabLink({
  id,
  txn,
  label,
}: {
  id: import("./tab-config").TabId;
  txn: string;
  label: string;
}) {
  return (
    <Link
      href={tabHref(txn, id)}
      className="text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
    >
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
