// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Client list / detail types
// ============================================================================
// Sanitized read-only mirrors of the `client_profiles` shape that the
// existing /api/broker/client-intelligence/[id]/agent-view route emits.
// Broker-only fields (broker_notes, red_flags, profitability, commission
// data, decision_notes) are intentionally absent — same sanitization
// model as AP2.1D.
// ============================================================================

/** Caller-relative assignment bucket. Encodes ONLY the relationship to
 *  the caller — never another agent's user_id. Brokers may see rows
 *  where the bucket is null (visible by role, not by assignment). */
export type AssignmentBucket = "assigned" | "claimed" | "dispo" | null;

export interface ClientListItem {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  profile_type: string | null;          // buyer | seller | investor (+ tail values)
  temperature: string | null;            // hot | warm | cold
  representation_status: string | null;
  preferred_channel: string | null;
  target_areas: string[];
  updated_at: string | null;
  /** R3A — caller-relative assignment marker; null for broker-only rows. */
  assignmentBucket: AssignmentBucket;
}

export interface ClientDetail extends ClientListItem {
  preferred_contact_time: string | null;
  motivation: string | null;
  timeline: string | null;
  budget_range: string | null;
  must_haves: string[];
  readiness_score: number | null;
}

export type ListResult =
  | { kind: "ok"; items: ClientListItem[] }
  | { kind: "error"; status: number; message: string };

// "not_found" and access-denied are deliberately conflated to avoid
// leaking existence of inaccessible rows (no separate access_denied kind).
export type DetailResult =
  | { kind: "ok"; client: ClientDetail }
  | { kind: "not_found" }
  | { kind: "error"; message: string };
