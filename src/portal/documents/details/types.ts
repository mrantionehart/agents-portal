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
    /** Workflow 3.2.B.1 — snapshot fetch error (for editor). */
    snapshot: string | null;
  };
  /** Workflow 3.2.B.1 — Agent-editable fields derived from the
   *  requirement row's required_fields. Empty array when no edits
   *  are agent-allowed for this form. */
  editable_fields: EditableField[];
  /** Workflow 3.2.B.1 — Current values snapshot for the editor.
   *  null when caller couldn't load the transaction (e.g. degraded
   *  network); editor renders with "—" placeholders. */
  snapshot: TransactionSnapshot | null;
}

/** One agent-editable field surfaced in the drawer's editor section. */
export interface EditableField {
  /** Full transaction path (e.g. "facts.condo" or "terms.lease.rent.monthly_amount"). */
  transaction_path: string;
  /** Which PATCH endpoint this writes to. */
  endpoint: "facts" | "terms" | "party";
  /** Set when endpoint === 'facts'; the fact key without the "facts." prefix. */
  key?: string;
  /** Set when endpoint === 'terms'; the path WITHOUT the "terms." prefix
   *  (matches Vault TERMS_PATH_ALLOWLIST regex). */
  termPath?: string;
  /** Set when endpoint === 'party'; the party role selected from the
   *  transaction_path (e.g. "buyer" from "parties[role=buyer].phone"). */
  partyRole?: string;
  /** Set when endpoint === 'party'; the contact column to write. */
  partyField?: "name" | "email" | "phone" | "mailing_address";
  /** Display label. */
  label: string;
  /** InlineEditableField input variant. */
  inputType: "text" | "number" | "boolean" | "date" | "select";
  /** Set when inputType === 'select'; the fixed value/label options. The
   *  stored `value` is the canonical token the rule engine expects. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Echoed from the rule-engine spec for tone/badging. */
  severity: string;
  /** Echoed from the rule-engine spec for tone/badging. */
  completer_role: string;
}

/** Minimal projection of the Vault GET /paperwork/transactions/[id]
 *  response carrying the fields the editor needs to surface current
 *  values + drive UPL L4 lock. */
export interface TransactionSnapshot {
  /** transactions.facts JSONB — each key wraps {value, state, ...} */
  facts: Record<string, unknown> | null;
  /** transactions.terms JSONB — nested object */
  terms: Record<string, unknown> | null;
  /** transaction_parties rows — seeds current values for editable party
   *  contact fields (e.g. parties[role=buyer].phone). */
  parties?: Array<{
    role?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    mailing_address?: string | null;
  }> | null;
  /** broker_review_status — drives UPL L4 lock on the editor. */
  broker_review_status: "draft" | "submitted" | "approved" | "revisions_required" | string | null;
}

/** Pure-render shape of one statutory required_field spec. */
export interface StatutoryFieldSummary {
  transaction_path: string;
  severity: string;
  completer_role: string;
  /** Whether the field has been attested by the party portal flow. */
  satisfied: boolean;
}
