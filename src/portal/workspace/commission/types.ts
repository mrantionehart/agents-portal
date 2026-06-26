// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.4.3.1 — Commission Workspace types
// ============================================================================
// Read-only, agent-safe types. No amounts, splits, Stripe IDs, broker notes,
// cap math, or payout IDs anywhere — by construction at the type level.
//
// Vault owns the commission engine. The Agent Portal only presents the
// gate verdict (W3.4.3.0) + a safe projection of the commission row.
// ============================================================================

export type CommissionTone = "ok" | "warn" | "muted" | "info";

/** Safe-projected commission row. NEVER includes amount / split / cap /
 *  stripe / reference / notes fields. */
export interface SafeCommissionRow {
  id: string;
  transaction_id: string;
  commission_status: string;
  approved_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  /** Last 4 chars only (masked), or null. */
  payment_reference_tail: string | null;
  /** Whether a statement PDF exists — boolean only, no URL leaks to agent. */
  has_statement: boolean;
}

/** Blocker from W3.4.3.0 — `current` may be absent for count-based gates. */
export interface CommissionGateBlocker {
  key:
    | "transaction_not_closed"
    | "broker_review_not_approved"
    | "compliance_not_passed"
    | "required_checklist_incomplete"
    | "required_forms_incomplete"
    | "signatures_incomplete"
    | "statutory_attestations_incomplete";
  label: string;
  current?: string | null;
  remaining?: number;
  total_required?: number;
}

/** Verdict returned by W3.4.3.0. */
export interface CommissionGateVerdict {
  commission_id: string;
  transaction_id: string;
  commission_status: string;
  payable: boolean;
  blockers: CommissionGateBlocker[];
  ts: string;
}

/** Composed state passed to the CommissionTab component. */
export interface CommissionWorkspaceState {
  /** When the workspace has no commission row to display (not yet
   *  calculated, broker hasn't started workflow, etc.) */
  isEmpty: boolean;
  /** Soft-fail diagnostic — set when the gate-verdict fetch errored. */
  gateFetchError: string | null;

  /** Safe-projected commission. Null when isEmpty=true. */
  commission: SafeCommissionRow | null;

  /** Header summary. */
  stageLabel: string;
  stageDescription: string;
  stageTone: CommissionTone;

  /** Readiness summary: how many gates passing of 7. */
  readinessScore: { passing: number; total: number };

  /** Per-gate items rendered as a 7-row checklist. Always 7 items —
   *  passing gates use tone='ok' + null current/remaining. */
  gateRows: ReadonlyArray<{
    key: CommissionGateBlocker["key"];
    label: string;
    detail: string | null;
    tone: CommissionTone;
    drillHref: string | null;
  }>;

  /** Blocking reasons (subset of gateRows that failed). Empty when all pass. */
  blockers: ReadonlyArray<CommissionGateBlocker>;

  /** Whether the commission can be paid right now (verdict.payable). */
  payable: boolean;

  /** Broker review + compliance + closing-date summary rows. */
  brokerReviewLabel: string;
  brokerReviewTone: CommissionTone;
  complianceLabel: string;
  complianceTone: CommissionTone;
  closingDateLabel: string | null;

  /** Payment history. Null when never paid. */
  paymentHistory: {
    paidAt: string;
    methodLabel: string;
    referenceTail: string | null;
    hasStatement: boolean;
  } | null;

  /** Drill links composed from the page. */
  drillLinks: {
    compliance: string; // local Agent Portal route
    documents: string;  // local
    timeline: string;   // local
    paperworkPackage: string; // Vault deep link
  };
}
