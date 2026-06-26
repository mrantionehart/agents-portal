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
import type { FetchCommissionResult } from "../commission/api";
import type {
  CommissionGateVerdict,
  SafeCommissionRow,
} from "../commission/types";

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
  /** W3.4.3.2 — Commission lifecycle synthesis. Already loaded by the
   *  W3.4.3.1 page batch; passed through here so the Timeline shows
   *  the same lifecycle the Commission Workspace explains.
   *  • Optional — when absent, no commission cards are emitted.
   *  • Carries only the SAFE projection (no amounts / Stripe IDs /
   *    broker notes — guaranteed by W3.4.3.1's SafeCommissionRow). */
  commission?: FetchCommissionResult;
  /** Base path for drill links (e.g. "/workspace/<txnId>"). Used by
   *  commission lifecycle cards to deep-link into the Commission tab. */
  workspaceBaseUrl?: string;
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

  // W3.4.3.2 + W3.4.4.1 — Merge synthesized commission lifecycle cards.
  // Pure derivation from the safe commission projection + gate verdict
  // already loaded by the W3.4.3.1 page batch.
  //
  // W3.4.4.1: skip synthesis on the broker tier — Vault now emits
  // commission lifecycle audit rows (W3.4.4.0) that flow into the
  // broker tier via /history, and the safe-history-event mapper
  // renders them as kind='commission' cards. Synthesis on the broker
  // tier would duplicate those cards.
  //
  // Agent tier keeps synthesis as the degraded-view fallback because
  // /history is broker-only.
  if (
    input.commission &&
    input.commission.kind === "ok" &&
    callerRoleClass !== "broker"
  ) {
    cards.push(
      ...composeCommissionLifecycleCards(
        input.commission.commission,
        input.commission.verdict,
        input.workspaceBaseUrl ?? null,
        now
      )
    );
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

// ── Commission lifecycle synthesis (W3.4.3.2) ───────────────────────
// Pure. Derives 0-6 commission lifecycle cards from the SAFE projection
// (W3.4.3.1) + the W3.4.3.0 gate verdict. Same shape as the rest of
// the timeline — sort/group/render unchanged.
//
// SAFETY CONTRACT — by construction:
//   • Input type (SafeCommissionRow + CommissionGateVerdict) has NO
//     amounts / splits / cap math / Stripe IDs / broker notes
//   • Cards never reference those field NAMES either
//   • Payment-method labels are humanized strings; raw enum stays in
//     the safe projection but never reaches the card detail directly
//
// Card emission rules:
//   • "Commission calculated" — emit whenever a commission row exists
//     and status has moved past pending_calculation
//   • "Awaiting broker approval" — emit only when in calculated /
//     compliance_check
//   • "Broker approved commission" — emit when approved_at is set
//   • "Payment blocked" — emit only when status='broker_approved' AND
//     gate verdict has blockers. (For broker tier, /history already
//     surfaces every historical blocked attempt; this card is the
//     CURRENT-state snapshot for the agent path.)
//   • "Payment processing" — emit when status='payment_processing'
//   • "Commission paid" — emit when paid_at is set
//   • "Commission disputed" — emit when status='disputed'
//
// Timestamps:
//   • approved_at + paid_at are real — used directly
//   • "calculated" anchors to `now` (no explicit calculated_at field
//     on the safe projection; the existence of the row implies it
//     happened — using `now` keeps it visible above older events)
//   • "blocked" / "awaiting" / "processing" / "disputed" are CURRENT-
//     STATE markers, anchored to `now`
function composeCommissionLifecycleCards(
  commission: SafeCommissionRow,
  verdict: CommissionGateVerdict | null,
  workspaceBaseUrl: string | null,
  now: Date
): TimelineCard[] {
  const cards: TimelineCard[] = [];
  const status = commission.commission_status;
  const drillHref = workspaceBaseUrl
    ? `${workspaceBaseUrl}?tab=commission`
    : undefined;

  const STATUS_PROGRESS: Record<string, number> = {
    pending_calculation: 0,
    calculated: 1,
    compliance_check: 2,
    broker_approved: 3,
    payment_processing: 4,
    paid: 5,
    disputed: 6,
  };
  const progress = STATUS_PROGRESS[status] ?? 0;

  // 1. "Commission calculated" — once past pending_calculation.
  if (progress >= STATUS_PROGRESS.calculated) {
    cards.push({
      id: "commission:calculated",
      occurred_at: now.toISOString(),
      kind: "commission",
      tone: "info",
      iconName: "pencil",
      label: "Commission calculated",
      drillHref,
    });
  }

  // 2. "Awaiting broker approval" — only when still in calc /
  //    compliance_check stages.
  if (
    status === "calculated" ||
    status === "compliance_check"
  ) {
    cards.push({
      id: "commission:awaiting",
      occurred_at: now.toISOString(),
      kind: "commission",
      tone: "info",
      iconName: "hourglass",
      label: "Awaiting broker approval",
      detail: "Broker review needed before payout.",
      drillHref,
    });
  }

  // 3. "Broker approved commission" — uses real approved_at when set.
  if (commission.approved_at) {
    cards.push({
      id: "commission:approved",
      occurred_at: commission.approved_at,
      kind: "commission",
      tone: "ok",
      iconName: "check-circle-2",
      label: "Broker approved commission",
      drillHref,
    });
  }

  // 4. "Payment blocked" — current-state marker. Only emit when the
  //    commission has reached broker_approved AND the gate is failing.
  //    (Historical blocks already appear via /history for broker tier.)
  if (
    status === "broker_approved" &&
    verdict &&
    !verdict.payable &&
    verdict.blockers.length > 0
  ) {
    const n = verdict.blockers.length;
    cards.push({
      id: "commission:blocked",
      occurred_at: now.toISOString(),
      kind: "commission",
      tone: "warn",
      iconName: "alert-triangle",
      label: "Commission payment blocked",
      detail: `${n} gate${n === 1 ? "" : "s"} not yet clear.`,
      drillHref,
    });
  }

  // 5. "Payment processing" — only when status is explicitly set.
  if (status === "payment_processing") {
    cards.push({
      id: "commission:processing",
      occurred_at: now.toISOString(),
      kind: "commission",
      tone: "info",
      iconName: "hourglass",
      label: "Commission payment processing",
      drillHref,
    });
  }

  // 6. "Commission paid" — uses real paid_at when set.
  if (commission.paid_at) {
    cards.push({
      id: "commission:paid",
      occurred_at: commission.paid_at,
      kind: "commission",
      tone: "ok",
      iconName: "check-circle-2",
      label: "Commission paid",
      detail: paymentMethodDetail(commission.payment_method),
      drillHref,
    });
  }

  // 7. "Commission disputed" — current-state.
  if (status === "disputed") {
    cards.push({
      id: "commission:disputed",
      occurred_at: now.toISOString(),
      kind: "commission",
      tone: "warn",
      iconName: "alert-triangle",
      label: "Commission disputed",
      detail: "Broker flagged this commission.",
      drillHref,
    });
  }

  return cards;
}

function paymentMethodDetail(method: string | null): string | undefined {
  switch (method) {
    case "ach":
      return "Paid via ACH direct deposit.";
    case "wire":
      return "Paid via wire transfer.";
    case "check":
      return "Paid by check.";
    default:
      return undefined;
  }
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
  { key: "commission", label: "Commission" },
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
