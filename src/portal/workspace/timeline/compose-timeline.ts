// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.3.1 — Timeline composer
// ============================================================================
// Pure function. Given the role-gated fetch result + already-loaded
// snapshot signals, builds a grouped-by-day list of safe TimelineCards.
//
// Two paths:
//   broker → cards from /history (already mapped to safe TimelineCards
//            by safe-history-event.ts), grouped by day.
//   agent  → degraded MILESTONE list composed from WorkspaceCard +
//            transactions snapshot + missing-fields aggregates. NO
//            audit log events. Banner explains detailed history lives
//            in the Vault paperwork package.
// ============================================================================

import type { WorkspaceCard } from "../types";
import type { DocumentRow } from "../../documents/types";
import type { FetchTimelineResult } from "./api";
import type {
  TimelineCard,
  TimelineDayGroup,
  TimelineRoleClass,
  TimelineTabState,
} from "./types";

export interface ComposeTimelineInputs {
  callerRole: string | null | undefined;
  card: WorkspaceCard;
  documents: ReadonlyArray<DocumentRow>;
  transactionStatus: string | null;
  brokerReviewStatus: string | null;
  closingDate: string | null;
  /** From W3.2.C.2 missing-fields page-level load. */
  statutoryCount: number;
  satisfiedStatutoryCount: number;
  /** Result of fetchTimelineHistorySafely. */
  history: FetchTimelineResult;
  paperworkPackageUrl: string;
  /** Now timestamp injection point (server). */
  now?: Date;
}

export function composeTimelineState(
  input: ComposeTimelineInputs
): TimelineTabState {
  const callerRoleClass: TimelineRoleClass =
    input.history.kind === "broker" ? "broker" : "agent";
  const isDegraded = callerRoleClass === "agent";

  const now = input.now ?? new Date();

  let cards: TimelineCard[];
  let historyFetchError: string | null = null;
  if (input.history.kind === "broker") {
    cards = [...input.history.cards];
  } else if (input.history.kind === "error") {
    // Broker tier whose /history call failed — fall back to milestones.
    cards = composeMilestoneCards(input, now);
    historyFetchError = input.history.message;
  } else {
    // Agent — milestone view only.
    cards = composeMilestoneCards(input, now);
  }

  // Sort cards by occurred_at DESC (newest first).
  cards.sort((a, b) => compareIsoDesc(a.occurred_at, b.occurred_at));

  const groups = groupByDay(cards, now);
  const filterChips = callerRoleClass === "broker" ? BROKER_FILTER_CHIPS : [];

  return {
    callerRoleClass,
    isDegraded,
    groups,
    historyFetchError,
    paperworkPackageUrl: input.paperworkPackageUrl,
    filterChips,
    totalCount: cards.length,
  };
}

// ── Milestone composition (agent view) ──────────────────────────────

function composeMilestoneCards(
  input: ComposeTimelineInputs,
  now: Date
): TimelineCard[] {
  const cards: TimelineCard[] = [];
  const c = input.card;

  // 1. Closing date milestone (future-dated when in the future)
  if (input.closingDate) {
    cards.push({
      id: "milestone:closing-date",
      occurred_at: input.closingDate,
      kind: "milestone",
      tone: input.transactionStatus === "closed" ? "ok" : "info",
      iconName: "milestone",
      label:
        input.transactionStatus === "closed"
          ? "Transaction closed"
          : "Scheduled closing date",
      detail: formatDateOnly(input.closingDate),
    });
  }

  // 2. Broker review status milestone (right now is the only marker we
  //    have without /history). Anchored to `now` because we don't have
  //    a state-transition timestamp.
  const review = (input.brokerReviewStatus ?? "").toLowerCase();
  if (review) {
    cards.push({
      id: "milestone:broker-review",
      occurred_at: now.toISOString(),
      kind: "review",
      tone:
        review === "approved"
          ? "ok"
          : review === "revisions_required"
          ? "warn"
          : review === "submitted"
          ? "info"
          : "muted",
      iconName: "user-circle-2",
      label: brokerReviewLabel(review),
    });
  }

  // 3. Forms summary milestone (current state snapshot).
  if (c.required_forms_count > 0) {
    cards.push({
      id: "milestone:forms-summary",
      occurred_at: now.toISOString(),
      kind: "milestone",
      tone:
        c.signed_forms_count === c.required_forms_count
          ? "ok"
          : c.blocked_forms_count > 0
          ? "warn"
          : "info",
      iconName: "file-text",
      label: `${c.signed_forms_count} of ${c.required_forms_count} required forms signed`,
      detail:
        c.blocked_forms_count > 0
          ? `${c.blocked_forms_count} blocked`
          : c.ready_forms_count > 0
          ? `${c.ready_forms_count} ready`
          : undefined,
    });
  }

  // 4. Statutory disclosures snapshot.
  if (input.statutoryCount + input.satisfiedStatutoryCount > 0) {
    cards.push({
      id: "milestone:statutory",
      occurred_at: now.toISOString(),
      kind: "compliance",
      tone:
        input.statutoryCount === 0
          ? "ok"
          : "warn",
      iconName: "shield",
      label: `${input.satisfiedStatutoryCount} of ${
        input.satisfiedStatutoryCount + input.statutoryCount
      } statutory disclosures attested`,
    });
  }

  // 5. Envelopes summary snapshot.
  if (c.pending_envelopes_count > 0 || c.signed_forms_count > 0) {
    cards.push({
      id: "milestone:envelopes",
      occurred_at: now.toISOString(),
      kind: "envelope",
      tone: c.pending_envelopes_count > 0 ? "info" : "ok",
      iconName: "mail",
      label:
        c.pending_envelopes_count > 0
          ? `${c.pending_envelopes_count} envelope${c.pending_envelopes_count === 1 ? "" : "s"} awaiting signatures`
          : "All envelopes signed",
    });
  }

  // 6. Stage milestone (always last, anchored to now).
  cards.push({
    id: "milestone:stage",
    occurred_at: now.toISOString(),
    kind: "milestone",
    tone: "muted",
    iconName: "list-checks",
    label: c.stage || "Stage",
    detail: c.next_action || undefined,
  });

  return cards;
}

function brokerReviewLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft — not yet submitted for review";
    case "submitted":
      return "Submitted for broker review";
    case "approved":
      return "Approved by broker";
    case "revisions_required":
      return "Broker requested revisions";
    default:
      return `Broker review: ${status}`;
  }
}

// ── Day grouping ────────────────────────────────────────────────────

const BROKER_FILTER_CHIPS = [
  { key: "all", label: "All" },
  { key: "documents", label: "Documents" },
  { key: "broker", label: "Broker review" },
  { key: "envelope", label: "Envelopes" },
  { key: "compliance", label: "Compliance" },
] as const;

function groupByDay(
  cards: ReadonlyArray<TimelineCard>,
  now: Date
): TimelineDayGroup[] {
  const byKey = new Map<string, TimelineCard[]>();
  for (const c of cards) {
    const d = new Date(c.occurred_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = isoDateKey(d);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(c);
  }
  // Sort keys DESC so most recent day first.
  const keys = [...byKey.keys()].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const groups: TimelineDayGroup[] = [];
  for (const k of keys) {
    groups.push({
      dateKey: k,
      label: dayLabel(k, now),
      cards: byKey.get(k)!,
    });
  }
  return groups;
}

function isoDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(key: string, now: Date): string {
  const today = isoDateKey(now);
  if (key === today) return "Today";
  const yesterday = isoDateKey(new Date(now.getTime() - 86400000));
  if (key === yesterday) return "Yesterday";
  // Format as "Mon, Jun 23"
  const parts = key.split("-");
  const dt = new Date(
    Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  );
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function compareIsoDesc(a: string, b: string): number {
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
