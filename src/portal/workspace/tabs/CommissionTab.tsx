// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.4.3.1 — Commission Workspace (read-only)
// ============================================================================
// Pure presentation — consumes a composed CommissionWorkspaceState. NO
// commission amounts, NO splits, NO Stripe IDs, NO broker notes, NO cap
// math, NO payout IDs (composer's input types exclude them by construction).
// NO approve / pay / release / close / override / refresh actions.
//
// Replaces the W3.1 placeholder. The composer (compose-commission.ts) and
// the fetcher (api.ts) handle all logic.
// ============================================================================

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Milestone,
  Receipt,
  Shield,
  Sparkles,
  UserCircle2,
  Wallet,
} from "lucide-react";

import type {
  CommissionTone,
  CommissionWorkspaceState,
} from "../commission/types";

export interface CommissionTabProps {
  state: CommissionWorkspaceState;
}

export default function CommissionTab({ state }: CommissionTabProps) {
  return (
    <div className="space-y-4">
      <Header state={state} />

      {state.gateFetchError && (
        <ErrorBanner
          text={`Gate verdict unavailable (${state.gateFetchError}). Showing commission summary without per-gate detail.`}
        />
      )}

      {state.isEmpty ? null : <ReadinessScore state={state} />}

      <GateChecklist state={state} />

      {!state.isEmpty && state.blockers.length > 0 && (
        <BlockingReasons state={state} />
      )}

      <SideSummary state={state} />

      {state.paymentHistory && <PaymentHistory state={state} />}

      <Footer state={state} />
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function Header({ state }: { state: CommissionWorkspaceState }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A] inline-flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-[#C9A84C]" />
          Commission
        </h2>
        <span className="text-[10px] text-[#71717A] inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> Read-only
        </span>
      </div>
      <div className="flex items-start gap-3">
        <ToneIcon tone={state.stageTone} kind="stage" />
        <div className="min-w-0 flex-1">
          <div className="text-[#F1F1F3] text-sm font-medium">
            {state.stageLabel}
          </div>
          <div className="mt-0.5 text-[11px] text-[#A1A1AA] leading-relaxed">
            {state.stageDescription}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReadinessScore({ state }: { state: CommissionWorkspaceState }) {
  const segments = Array.from({ length: state.readinessScore.total }, (_, i) =>
    i < state.readinessScore.passing ? "ok" : "muted"
  ) as ReadonlyArray<CommissionTone>;
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-5 py-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-wider text-[#71717A]">
          Readiness
        </div>
        <div className="text-[11px] text-[#A1A1AA]">
          {state.readinessScore.passing} of {state.readinessScore.total} gates
          passing
        </div>
      </div>
      <div className="flex gap-1">
        {segments.map((tone, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              tone === "ok" ? "bg-emerald-400/80" : "bg-[#1a1a2e]"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

// ── Gate checklist ──────────────────────────────────────────────────

function GateChecklist({ state }: { state: CommissionWorkspaceState }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a]">
      <div className="px-5 py-3 border-b border-[#1a1a2e] text-[10px] uppercase tracking-wider text-[#71717A]">
        Gate checklist
      </div>
      <ul className="divide-y divide-[#1a1a2e]">
        {state.gateRows.map((row) => (
          <li key={row.key} className="px-5 py-3 flex items-start gap-3">
            <ToneIcon tone={row.tone} kind="row" />
            <div className="min-w-0 flex-1">
              <div className="text-[#F1F1F3] text-xs font-medium">
                {row.label}
              </div>
              {row.detail && (
                <div className="mt-0.5 text-[11px] text-[#A1A1AA] leading-relaxed">
                  {row.detail}
                </div>
              )}
            </div>
            {row.drillHref && row.tone !== "ok" && (
              <Link
                href={row.drillHref}
                className="shrink-0 text-[11px] text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
              >
                Open
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Blocking reasons ────────────────────────────────────────────────

function BlockingReasons({ state }: { state: CommissionWorkspaceState }) {
  return (
    <section className="rounded-lg border border-amber-700/40 bg-amber-900/15 px-5 py-4">
      <div className="text-[10px] uppercase tracking-wider text-amber-200 mb-2 inline-flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        Blocking reasons
      </div>
      <ul className="space-y-1.5">
        {state.blockers.map((b) => (
          <li key={b.key} className="text-[11px] text-amber-100 leading-relaxed">
            • {b.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Side summary (broker review + compliance + closing date) ────────

function SideSummary({ state }: { state: CommissionWorkspaceState }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a]">
      <ul className="divide-y divide-[#1a1a2e]">
        <SummaryRow
          icon="user"
          label="Broker review"
          value={state.brokerReviewLabel}
          tone={state.brokerReviewTone}
          drillHref={state.drillLinks.timeline}
        />
        <SummaryRow
          icon="shield"
          label="Compliance"
          value={state.complianceLabel}
          tone={state.complianceTone}
          drillHref={state.drillLinks.compliance}
        />
        {state.closingDateLabel && (
          <SummaryRow
            icon="milestone"
            label="Closing"
            value={state.closingDateLabel}
            tone="info"
            drillHref={null}
          />
        )}
      </ul>
    </section>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  tone,
  drillHref,
}: {
  icon: "user" | "shield" | "milestone";
  label: string;
  value: string;
  tone: CommissionTone;
  drillHref: string | null;
}) {
  return (
    <li className="px-5 py-3 flex items-center gap-3">
      <RowIcon icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-[#71717A]">
          {label}
        </div>
        <div className="text-xs text-[#F1F1F3]">{value}</div>
      </div>
      {drillHref && (
        <Link
          href={drillHref}
          className="shrink-0 text-[11px] text-[#E8D5A3] hover:underline"
        >
          Open
        </Link>
      )}
    </li>
  );
}

// ── Payment history ─────────────────────────────────────────────────

function PaymentHistory({ state }: { state: CommissionWorkspaceState }) {
  const p = state.paymentHistory!;
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-5 py-4">
      <div className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2 inline-flex items-center gap-1.5">
        <Receipt className="h-3 w-3" />
        Payment history
      </div>
      <div className="space-y-1 text-[11px] text-[#A1A1AA]">
        <div>
          Paid <time dateTime={p.paidAt}>{formatDate(p.paidAt)}</time> by{" "}
          {p.methodLabel}
        </div>
        {p.referenceTail && (
          <div>
            Reference ending in{" "}
            <span className="text-[#F1F1F3]">{p.referenceTail}</span>
          </div>
        )}
        {p.hasStatement && (
          <div className="text-[#71717A] italic">
            Commission statement available in Vault.
          </div>
        )}
      </div>
    </section>
  );
}

// ── Footer ──────────────────────────────────────────────────────────

function Footer({ state }: { state: CommissionWorkspaceState }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-5 py-4 text-[11px] text-[#71717A] leading-relaxed">
      <p className="inline-flex items-start gap-1.5 mb-2">
        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
        Read-only view. Vault owns commission state. Payout is handled by the
        broker in Vault.
      </p>
      <a
        href={state.drillLinks.paperworkPackage}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[#E8D5A3] hover:underline"
      >
        <ExternalLink className="h-3 w-3" /> Open paperwork package in Vault
      </a>
    </div>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-[11px] text-rose-200 leading-relaxed inline-flex items-start gap-1.5">
      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function ToneIcon({
  tone,
  kind,
}: {
  tone: CommissionTone;
  kind: "stage" | "row";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-300/90"
      : tone === "warn"
      ? "text-amber-300/90"
      : tone === "info"
      ? "text-sky-300/90"
      : "text-[#71717A]";
  const sz =
    kind === "stage"
      ? "h-4 w-4 mt-0.5 shrink-0"
      : "h-3.5 w-3.5 mt-0.5 shrink-0";
  switch (tone) {
    case "ok":
      return <CheckCircle2 className={`${sz} ${cls}`} />;
    case "warn":
      return <AlertTriangle className={`${sz} ${cls}`} />;
    case "info":
      return <Sparkles className={`${sz} ${cls}`} />;
    case "muted":
      return <Clock className={`${sz} ${cls}`} />;
  }
}

function RowIcon({
  icon,
  tone,
}: {
  icon: "user" | "shield" | "milestone";
  tone: CommissionTone;
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-300/90"
      : tone === "warn"
      ? "text-amber-300/90"
      : tone === "info"
      ? "text-sky-300/90"
      : "text-[#71717A]";
  const sz = "h-3.5 w-3.5 shrink-0";
  switch (icon) {
    case "user":
      return <UserCircle2 className={`${sz} ${cls}`} />;
    case "shield":
      return <Shield className={`${sz} ${cls}`} />;
    case "milestone":
      return <Milestone className={`${sz} ${cls}`} />;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
