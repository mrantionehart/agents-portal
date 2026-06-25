// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Client list/detail helpers
// ============================================================================
// Pure derivations: filter composition, search, label translations,
// budget range formatting (mirrors AP2.1D), sanitization. No DB / DOM.
// ============================================================================

import type { ClientListItem } from "./types";

export type TempFilter = "all" | "hot" | "warm" | "cold";
export type TypeFilter = "all" | "buyers" | "sellers" | "investors";

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

/** Filter + search composition. AND across all axes. Search is
 *  case-insensitive over name / email / phone / target_areas. */
export function applyClientFilters(
  rows: ClientListItem[],
  filters: { temperature: TempFilter; type: TypeFilter; search: string }
): ClientListItem[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((c) => {
    if (filters.temperature !== "all") {
      if ((c.temperature ?? "").toLowerCase() !== filters.temperature) return false;
    }
    if (filters.type !== "all") {
      if (typeBucket(c.profile_type) !== filters.type) return false;
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
}

export function clientListCounts(rows: ClientListItem[]): ClientListCounts {
  let hot = 0,
    warm = 0,
    cold = 0,
    buyers = 0,
    sellers = 0,
    investors = 0;
  for (const c of rows) {
    if (c.temperature === "hot") hot += 1;
    else if (c.temperature === "warm") warm += 1;
    else if (c.temperature === "cold") cold += 1;
    const tb = typeBucket(c.profile_type);
    if (tb === "buyers") buyers += 1;
    else if (tb === "sellers") sellers += 1;
    else if (tb === "investors") investors += 1;
  }
  return { total: rows.length, hot, warm, cold, buyers, sellers, investors };
}
