// ============================================================================
// AGENT PORTAL 2.1 — R2A — Deal Portal pure helpers
// ============================================================================
// Filter composition, search, format helpers, share-URL builder.
// All inputs are plain JSON; no DOM, no fetch, no Supabase.
// ============================================================================

import type { DealPortalRow, StatusFilter } from "./types";

/** Compose all filter axes. AND across status × search. */
export function applyFilters(
  rows: DealPortalRow[],
  filters: { status: StatusFilter; search: string }
): DealPortalRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.status !== "all") {
      if ((r.status ?? "").toLowerCase() !== filters.status) return false;
    }
    if (q) {
      const hay = [
        r.title ?? "",
        r.client_name ?? "",
        r.client_email ?? "",
        r.address ?? "",
        r.city ?? "",
        r.state ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface ListCounts {
  total: number;
  active: number;
  archived: number;
  totalViews: number;
}

export function listCounts(rows: DealPortalRow[]): ListCounts {
  let active = 0;
  let archived = 0;
  let totalViews = 0;
  for (const r of rows) {
    if ((r.status ?? "").toLowerCase() === "active") active += 1;
    else if ((r.status ?? "").toLowerCase() === "archived") archived += 1;
    totalViews += r.view_count || 0;
  }
  return { total: rows.length, active, archived, totalViews };
}

/** Build the share URL for a portal. Canonical agents-portal route:
 *   https://agents.hartfeltrealestate.com/portal/<token>
 *
 *  Matches legacy /deal-portals/page.tsx:79-81 so existing share links
 *  remain interoperable. A future canonical-URL migration would update
 *  this single function. */
export function shareUrl(portal: { access_token: string }): string {
  return `https://agents.hartfeltrealestate.com/portal/${portal.access_token}`;
}

// ── Display formatters ───────────────────────────────────────────────

export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPrice(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

export function statusLabel(s: string | null): string {
  if (!s) return "Unknown";
  const v = s.toLowerCase();
  if (v === "active") return "Active";
  if (v === "archived") return "Archived";
  if (v === "draft") return "Draft";
  return s;
}

/** Compose the location string from city/state, gracefully falling
 *  back to just one or the other if either is missing. */
export function locationLabel(row: DealPortalRow): string | null {
  const parts = [row.city, row.state].filter((x): x is string => Boolean(x));
  if (parts.length === 0) return null;
  return parts.join(", ");
}
