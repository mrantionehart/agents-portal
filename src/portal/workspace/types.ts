// ============================================================================
// AGENT PORTAL 2.0 — Workspace types (mirror of Vault P1A response)
// ============================================================================
// Read-only mirror of the shape Vault's GET /api/platform/workspace
// emits. We mirror — never extend — so a Vault response change is a
// single-line update here, not a Portal logic change.
// ============================================================================

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
