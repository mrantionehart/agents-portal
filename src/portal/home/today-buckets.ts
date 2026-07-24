// ============================================================================
// TODAY B.001 · Slice 1 — Pure bucketing module for the Home "Today" surface
// ============================================================================
// Classifies the agent's workspace cards into urgency buckets using ONLY the
// Vault-provided `deadline_summary` block (TXN-OS 3.2C/D). The Portal never
// recomputes deadlines or urgency — it groups on Vault's `days_remaining` and
// `overdue_count` integers. This module is PURE: deterministic, side-effect-free,
// React-free, fetch-free, UI-free. It is the contract every later Today slice
// (TodayRow / TodaySection / Home reorder) depends on.
//
// Bucket rules (per approved I.001 contract):
//   • not projectable (no summary, or overdue_count===0 AND days_remaining null)
//        → excluded from all buckets (never fabricate urgency)
//   • overdue_count > 0  OR  days_remaining < 0   → overdue
//   • days_remaining === 0                        → dueToday
//   • 1 ≤ days_remaining ≤ 7                       → dueThisWeek
//   • days_remaining > 7                          → upcoming
// Ordering within a bucket: soonest / most-overdue first (days_remaining asc),
// then priority (critical→low), then property_address.
// ============================================================================

import type { DeadlineSummary, WorkspaceCard } from "../workspace/types";

export type TodayBucketKey = "overdue" | "dueToday" | "dueThisWeek" | "upcoming";

export interface TodayBuckets {
  overdue: WorkspaceCard[];
  dueToday: WorkspaceCard[];
  dueThisWeek: WorkspaceCard[];
  upcoming: WorkspaceCard[];
}

const DUE_THIS_WEEK_MAX_DAYS = 7;

const PRIORITY_RANK: Record<DeadlineSummary["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** The finite numeric `days_remaining`, or null when Vault didn't supply one. */
function daysRemaining(ds: DeadlineSummary): number | null {
  return typeof ds.days_remaining === "number" && Number.isFinite(ds.days_remaining) ? ds.days_remaining : null;
}

/** Vault's overdue signal count (defaults to 0 when absent). */
function overdueCount(ds: DeadlineSummary): number {
  return typeof ds.overdue_count === "number" && Number.isFinite(ds.overdue_count) ? ds.overdue_count : 0;
}

/**
 * Classify a single card by Vault-provided values only. Returns null when the
 * card is not projectable onto the Today surface (no usable deadline signal).
 */
export function classifyCard(card: WorkspaceCard): TodayBucketKey | null {
  const ds = card.deadline_summary;
  if (!ds) return null;
  const oc = overdueCount(ds);
  const days = daysRemaining(ds);

  // overdue_count wins even if the *next* pending deadline is in the future.
  if (oc > 0) return "overdue";
  if (days === null) return null; // no overdue signal and no usable date → not projectable
  if (days < 0) return "overdue";
  if (days === 0) return "dueToday";
  if (days >= 1 && days <= DUE_THIS_WEEK_MAX_DAYS) return "dueThisWeek";
  return "upcoming"; // days > 7
}

/** Deterministic ordering: soonest/most-overdue first, then priority, then property. */
function compareCards(a: WorkspaceCard, b: WorkspaceCard): number {
  const da = a.deadline_summary ? daysRemaining(a.deadline_summary) : null;
  const db = b.deadline_summary ? daysRemaining(b.deadline_summary) : null;
  // Null days sort last within the bucket (only reachable for overdue_count-only rows).
  const ka = da === null ? Number.POSITIVE_INFINITY : da;
  const kb = db === null ? Number.POSITIVE_INFINITY : db;
  if (ka !== kb) return ka - kb;

  const pa = PRIORITY_RANK[a.deadline_summary?.priority ?? "low"];
  const pb = PRIORITY_RANK[b.deadline_summary?.priority ?? "low"];
  if (pa !== pb) return pa - pb;

  return (a.property_address ?? "").localeCompare(b.property_address ?? "");
}

/**
 * Group the agent's cards into the four Today buckets. Always returns all four
 * arrays (any may be empty); rendering decides which sections to show. Pure.
 */
export function bucketToday(cards: WorkspaceCard[]): TodayBuckets {
  const buckets: TodayBuckets = { overdue: [], dueToday: [], dueThisWeek: [], upcoming: [] };
  for (const card of cards) {
    const key = classifyCard(card);
    if (key) buckets[key].push(card);
  }
  buckets.overdue.sort(compareCards);
  buckets.dueToday.sort(compareCards);
  buckets.dueThisWeek.sort(compareCards);
  buckets.upcoming.sort(compareCards);
  return buckets;
}
