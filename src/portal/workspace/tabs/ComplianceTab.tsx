// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.2 — Compliance tab (read-only)
// ============================================================================
// Real-data Compliance dashboard. Pure presentation — receives a
// pre-composed ComplianceTabState from the page layer. NO commission
// amounts, NO Stripe data, NO broker notes, NO raw Vault per-check
// blocker strings (those are masked off at the boundary), NO release /
// approve / pay / reject buttons.
//
// Eight sections (in order):
//   1. Readiness header (score + tier + next action)
//   2. Blockers
//   3. Warnings
//   4. Required forms
//   5. Statutory disclosures
//   6. Broker review
//   7. Envelope summary
//   8. Readiness gates
// ============================================================================

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Hourglass,
  Mail,
  Shield,
  ShieldCheck,
} from "lucide-react";

import type {
  BlockerItem,
  ComplianceTabState,
  EnvelopeSummaryRow,
  GateStatus,
  GateSummary,
  PillTone,
  RequiredFormSummary,
  StatutoryItemSummary,
  WarningItem,
} from "../compliance/types";
import { categoryLabel, statusLabel, statusTone } from "../../documents/helpers";
import { humanSeverity, severityTone } from "../../documents/details/helpers";
// Transaction OS 3.3E — in-workspace Submit for Review action.
import SubmitForReviewButton from "../compliance/SubmitForReviewButton";

export interface ComplianceTabProps {
  state: ComplianceTabState;
  /** Transaction OS 3.3E — enables the in-workspace Submit for Review action. */
  transactionId: string;
}

export default function ComplianceTab({ state, transactionId }: ComplianceTabProps) {
  return (
    <div className="space-y-5">
      <ReadinessHeader state={state} />
      <BlockersSection items={state.blockers} />
      <WarningsSection items={state.warnings} />
      <RequiredFormsSection items={state.requiredForms} />
      <StatutorySection items={state.statutory} />
      <BrokerReviewSection state={state.brokerReview} transactionId={transactionId} />
      <EnvelopeSection summary={state.envelope} />
      <GatesSection items={state.gates} degraded={state.payoutReadinessDegraded} />

      <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-4 py-3 text-[11px] text-[#71717A] leading-relaxed">
        <p className="inline-flex items-start gap-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          Read-only view. Compliance enforcement and commission release live
          in Vault. Broker confirmation is required for every change.
        </p>
        <a
          href={state.paperworkPackageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[#E8D5A3] hover:underline"
        >
          <FileText className="h-3 w-3" /> Open paperwork package in Vault
        </a>
      </div>
    </div>
  );
}

// ── 1. Readiness header ─────────────────────────────────────────────

function ReadinessHeader({ state }: { state: ComplianceTabState }) {
  const { readiness } = state;
  const tierLabel = humanTier(readiness.tier);
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A] inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#C9A84C]" />
          Compliance overview
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-[#71717A]">
          {readiness.stage}
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
        <span className="text-3xl font-semibold tabular-nums text-[#F1F1F3]">
          {readiness.score}
        </span>
        <span className="text-xs text-[#A1A1AA]">/ 100</span>
        <span className="text-[10px] uppercase tracking-wide text-[#71717A]">·</span>
        <span className="text-xs text-[#A1A1AA]">{tierLabel}</span>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 rounded bg-[#0b0b10] border border-[#1a1a2e] overflow-hidden mb-3">
        <div
          className="h-full bg-[#C9A84C]/70"
          style={{ width: `${Math.max(0, Math.min(100, readiness.score))}%` }}
        />
      </div>
      <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
        <span className="text-[#71717A] mr-1">Next:</span>
        {readiness.nextAction}
      </p>
      {readiness.suggestedPrompt && (
        <p className="text-[10px] text-[#71717A] leading-relaxed mt-1">
          {readiness.suggestedPrompt}
        </p>
      )}
    </section>
  );
}

// ── 2. Blockers ──────────────────────────────────────────────────────

function BlockersSection({ items }: { items: BlockerItem[] }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-300/80" />
        Blockers ({items.length})
      </h3>
      {items.length === 0 ? (
        <EmptyRow text="No blockers." />
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((b) => (
            <li
              key={b.key}
              className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <SeverityBadge severity={b.severity} />
                <div className="min-w-0 flex-1">
                  <div className="text-[#F1F1F3] text-xs">{b.label}</div>
                  {b.cta && (
                    <div className="mt-1">
                      <Link
                        href={b.cta.href}
                        className="text-[11px] text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
                      >
                        {b.cta.label}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── 3. Warnings ──────────────────────────────────────────────────────

function WarningsSection({ items }: { items: WarningItem[] }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <Hourglass className="h-3.5 w-3.5 text-[#71717A]" />
        Warnings ({items.length})
      </h3>
      {items.length === 0 ? (
        <EmptyRow text="No warnings." />
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((w) => (
            <li
              key={w.key}
              className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-xs text-[#A1A1AA]"
            >
              {w.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── 4. Required forms ───────────────────────────────────────────────

function RequiredFormsSection({ items }: { items: RequiredFormSummary[] }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 text-[#71717A]" />
        Required forms ({items.length})
      </h3>
      {items.length === 0 ? (
        <EmptyRow text="No required forms surfaced by the rule engine yet." />
      ) : (
        <ul className="space-y-1 text-sm rounded-md border border-[#1a1a2e] overflow-hidden divide-y divide-[#1a1a2e]">
          {items.map((f) => (
            <li
              key={f.form_id}
              className="px-3 py-2 hover:bg-[#1a1a25] transition-colors duration-[180ms]"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[#F1F1F3] text-xs font-medium">
                      {f.form_id}
                    </span>
                    {f.form_revision && (
                      <span className="text-[10px] text-[#71717A]">
                        {f.form_revision}
                      </span>
                    )}
                    <StatusPill
                      label={statusLabel(f.status)}
                      tone={statusTone(f.status)}
                    />
                    {f.form_category && (
                      <span className="text-[10px] text-[#71717A] uppercase tracking-wide">
                        {categoryLabel(f.form_category)}
                      </span>
                    )}
                  </div>
                  {f.reason && (
                    <div className="mt-0.5 text-[11px] text-[#A1A1AA] leading-relaxed">
                      {f.reason}
                    </div>
                  )}
                </div>
                <Link
                  href={f.drawerHref}
                  className="text-[11px] text-[#E8D5A3] hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── 5. Statutory disclosures ────────────────────────────────────────

function StatutorySection({ items }: { items: StatutoryItemSummary[] }) {
  const satisfied = items.filter((s) => s.satisfied).length;
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-[#71717A]" />
        Statutory disclosures ({satisfied} / {items.length} attested)
      </h3>
      {items.length === 0 ? (
        <EmptyRow text="No statutory disclosures required for this transaction." />
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((s) => (
            <li
              key={s.transaction_path}
              className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {s.satisfied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/90 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300/90 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[#F1F1F3] text-xs">{s.label}</div>
                  <div className="mt-0.5 text-[10px] text-[#71717A]">
                    {s.awaitingHint}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-[#71717A] leading-relaxed">
        Statutory facts can only be attested via the party portal. Vault
        enforces this at the database trigger.
      </p>
    </section>
  );
}

// ── 6. Broker review ────────────────────────────────────────────────

function BrokerReviewSection({
  state,
  transactionId,
}: {
  state: ComplianceTabState["brokerReview"];
  transactionId: string;
}) {
  // Agent may submit unless already awaiting review or approved.
  const canSubmit = !["submitted", "approved"].includes(state.status);
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <Hourglass className="h-3.5 w-3.5 text-[#71717A]" />
        Broker review
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#A1A1AA] text-xs">Status</span>
          <Pill tone={state.pill.tone}>{state.pill.label}</Pill>
        </div>
        {canSubmit && <SubmitForReviewButton transactionId={transactionId} />}
      </div>
    </section>
  );
}

// ── 7. Envelope summary ─────────────────────────────────────────────

function EnvelopeSection({ summary }: { summary: EnvelopeSummaryRow }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <Mail className="h-3.5 w-3.5 text-[#71717A]" />
        Envelopes
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pending" value={summary.pending} tone={summary.pending > 0 ? "info" : "muted"} />
        <Stat label="Signed" value={summary.signed} tone="ok" />
        <Stat label="Ready to send" value={summary.ready_awaiting_send} tone="muted" />
      </div>
      <p className="mt-2 text-[10px] text-[#71717A] leading-relaxed">
        Per-envelope detail (recipients, signed timestamps) lives in the
        Documents drawer for brokers.
      </p>
    </section>
  );
}

// ── 8. Readiness gates ──────────────────────────────────────────────

function GatesSection({
  items,
  degraded,
}: {
  items: GateSummary[];
  degraded: boolean;
}) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[#71717A]" />
        Readiness gates ({items.length})
      </h3>
      {degraded && (
        <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-[11px] text-[#71717A] leading-relaxed mb-2 inline-flex items-start gap-1.5">
          <Clock className="h-3 w-3 mt-0.5 shrink-0" />
          Payout-readiness signals are temporarily unavailable. Other
          sections are unaffected.
        </div>
      )}
      <ul className="space-y-1 text-sm">
        {items.map((g) => (
          <li
            key={g.key}
            className="flex items-start justify-between gap-2 px-3 py-1.5 rounded-md border border-[#1a1a2e] bg-[#0b0b10]"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <GateIcon status={g.status} />
              <span className="text-[#F1F1F3] text-xs truncate">{g.label}</span>
            </div>
            <span className="text-[10px] text-[#71717A] shrink-0">
              {g.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-[11px] text-[#71717A] leading-relaxed">
      {text}
    </div>
  );
}

function GateIcon({ status }: { status: GateStatus }) {
  if (status === "ok") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/90 shrink-0" />;
  }
  if (status === "warning") {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-300/90 shrink-0" />;
  }
  if (status === "blocked") {
    return <AlertCircle className="h-3.5 w-3.5 text-rose-300/90 shrink-0" />;
  }
  return <Clock className="h-3.5 w-3.5 text-[#71717A] shrink-0" />;
}

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "info" | "warn" | "muted";
}) {
  return <Pill tone={tone}>{label}</Pill>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone = severityTone(severity);
  return (
    <Pill tone={tone === "muted" ? "muted" : tone === "warn" ? "warn" : "info"}>
      {humanSeverity(severity)}
    </Pill>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "info" | "muted";
}) {
  const v =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "info"
      ? "text-sky-300"
      : "text-[#A1A1AA]";
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-2 py-2 text-center">
      <div className={`text-xl font-semibold tabular-nums leading-none ${v}`}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-[#71717A] mt-1">
        {label}
      </div>
    </div>
  );
}

function humanTier(t: string): string {
  if (t === "collecting") return "Collecting";
  if (t === "drafting") return "Drafting";
  if (t === "almost_ready") return "Almost ready";
  if (t === "ready_for_review") return "Ready for review";
  if (t === "ready_for_signature") return "Ready for signature";
  return t;
}
