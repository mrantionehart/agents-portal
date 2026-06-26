// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.A — Form detail drawer types
// ============================================================================
// Sanitized shapes for Vault's per-form-detail endpoints.
// All shapes match the live Vault response — no inferred fields.
//
// Endpoints consumed (read-only):
//   • GET /api/paperwork/transactions/[id]/missing-fields  (agent + broker)
//   • GET /api/paperwork/transactions/[id]/history         (BROKER ONLY)
//   • GET /api/paperwork/form-instances/[id]/envelope      (BROKER ONLY)
//
// Role-gating is enforced at the Vault route layer (gateCaller +
// requireBrokerTier:true). Agent Portal mirrors the gate at the page
// layer so we never make a guaranteed-403 request.
// ============================================================================

/** One missing-field item from /missing-fields. Vault de-duplicates by
 *  transaction_path and aggregates `blocks_forms` across every form
 *  whose required_fields touch that path. */
export interface MissingFieldsItem {
  transaction_path: string;
  severity: string;
  completer_role: string;
  blocks_forms: string[];
  label?: string | null;
  prompt?: string | null;
  portal_route?: string | null;
}

export interface MissingFieldsReport {
  items: MissingFieldsItem[];
  statutory_count: number;
  by_severity: Record<string, number>;
  by_completer_role: Record<string, number>;
  satisfied_statutory_paths: string[];
  computed_at: string;
}

/** One timeline event from /history. Either an audit_log entry or a
 *  broker_review_history entry; the `kind` discriminates. Used only
 *  for broker callers. */
export interface TimelineEvent {
  kind: "audit" | "review";
  id: string;
  created_at: string;
  actor_id: string;
  // audit-shape
  field_path?: string;
  old_value?: string | null;
  new_value?: string | null;
  source?: string;
  form_instance_id?: string | null;
  // review-shape
  action?: string;
  notes?: string | null;
  status_before?: string | null;
  status_after?: string | null;
}

export interface HistoryResponse {
  events: TimelineEvent[];
  limit: number;
  pagination_deferred: boolean;
}

/** Envelope row + signed-PDF URL bundle from /form-instances/[id]/envelope.
 *  Used only for broker callers. */
export interface EnvelopeRow {
  id: string;
  envelope_id: string | null;
  status:
    | "created"
    | "sent"
    | "delivered"
    | "viewed"
    | "completed"
    | "declined"
    | "voided"
    | string;
  recipient_snapshot?: Array<{
    role?: string | null;
    name?: string | null;
    email?: string | null;
  }> | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  completed_at?: string | null;
  declined_at?: string | null;
  voided_at?: string | null;
  signed_pdf_path?: string | null;
  decline_reason?: string | null;
  void_reason?: string | null;
}

export interface EnvelopeBundle {
  envelope: EnvelopeRow | null;
  signed_url: string | null;
  history: Array<{
    id: string;
    envelope_id: string | null;
    status: string;
    created_at: string;
    sent_at: string | null;
    completed_at: string | null;
    declined_at: string | null;
    voided_at: string | null;
  }>;
}

/** Aggregate result the drawer renders. Built per-form. */
export interface FormDetailBundle {
  /** Filter applied: only items whose `blocks_forms` includes this form_id. */
  missing: MissingFieldsItem[];
  /** Statutory_count aggregate from the full report (not filtered). */
  statutory_count_total: number;
  /** Per-form statutory specs derived from the requirement row. */
  statutory_fields: StatutoryFieldSummary[];
  /** Broker-only. null when caller is agent OR fetch failed OR no instance. */
  envelope: EnvelopeBundle | null;
  /** Broker-only. Filtered to this form_instance_id when an instance exists. */
  history: TimelineEvent[] | null;
  /** Whether the broker-only sections are gated due to role (not error). */
  broker_only_gated: boolean;
  /** Per-section error strings — surface in the UI without breaking
   *  other sections. */
  errors: {
    missing: string | null;
    envelope: string | null;
    history: string | null;
  };
}

/** Pure-render shape of one statutory required_field spec. */
export interface StatutoryFieldSummary {
  transaction_path: string;
  severity: string;
  completer_role: string;
  /** Whether the field has been attested by the party portal flow. */
  satisfied: boolean;
}
