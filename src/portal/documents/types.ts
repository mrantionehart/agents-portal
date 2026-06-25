// ============================================================================
// AGENT PORTAL 2.1 — R4 — Transaction Documents types
// ============================================================================
// Sanitized read-only mirrors of Vault's GET
//   /api/paperwork/transactions/[id]/forms
// response. The Vault response carries two arrays — `requirements`
// (rule-engine output: what SHOULD exist) + `instances` (materialized
// form_instances rows: what DOES exist) — which we merge into one
// DocumentRow per form_id. The rule-engine list is authoritative for
// the document inventory; if a row exists for a given form_id, its
// status / signed_at / updated_at / envelope_id surface on the same
// DocumentRow.
// ============================================================================

import type { FormInstanceStatus } from "./shared-types";

/** What the Vault rule engine emits per required form. Captures only
 *  the fields the Documents panel renders. */
export interface RequirementRow {
  form_id: string;
  form_revision?: string | null;
  form_category?: string | null;
  required?: boolean;
  reason?: string | null;
  /** Length used as the "expected fields" number for the missing-fields
   *  derivation: missing = (required_fields.length - filled-in count).
   *  When the row isn't materialized yet, this is the upper bound on
   *  the missing count. */
  required_fields?: Array<{
    form_field_id?: string;
    transaction_path?: string;
    label?: string;
    severity?: string;
    completer_role?: string;
    required?: boolean;
  }>;
}

/** What a `form_instances` row looks like once the broker has accepted
 *  the form into the work queue. Captures only the fields the
 *  Documents panel renders. */
export interface FormInstanceRow {
  id: string;
  form_id: string;
  form_revision?: string | null;
  form_category?: string | null;
  status: FormInstanceStatus | string;
  envelope_id?: string | null;
  completed_at?: string | null;
  signed_party_ids?: unknown;
  required_party_role?: string | null;
  required_reason?: string | null;
  storage_path?: string | null;
  template_id?: string | null;
  transaction_id: string;
  updated_at: string;
  created_at: string;
}

/** Combined per-document row the UI renders. */
export interface DocumentRow {
  /** Form code — e.g. "RLHD-3x". Stable identifier. */
  form_id: string;
  /** Human-readable revision label — e.g. "Rev 10/25". */
  form_revision: string | null;
  /** Category (lease | purchase | listing | buyer_rep | addendum |
   *  disclosure) when available. */
  form_category: string | null;
  /** Rule-engine reason / FL statute cite for why this form is
   *  required, when available. */
  reason: string | null;
  /** Lifecycle status. When no instance exists yet, this is
   *  "not_started" — a synthetic UI-only bucket. */
  status: FormInstanceStatus | "not_started";
  /** Best-effort upper-bound count of missing required fields. Falls
   *  back to the rule-engine spec length when an instance isn't
   *  materialized yet. Null when we genuinely don't know. */
  missing_fields_count: number | null;
  /** Whether this form has an envelope identifier on its instance row.
   *  We don't expose the raw envelope_id (broker-only); the UI just
   *  shows a derived "Envelope: sent" / "Envelope: signed" pill. */
  has_envelope: boolean;
  /** Signed timestamp if available (form_instances.completed_at when
   *  status === 'signed'). */
  signed_at: string | null;
  /** Most-recent updated_at across the merged record. */
  updated_at: string | null;
  /** Whether the broker has accepted this form (instance row exists). */
  has_instance: boolean;
  /** Vault deep-link for this form's detail (paperwork package page). */
  open_in_vault_url: string;
}

/** Groupings used in the Documents header strip. */
export interface DocumentCounts {
  total: number;
  ready: number;
  blocked: number;
  signed: number;
  in_progress: number;
  /** "Not started" = no form_instance row materialized yet. The
   *  workspace card's `required_forms_count` lumps these in, but the
   *  list view splits them out so agents can see what hasn't begun. */
  not_started: number;
  /** Forms that need attention: blocked OR (recommended/required +
   *  missing fields > 0). Used for the "What needs attention?" pill. */
  needs_attention: number;
}

/** Server-fetch result envelope. */
export type DocumentsResult =
  | { kind: "ok"; documents: DocumentRow[] }
  | { kind: "not_found" }
  | { kind: "error"; status: number; message: string };
