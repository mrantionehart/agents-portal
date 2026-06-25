// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Client list/detail helpers
// ============================================================================
// Pure derivations: filter composition, search, label translations,
// budget range formatting (mirrors AP2.1D), sanitization. No DB / DOM.
// ============================================================================

import type { AssignmentBucket, ClientListItem } from "./types";

export type TempFilter = "all" | "hot" | "warm" | "cold";
export type TypeFilter = "all" | "buyers" | "sellers" | "investors";

/** R3A — assignment filter. AND-composed with temperature + type. */
export type AssignmentFilter = "all" | "assigned" | "claimed" | "dispo";

/** R3A — derive the caller's relationship to a row. Pure function over
 *  (assigned_agent_id / claimed_by / visibility / status) + caller id;
 *  does NOT depend on role. Returns null when there's no caller-relative
 *  bucket (broker visibility only). Encodes ONLY the caller-relative
 *  category — never another agent's user_id. */
export function deriveBucket(
  p: {
    assigned_agent_id: string | null;
    claimed_by: string | null;
    visibility: string | null;
    status: string | null;
  },
  callerId: string
): AssignmentBucket {
  if (p.assigned_agent_id === callerId) return "assigned";
  if (p.claimed_by === callerId) return "claimed";
  if (p.visibility === "dispo_feed" && p.status === "dispo") return "dispo";
  return null;
}

/** Map a profile_type value to one of the documented filter buckets.
 *  Soft mapping — unknown types fall through to "all" (won't match the
 *  buyers/sellers/investors chips). */
export function typeBucket(profile_type: string | null): TypeFilter {
  if (!profile_type) return "all";
  const t = profile_type.toLowerCase();
  if (t === "buyer") return "buyers";
  if (t === "seller") return "sellers";
  if (t === "investor") return "investors";
  return "all";
}

/** Filter + search composition. AND across all axes (temperature,
 *  type, assignment, search). Search is case-insensitive over
 *  name / email / phone / target_areas. */
export function applyClientFilters(
  rows: ClientListItem[],
  filters: {
    temperature: TempFilter;
    type: TypeFilter;
    /** R3A — optional; defaults to "all" so older callers keep working. */
    assignment?: AssignmentFilter;
    search: string;
  }
): ClientListItem[] {
  const assignment: AssignmentFilter = filters.assignment ?? "all";
  const q = filters.search.trim().toLowerCase();
  return rows.filter((c) => {
    if (filters.temperature !== "all") {
      if ((c.temperature ?? "").toLowerCase() !== filters.temperature) return false;
    }
    if (filters.type !== "all") {
      if (typeBucket(c.profile_type) !== filters.type) return false;
    }
    if (assignment !== "all") {
      if (c.assignmentBucket !== assignment) return false;
    }
    if (q) {
      const hay = [
        c.full_name ?? "",
        c.email ?? "",
        c.phone ?? "",
        ...(c.target_areas ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ── Display labels ──────────────────────────────────────────────────

export function profileTypeLabel(t: string | null): string {
  if (!t) return "—";
  const v = t.toLowerCase();
  if (v === "buyer") return "Buyer";
  if (v === "seller") return "Seller";
  if (v === "investor") return "Investor";
  return t;
}

export function temperatureLabel(t: string | null): string {
  if (t === "hot") return "Hot";
  if (t === "warm") return "Warm";
  if (t === "cold") return "Cold";
  return "—";
}

export function channelLabel(c: string | null): string {
  if (!c) return "—";
  if (c === "phone") return "Phone";
  if (c === "email") return "Email";
  if (c === "text") return "Text";
  if (c === "sms") return "Text (SMS)";
  if (c === "in_person") return "In person";
  return c;
}

export function representationLabel(r: string | null): string {
  if (!r || r === "Unknown") return "—";
  return r;
}

/** Date relative to now → short label. */
export function relativeUpdated(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Budget range formatter — same shape as AP2.1D's formatBudgetRange. */
export function formatBudgetRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

// ── Counts (chip badges) ────────────────────────────────────────────

export interface ClientListCounts {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  buyers: number;
  sellers: number;
  investors: number;
  /** R3A — assignment bucket counts (caller-relative). */
  assigned: number;
  claimed: number;
  dispo: number;
}

export function clientListCounts(rows: ClientListItem[]): ClientListCounts {
  let hot = 0,
    warm = 0,
    cold = 0,
    buyers = 0,
    sellers = 0,
    investors = 0,
    assigned = 0,
    claimed = 0,
    dispo = 0;
  for (const c of rows) {
    if (c.temperature === "hot") hot += 1;
    else if (c.temperature === "warm") warm += 1;
    else if (c.temperature === "cold") cold += 1;
    const tb = typeBucket(c.profile_type);
    if (tb === "buyers") buyers += 1;
    else if (tb === "sellers") sellers += 1;
    else if (tb === "investors") investors += 1;
    if (c.assignmentBucket === "assigned") assigned += 1;
    else if (c.assignmentBucket === "claimed") claimed += 1;
    else if (c.assignmentBucket === "dispo") dispo += 1;
  }
  return {
    total: rows.length,
    hot,
    warm,
    cold,
    buyers,
    sellers,
    investors,
    assigned,
    claimed,
    dispo,
  };
}

/** Display label for a per-row bucket badge. Returns null when the row
 *  is broker-visible-only — no badge in that case. */
export function bucketBadgeLabel(b: ClientListItem["assignmentBucket"]): string | null {
  if (b === "assigned") return "Assigned";
  if (b === "claimed") return "Claimed";
  if (b === "dispo") return "Dispo Feed";
  return null;
}
