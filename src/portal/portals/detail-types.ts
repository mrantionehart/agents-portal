// ============================================================================
// AGENT PORTAL 2.1 — R2B — Detail-page types
// ============================================================================
// Mirrors the live shapes returned by:
//   GET /api/deal-portals/advisor/[id]                — Vault (Bearer)
//   GET /api/broker/deal-portals/[id]/feedback         — agents-portal proxy
// Optional fields stay optional so a future field addition or removal
// doesn't break the type or the UI.
// ============================================================================

import type { DealPortalRow } from "./types";

/** A single recorded view row. Vault returns these in `portal.views`. */
export interface PortalViewRow {
  id: string;
  viewed_at: string;
  viewer_ip?: string | null;
  viewer_user_agent?: string | null;
}

/** Per-property feedback aggregation as Vault emits it. */
export interface PortalFeedbackProperty {
  title: string;
  favorites: number;
  comments: Array<{
    name: string;
    email: string;
    comment: string;
    date: string;
  }>;
  respondents: string[];
}

export interface PortalFeedbackPayload {
  portal_id: string;
  portal_title: string | null;
  total_responses: number;
  respondents: string[];
  properties: PortalFeedbackProperty[];
  /** Raw rows — handy for verification but never the primary UI. */
  raw?: unknown;
}

/** Result envelope for the per-portal advisor detail fetch. */
export type DetailResult =
  | { kind: "ok"; portal: DealPortalRow & {
      share_url?: string;
      views?: PortalViewRow[];
      total_views?: number;
      last_viewed?: string | null;
    } }
  | { kind: "not_found" }
  | { kind: "error"; status: number; message: string };

/** Result envelope for the feedback fetch. */
export type FeedbackResult =
  | { kind: "ok"; payload: PortalFeedbackPayload }
  | { kind: "not_found" }
  | { kind: "error"; status: number; message: string };
