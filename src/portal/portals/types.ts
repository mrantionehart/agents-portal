// ============================================================================
// AGENT PORTAL 2.1 — R2A — Deal Portal types
// ============================================================================
// Mirrors the live shape returned by Vault GET /api/deal-portals/advisor
// (verified live on 2026-06-25 — 17 fields per row). Optional fields stay
// optional so a future Vault response that drops one doesn't break the
// type or the UI.
// ============================================================================

export interface DealPortalRow {
  id: string;
  title: string | null;
  status: string | null; // 'active' | 'archived' | (others left open)
  access_token: string;
  client_name: string | null;
  client_email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string | null;
  // Below: nice-to-haves rendered when present, never required.
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  property_type: string | null;
  media: unknown;
}

export type StatusFilter = "all" | "active" | "archived";

export type ListResult =
  | { kind: "ok"; items: DealPortalRow[] }
  | { kind: "error"; status: number; message: string };
