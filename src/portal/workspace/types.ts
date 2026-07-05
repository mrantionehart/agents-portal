// ============================================================================
// AGENT PORTAL 2.0 — Workspace types (mirror of Vault P1A response)
// ============================================================================
// Read-only mirror of the shape Vault's GET /api/platform/workspace
// emits. We mirror — never extend — so a Vault response change is a
// single-line update here, not a Portal logic change.
// ============================================================================

/** Coach recommendation projection, sourced verbatim from Vault's workspace
 *  endpoint. Kinds are a bare `string` (not pinned) so Vault can extend without
 *  a Portal patch. AGENT.SIGN.1E.2 added the richer card fields (title /
 *  severity / recommended_action / estimated_time) — optional so pre-1E.2
 *  payloads still type-check. */
export interface CoachRecommendation {
  kind: string;
  label: string;
  blocker: boolean;
  reason: string;
  suggested_prompt: string;
  drill_url: string;
  // AGENT.SIGN.1E.2 — richer card fields (kind-derived, safe).
  title?: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
  recommended_action?: string;
  estimated_time?: string;
}

// ── TXN-OS.3.1D — lifecycle indicator (mirrors Vault's CardLifecycle) ──────
export type LifecycleTone = "ok" | "info" | "warn" | "muted";

/** Read-only lifecycle block stamped onto each card by Vault's
 *  /api/platform/workspace (TXN-OS.3.1C). Derived server-side by the pure
 *  stageState() projector — the UI never recalculates it. Null when the
 *  projection failed (fail-open). */
export interface CardLifecycle {
  current_stage: string;
  current_stage_label: string;
  next_stage: string | null;
  next_stage_label: string | null;
  stage_readiness: {
    tier: "not_started" | "in_progress" | "blocked" | "ready_to_advance" | "complete";
    satisfied_count: number;
    total_count: number;
    percent: number;
    can_advance: boolean;
  };
  blockers: Array<{ class: string; key: string; label: string; severity: string; reason: string }>;
  warnings: string[];
  next_action: { class: string; key: string; label: string; priority: string };
  priority: "critical" | "high" | "medium" | "low";
}

export interface WorkspaceCard {
  transaction_id: string;
  transaction_type: string | null;
  property_address: string | null;
  client_name: string | null;
  readiness_score: number;
  readiness_tier:
    | "collecting"
    | "drafting"
    | "almost_ready"
    | "ready_for_review"
    | "ready_for_signature";
  stage: string;
  next_action: string;
  suggested_prompt: string;
  required_forms_count: number;
  ready_forms_count: number;
  signed_forms_count: number;
  blocked_forms_count: number;
  pending_envelopes_count: number;
  portal_status: "none" | "invite_sent" | "submitted";
  risk_tier: "unknown" | "low" | "medium" | "high" | "critical";
  broker_confirmation_required: true;
  /** W3.4.6.4 — added by Vault W3.4.6.3 workspace endpoint enrichment.
   *  Null when the Coach has nothing actionable (kind=nothing_urgent)
   *  or when the composer errored. */
  coach_recommendation?: CoachRecommendation | null;
  /** TXN-OS.3.1D — canonical deal lifecycle (Transaction Stage), from Vault's
   *  workspace projection. Null/absent when unavailable → indicator hides. */
  lifecycle?: CardLifecycle | null;
}

export type StatusFilter =
  | "all"
  | "ready_for_review"
  | "ready_for_signature"
  | "needs_more_info";

export type TypeFilter =
  | "all"
  | "lease"
  | "purchase"
  | "listing"
  | "buyer_rep"
  | "buyer"
  | "seller";
