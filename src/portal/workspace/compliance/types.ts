// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.2 — Compliance tab types
// ============================================================================
// All shapes are agent-safe. Broker-only fields (commission amounts,
// splits, broker notes, Stripe IDs, raw Vault per-check blockers) are
// intentionally absent — boundary lint asserts.
// ============================================================================

export type GateStatus = "ok" | "warning" | "blocked" | "not_tracked";
export type PillTone = "ok" | "info" | "warn" | "muted";

/** Safe projection of Vault's /api/transactions/[id]/payout-readiness
 *  response. The Vault response carries broker-context strings on
 *  `checks[].blockers/warnings/detail` and aggregated `blockers/warnings`.
 *  This shape DROPS them and reduces each check to its safe status only.
 *  Only the 7 agent-safe check IDs survive the mask.
 *
 *  The composer constructs labels from Agent Portal's own copy — never
 *  the raw Vault label/detail strings. */
export interface SafePayoutReadinessSummary {
  /** Aggregate readiness from Vault. */
  overallStatus: "ready" | "partial" | "blocked";
  /** 0-100. */
  score: number;
  /** Per-gate status, keyed by the 7-allowlisted check IDs. */
  gates: {
    transaction_status_valid: GateStatus;
    closing_date_present: GateStatus;
    agent_profile_complete: GateStatus;
    agent_payout_method: GateStatus;
    tax_info_w9: GateStatus;
    compliance_checklist_complete: GateStatus;
    documents_uploaded: GateStatus;
  };
}

export interface BlockerItem {
  /** Stable key for testing / aria. */
  key: string;
  /** Short user-facing line. */
  label: string;
  /** Severity badge. Statutory > high > medium > low > info. */
  severity: string;
  /** Where to drill — e.g. "Open in Documents" or "Send party portal link". */
  cta?: {
    label: string;
    href: string;
  };
}

export interface WarningItem {
  key: string;
  label: string;
}

export interface RequiredFormSummary {
  form_id: string;
  form_revision: string | null;
  form_category: string | null;
  status:
    | "not_started"
    | "recommended"
    | "required"
    | "blocked"
    | "in_progress"
    | "ready"
    | "sent"
    | "signed"
    | "voided";
  reason: string | null;
  /** Drawer href so the agent can drill in. */
  drawerHref: string;
  /** Vault deep-link. */
  vaultHref: string;
}

export interface StatutoryItemSummary {
  transaction_path: string;
  label: string;
  satisfied: boolean;
  /** Display copy when not satisfied. */
  awaitingHint: string;
}

export interface BrokerReviewSummary {
  /** Raw Vault value, lowercased. Drives the pill tone. */
  status: "draft" | "submitted" | "approved" | "revisions_required" | string | "";
  pill: { tone: PillTone; label: string };
}

export interface EnvelopeSummaryRow {
  pending: number;
  signed: number;
  ready_awaiting_send: number;
}

export interface GateSummary {
  key: string;
  label: string;
  status: GateStatus;
  /** Concise current-state explanation. */
  detail: string;
}

export interface ComplianceReadinessHeader {
  score: number;
  tier:
    | "collecting"
    | "drafting"
    | "almost_ready"
    | "ready_for_review"
    | "ready_for_signature";
  stage: string;
  nextAction: string;
  suggestedPrompt: string;
}

/** Composed state — Compliance tab renders this directly. */
export interface ComplianceTabState {
  readiness: ComplianceReadinessHeader;
  blockers: BlockerItem[];
  warnings: WarningItem[];
  requiredForms: RequiredFormSummary[];
  statutory: StatutoryItemSummary[];
  brokerReview: BrokerReviewSummary;
  envelope: EnvelopeSummaryRow;
  gates: GateSummary[];
  /** Deep-link to Vault's paperwork package. */
  paperworkPackageUrl: string;
  /** Whether the payout-readiness fetch failed (banner-degraded). */
  payoutReadinessDegraded: boolean;
}
