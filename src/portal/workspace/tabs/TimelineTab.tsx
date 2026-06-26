// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.3.1 — Timeline tab (read-only)
// ============================================================================
// Pure presentation — consumes a composed TimelineTabState. NO commission
// amounts, NO Stripe data, NO broker notes, NO raw audit-log strings
// (every visible string is composer-owned). NO approve / reject / pay /
// release / close / send / generate / refresh actions.
//
// Two modes:
//   broker → full timeline from Vault's /history; filter chips visible
//   agent  → degraded milestone view; banner explains detailed history
//            lives in the Vault paperwork package
// ============================================================================

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Hourglass,
  ListChecks,
  Mail,
  Milestone,
  Pencil,
  Shield,
  UserCircle2,
} from "lucide-react";

import type {
  TimelineCard,
  TimelineDayGroup,
  TimelineTabState,
  TimelineTone,
} from "../timeline/types";

export interface TimelineTabProps {
  state: TimelineTabState;
}

export default function TimelineTab({ state }: TimelineTabProps) {
  return (
    <div className="space-y-4">
      <Header state={state} />

      {state.historyFetchError && (
        <ErrorBanner
          text={`Couldn't load activity log (${state.historyFetchError}). Showing snapshot milestones below.`}
        />
      )}

      {state.isDegraded && <DegradedBanner />}

      {state.groups.length === 0 ? (
        <EmptySection />
      ) : (
        <ul className="space-y-4">
          {state.groups.map((g) => (
            <DayGroup key={g.dateKey} group={g} />
          ))}
        </ul>
      )}

      <Footer paperworkPackageUrl={state.paperworkPackageUrl} />
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────

function Header({ state }: { state: TimelineTabState }) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A] inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-[#C9A84C]" />
          Activity
        </h2>
        <span className="text-[10px] text-[#71717A]">
          {state.totalCount} {state.totalCount === 1 ? "event" : "events"}
        </span>
      </div>
      {state.filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {state.filterChips.map((c) => (
            <span
              key={c.key}
              className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] text-[10px] uppercase tracking-wide text-[#A1A1AA] px-1.5 py-0.5"
              title={`Filter: ${c.label}`}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Banners ─────────────────────────────────────────────────────────

function DegradedBanner() {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-4 py-3 text-[11px] text-[#71717A] leading-relaxed inline-flex items-start gap-1.5">
      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
      <span>
        Showing a snapshot of current state. The full audit log (broker
        review actions, statutory attestations, envelope events) lives in
        the Vault paperwork package and is visible to brokers.
      </span>
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-[11px] text-rose-200 leading-relaxed inline-flex items-start gap-1.5">
      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function EmptySection() {
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-4 py-6 text-center text-[11px] text-[#71717A] leading-relaxed">
      No activity yet.
    </div>
  );
}

// ── Day groups + cards ──────────────────────────────────────────────

function DayGroup({ group }: { group: TimelineDayGroup }) {
  return (
    <li>
      <div className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2">
        {group.label}
      </div>
      <ul className="rounded-lg border border-[#1a1a2e] overflow-hidden divide-y divide-[#1a1a2e]">
        {group.cards.map((c) => (
          <CardRow key={c.id} card={c} />
        ))}
      </ul>
    </li>
  );
}

function CardRow({ card }: { card: TimelineCard }) {
  return (
    <li className="bg-[#11111a] px-4 py-3 hover:bg-[#1a1a25] transition-colors duration-[180ms]">
      <div className="flex items-start gap-3">
        <CardIcon name={card.iconName} tone={card.tone} />
        <div className="min-w-0 flex-1">
          <div className="text-[#F1F1F3] text-xs font-medium truncate">
            {card.label}
          </div>
          {card.detail && (
            <div className="mt-0.5 text-[11px] text-[#A1A1AA] leading-relaxed">
              {card.detail}
            </div>
          )}
          <div className="mt-1 text-[10px] text-[#71717A] inline-flex items-center gap-2">
            <time dateTime={card.occurred_at}>{formatTime(card.occurred_at)}</time>
            {card.source && <span>· {card.source}</span>}
          </div>
        </div>
        {card.drillHref && (
          <Link
            href={card.drillHref}
            className="shrink-0 text-[11px] text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
          >
            Open
          </Link>
        )}
      </div>
    </li>
  );
}

// ── Footer ──────────────────────────────────────────────────────────

function Footer({ paperworkPackageUrl }: { paperworkPackageUrl: string }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-4 py-3 text-[11px] text-[#71717A] leading-relaxed">
      <p className="inline-flex items-start gap-1">
        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
        Read-only view. Vault owns the audit log; every event here is a
        safe presentation of a Vault record.
      </p>
      <a
        href={paperworkPackageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[#E8D5A3] hover:underline"
      >
        <FileText className="h-3 w-3" /> Open paperwork package in Vault
      </a>
    </div>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

function CardIcon({
  name,
  tone,
}: {
  name: TimelineCard["iconName"];
  tone: TimelineTone;
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
  switch (name) {
    case "file-text":
      return <FileText className={`${sz} ${cls}`} />;
    case "pencil":
      return <Pencil className={`${sz} ${cls}`} />;
    case "user-circle-2":
      return <UserCircle2 className={`${sz} ${cls}`} />;
    case "mail":
      return <Mail className={`${sz} ${cls}`} />;
    case "shield":
      return <Shield className={`${sz} ${cls}`} />;
    case "check-circle-2":
      return <CheckCircle2 className={`${sz} ${cls}`} />;
    case "alert-triangle":
      return <AlertTriangle className={`${sz} ${cls}`} />;
    case "alert-circle":
      return <AlertCircle className={`${sz} ${cls}`} />;
    case "hourglass":
      return <Hourglass className={`${sz} ${cls}`} />;
    case "clock":
      return <Clock className={`${sz} ${cls}`} />;
    case "milestone":
      return <Milestone className={`${sz} ${cls}`} />;
    case "list-checks":
      return <ListChecks className={`${sz} ${cls}`} />;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
