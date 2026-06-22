// ============================================================================
// PAPERWORK.3B — Local mirror of Vault paperwork types
// ============================================================================
// MIRROR OF vault/src/lib/paperwork/types.ts. Update in lock-step when that
// file changes. PAPERWORK.5 or earlier should evaluate moving these into a
// shared @hartfelt/paperwork-types package.

export const STATUTORY_FACT_KEYS = [
  "flood_history",
  "prior_insurance_claim",
  "prior_fema_assistance",
  "lead_paint_knowledge",
  "lead_paint_records",
] as const;

export type StatutoryFactKey = (typeof STATUTORY_FACT_KEYS)[number];

export type TransactionFactState =
  | "heard"
  | "entered"
  | "reviewed"
  | "attested"
  | "rejected"
  | "superseded";

export type TransactionFactSource =
  | "ai_heard"
  | "agent_typed"
  | "broker_typed"
  | "landlord_portal"
  | "tenant_portal"
  | "buyer_portal"
  | "seller_portal";

export interface TransactionFact {
  key: string;
  value: unknown;
  state: TransactionFactState;
  source: TransactionFactSource;
  source_id?: string | null;
  note?: string | null;
  prior_value?: unknown;
  updated_at?: string;
  updated_by?: string | null;
}

export type TransactionFacts = Record<string, TransactionFact>;
export type TransactionFactsHearsay = Record<string, TransactionFact>;
export type TransactionTerms = Record<string, unknown>;

export interface TransactionIntelligence {
  confidence: number;
  statutory_pending_count: number;
  missing_critical_count: number;
  legal_review_flag: boolean;
  required_form_count: number;
  missing_field_summary?: {
    total: number;
    by_severity: { high: number; medium: number; low: number; info: number };
  };
  computed_at: string;
  source_session_id?: string | null;
}

export type BrokerReviewStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "revisions_required";

export interface TransactionRow {
  id: string;
  agent_id: string | null;
  type: "buyer" | "seller" | "lease" | string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  contract_price: number | null;
  earnest_money: number | null;
  closing_date: string | null;
  contract_date: string | null;
  year_built: number | null;
  lease_term_months: number | null;
  has_hoa: boolean | null;
  financing_type: string | null;
  status: string | null;
  broker_review_status: BrokerReviewStatus | null;
  submitted_for_review_at: string | null;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  revision_notes: string | null;
  notes: string | null;
  facts: TransactionFacts;
  facts_hearsay: TransactionFactsHearsay;
  terms: TransactionTerms;
  transaction_intelligence: TransactionIntelligence | Record<string, never>;
  deal_intake_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionPartyRole =
  | "landlord"
  | "tenant"
  | "buyer"
  | "seller"
  | "broker"
  | "other";

export interface TransactionPartyRow {
  id: string;
  tenant_id: string;
  transaction_id: string;
  role: TransactionPartyRole;
  name: string | null;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  signature_required: boolean;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FormInstanceStatus =
  | "recommended"
  | "required"
  | "blocked"
  | "in_progress"
  | "ready"
  | "sent"
  | "signed"
  | "voided";

export type FormCategory =
  | "primary_lease"
  | "lease_addendum"
  | "compensation_agreement"
  | "statutory_disclosure"
  | "primary_purchase"
  | "purchase_addendum"
  | "listing_agreement"
  | "other";

export type CompleterRole =
  | "agent"
  | "broker"
  | "landlord"
  | "tenant"
  | "buyer"
  | "seller";

export type FieldSeverity = "high" | "medium" | "low" | "info" | "statutory";

export interface FormFieldSpec {
  form_field_id: string;
  transaction_path: string;
  severity: FieldSeverity;
  completer_role: CompleterRole;
  label?: string;
}

export interface FormRequirement {
  form_id: string;
  form_revision: string;
  form_category: FormCategory;
  reason: string;
  required_fields: FormFieldSpec[];
}

export interface FormInstanceRow {
  id: string;
  tenant_id: string;
  intake_session_id: string | null;
  transaction_id: string;
  form_id: string;
  form_revision: string;
  form_category: FormCategory;
  required_party_role: string;
  answers: Record<string, unknown>;
  status: FormInstanceStatus;
  field_map: Record<string, unknown>;
  required_reason: string | null;
  derived_from_transaction: boolean;
  template_id: string | null;
  template_revision: string | null;
  template_checksum: string | null;
  external_envelope_id?: string | null;
  signed_party_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface MissingFieldsItem {
  transaction_path: string;
  label: string;
  severity: FieldSeverity;
  completer_role: CompleterRole;
  blocks_forms: string[];
  reason?: string;
}

export interface MissingFieldsReport {
  items: MissingFieldsItem[];
  statutory_count: number;
  by_severity: { high: number; medium: number; low: number; info: number };
  computed_at: string;
}

// Convenience helper used by client UI.
export function isStatutoryFact(key: string): boolean {
  return (STATUTORY_FACT_KEYS as readonly string[]).includes(key);
}

// PAPERWORK.3B placeholder cards — lease package forms confirmed in
// production documents but NOT yet in Vault's rule engine. Surfaced as
// informational cards beneath the rule-engine-driven cards so brokers and
// agents have context on what will be added in a later phase.
export interface LeasePackagePlaceholder {
  form_id: string;
  form_category: FormCategory;
  reason: string;
}

export const LEASE_PACKAGE_PLACEHOLDERS: LeasePackagePlaceholder[] = [
  {
    form_id: "CL-11",
    form_category: "primary_lease",
    reason:
      "Florida Realtors Contract to Lease (CL-11) — used to bind lease terms before the lease itself is signed.",
  },
  {
    form_id: "ACSP-4",
    form_category: "lease_addendum",
    reason:
      "Florida Realtors Lease Addendum (ACSP-4) — covers HOA, association rules, and supplemental provisions.",
  },
  {
    form_id: "CAOT-2",
    form_category: "compensation_agreement",
    reason:
      "Compensation Agreement (CAOT-2) — agent-to-broker compensation terms for the lease transaction.",
  },
];
