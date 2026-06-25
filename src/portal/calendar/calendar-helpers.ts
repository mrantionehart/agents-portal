// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Calendar helpers
// ============================================================================
// Lightweight deadlines derivation from the existing Vault
// /api/platform/workspace WorkspaceCard shape. WorkspaceCard does NOT
// currently carry contract / closing / inspection dates — once Vault
// adds them, this module can light them up. Until then it surfaces
// active deals grouped by priority bucket as a placeholder calendar.
// ============================================================================

import type { WorkspaceCard } from "../workspace/types";

// ── Bucket model (Today / This Week / Upcoming) ─────────────────────

export type CalendarBucket = "today" | "this_week" | "upcoming" | "none";

export interface CalendarItem {
  card: WorkspaceCard;
  bucket: CalendarBucket;
  /** "no_date_data" — the WorkspaceCard didn't expose a date; this
   *  placeholder will become a real ISO date once Vault surfaces
   *  contract / closing dates on the workspace endpoint. */
  reason: "no_date_data" | "derived";
  /** ISO date (UTC) when bucket === "today" / "this_week" / "upcoming"
   *  and reason === "derived". Always null while WorkspaceCard lacks
   *  the date field. */
  date_iso: string | null;
}

export interface BucketCounts {
  today: number;
  this_week: number;
  upcoming: number;
  // Items the WorkspaceCard couldn't place on a date.
  no_date_data: number;
}

/**
 * Categorize a card into a calendar bucket. Today's
 * WorkspaceCard doesn't expose any dates — every card lands in
 * "no_date_data" with reason "no_date_data" until Vault enriches
 * the response. This is the documented graceful placeholder.
 *
 * The function signature is deliberately date-aware so that a future
 * WorkspaceCard with `contract_date` / `closing_date` can replace the
 * branch without changing call sites.
 */
export function bucketForCard(
  card: WorkspaceCard,
  _now: Date = new Date()
): CalendarItem {
  return {
    card,
    bucket: "none",
    reason: "no_date_data",
    date_iso: null,
  };
}

/**
 * Group cards into the documented Today / This Week / Upcoming
 * sections. While WorkspaceCard lacks date fields, every card ends
 * up in the placeholder section.
 */
export function groupCardsByBucket(
  cards: WorkspaceCard[],
  now: Date = new Date()
): {
  today: CalendarItem[];
  this_week: CalendarItem[];
  upcoming: CalendarItem[];
  no_date_data: CalendarItem[];
  counts: BucketCounts;
} {
  const out: ReturnType<typeof groupCardsByBucket> = {
    today: [],
    this_week: [],
    upcoming: [],
    no_date_data: [],
    counts: { today: 0, this_week: 0, upcoming: 0, no_date_data: 0 },
  };
  for (const c of cards) {
    const item = bucketForCard(c, now);
    if (item.reason === "no_date_data") {
      out.no_date_data.push(item);
      out.counts.no_date_data += 1;
      continue;
    }
    // Future branch: switch on item.bucket.
    if (item.bucket === "today") {
      out.today.push(item);
      out.counts.today += 1;
    } else if (item.bucket === "this_week") {
      out.this_week.push(item);
      out.counts.this_week += 1;
    } else if (item.bucket === "upcoming") {
      out.upcoming.push(item);
      out.counts.upcoming += 1;
    }
  }
  return out;
}

/** Determines whether the empty state should render. True when nothing
 *  has materialized in any bucket. */
export function isCalendarEmpty(counts: BucketCounts): boolean {
  return (
    counts.today === 0 &&
    counts.this_week === 0 &&
    counts.upcoming === 0 &&
    counts.no_date_data === 0
  );
}
