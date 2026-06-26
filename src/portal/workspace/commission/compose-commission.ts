// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.4.3.1 — Commission Workspace composer
// ============================================================================
// Pure function. Given the gate verdict + safe-projected commission row +
// already-loaded snapshot signals (txn status / broker review / compliance
// / closing date), composes the read-only CommissionWorkspaceState.
//
// NO commission logic here. The gate verdict is computed by Vault
// (W3.4.3.0 → W3.4.1 helper). This composer just renders.
// ============================================================================

import type { FetchCommissionResult } from "./api";
import type {
  CommissionGateBlocker,
  CommissionGateVerdict,
  CommissionTone,
  CommissionWorkspaceState,
  SafeCommissionRow,
} from "./types";

export interface ComposeCommissionInputs {
  fetchResult: FetchCommissionResult;
  /** Already-loaded txn signals (page-level). */
  transactionStatus: string | null;
  brokerReviewStatus: string | null;
  complianceOverallStatus: string | null;
  closingDate: string | null;
  /** Drill targets. */
  workspaceBaseUrl: string; // e.g. "/workspace/<txnId>"
  paperworkPackageUrl: string;
}

// Display order = same order as W3.4.1 / W3.4.3.0 emits.
const GATE_DISPLAY_ORDER: ReadonlyArray<{
  key: CommissionGateBlocker["key"];
  label: string;
}> = [
  { key: "transaction_not_closed", label: "Transaction closed" },
  { key: "broker_review_not_approved", label: "Broker review approved" },
  { key: "compliance_not_passed", label: "Compliance check passed" },
  {
    key: "required_checklist_incomplete",
    label: "Required checklist complete",
  },
  { key: "required_forms_incomplete", label: "Required Florida forms signed" },
  { key: "signatures_incomplete", label: "Signatures complete" },
  {
    key: "statutory_attestations_incomplete",
    label: "Statutory disclosures attested",
  },
];

export function composeCommissionState(
  input: ComposeCommissionInputs
): CommissionWorkspaceState {
  const drillLinks = {
    compliance: `${input.workspaceBaseUrl}?tab=compliance`,
    documents: `${input.workspaceBaseUrl}?tab=documents`,
    timeline: `${input.workspaceBaseUrl}?tab=timeline`,
    paperworkPackage: input.paperworkPackageUrl,
  };

  // Empty / error states — same chrome, different body.
  if (input.fetchResult.kind === "empty") {
    return emptyState(drillLinks, "Commission not yet calculated");
  }
  if (input.fetchResult.kind === "error") {
    return errorState(drillLinks, input.fetchResult.message);
  }

  // OK path.
  const commission = input.fetchResult.commission;
  const verdict = input.fetchResult.verdict;
  const verdictError = input.fetchResult.verdictError;

  const blockers = verdict?.blockers ?? [];
  const blockerByKey = new Map(blockers.map((b) => [b.key, b]));

  // Build the 7-row checklist. Each row is OK if absent from blockers,
  // WARN if present.
  const gateRows = GATE_DISPLAY_ORDER.map((g) => {
    const b = blockerByKey.get(g.key);
    const passing = !b;
    return {
      key: g.key,
      label: g.label,
      detail: passing ? null : blockerDetail(b!),
      tone: (passing ? "ok" : "warn") as CommissionTone,
      drillHref: gateDrillFor(g.key, drillLinks),
    };
  });

  const passingCount = gateRows.filter((g) => g.tone === "ok").length;

  // Header summary.
  const [stageLabel, stageDescription, stageTone] = composeStageSummary(
    commission,
    verdict,
    blockers.length
  );

  // Broker review row.
  const brokerReview = (input.brokerReviewStatus ?? "").toLowerCase();
  const brokerReviewLabel = brokerReviewSummary(brokerReview);
  const brokerReviewTone: CommissionTone =
    brokerReview === "approved"
      ? "ok"
      : brokerReview === "revisions_required"
      ? "warn"
      : brokerReview === "submitted"
      ? "info"
      : "muted";

  // Compliance row.
  const compliance = (input.complianceOverallStatus ?? "").toLowerCase();
  const complianceLabel = complianceSummary(compliance);
  const complianceTone: CommissionTone =
    compliance === "passed"
      ? "ok"
      : compliance === "issues_found" || compliance === "failed"
      ? "warn"
      : "muted";

  // Closing date row (informational only).
  const closingDateLabel = closingDateString(
    input.closingDate,
    input.transactionStatus
  );

  // Payment history (only when paid).
  const paymentHistory =
    commission.paid_at
      ? {
          paidAt: commission.paid_at,
          methodLabel: paymentMethodLabel(commission.payment_method),
          referenceTail: commission.payment_reference_tail,
          hasStatement: commission.has_statement,
        }
      : null;

  return {
    isEmpty: false,
    gateFetchError: verdictError,
    commission,
    stageLabel,
    stageDescription,
    stageTone,
    readinessScore: { passing: passingCount, total: GATE_DISPLAY_ORDER.length },
    gateRows,
    blockers,
    payable: verdict?.payable === true,
    brokerReviewLabel,
    brokerReviewTone,
    complianceLabel,
    complianceTone,
    closingDateLabel,
    paymentHistory,
    drillLinks,
  };
}

// ── Empty / error scaffolding ───────────────────────────────────────

function emptyState(
  drillLinks: CommissionWorkspaceState["drillLinks"],
  bodyLabel: string
): CommissionWorkspaceState {
  return {
    isEmpty: true,
    gateFetchError: null,
    commission: null,
    stageLabel: bodyLabel,
    stageDescription:
      "The broker has not started the commission workflow for this transaction. The commission becomes visible once it is calculated in Vault.",
    stageTone: "muted",
    readinessScore: { passing: 0, total: GATE_DISPLAY_ORDER.length },
    gateRows: GATE_DISPLAY_ORDER.map((g) => ({
      key: g.key,
      label: g.label,
      detail: null,
      tone: "muted" as CommissionTone,
      drillHref: gateDrillFor(g.key, drillLinks),
    })),
    blockers: [],
    payable: false,
    brokerReviewLabel: "Pending",
    brokerReviewTone: "muted",
    complianceLabel: "Not yet checked",
    complianceTone: "muted",
    closingDateLabel: null,
    paymentHistory: null,
    drillLinks,
  };
}

function errorState(
  drillLinks: CommissionWorkspaceState["drillLinks"],
  message: string
): CommissionWorkspaceState {
  const base = emptyState(drillLinks, "Commission unavailable");
  return {
    ...base,
    gateFetchError: message,
    stageDescription:
      "Commission data could not be loaded right now. Try again in a moment.",
  };
}

// ── Per-blocker copy ────────────────────────────────────────────────

function blockerDetail(b: CommissionGateBlocker): string {
  switch (b.key) {
    case "transaction_not_closed":
      return `Transaction is ${b.current ?? "open"}.`;
    case "broker_review_not_approved":
      return `Broker review is ${b.current ?? "pending"}.`;
    case "compliance_not_passed":
      return `Compliance status: ${b.current ?? "not checked"}.`;
    case "required_checklist_incomplete":
      return countLine(b, "checklist item", "checklist items");
    case "required_forms_incomplete":
      return countLine(b, "form", "forms");
    case "signatures_incomplete":
      return countLine(b, "envelope", "envelopes");
    case "statutory_attestations_incomplete":
      return countLine(b, "disclosure", "disclosures");
  }
}

function countLine(
  b: CommissionGateBlocker,
  singular: string,
  plural: string
): string {
  const remaining = typeof b.remaining === "number" ? b.remaining : null;
  const total = typeof b.total_required === "number" ? b.total_required : null;
  if (remaining === null) return b.label;
  const noun = remaining === 1 ? singular : plural;
  if (total === null) return `${remaining} ${noun} remaining.`;
  return `${remaining} of ${total} ${noun} remaining.`;
}

// ── Stage header ────────────────────────────────────────────────────

function composeStageSummary(
  commission: SafeCommissionRow,
  verdict: CommissionGateVerdict | null,
  blockerCount: number
): [string, string, CommissionTone] {
  const status = commission.commission_status;
  if (status === "paid") {
    return [
      "Commission paid",
      "Payment has been processed by the broker.",
      "ok",
    ];
  }
  if (status === "disputed") {
    return [
      "Commission disputed",
      "The broker has flagged this commission as disputed.",
      "warn",
    ];
  }
  if (status !== "broker_approved") {
    return [
      "Commission in workflow",
      `Current stage: ${prettyStage(status)}. The broker is still working on this commission.`,
      "info",
    ];
  }
  // status === broker_approved
  if (verdict && verdict.payable) {
    return [
      "Ready for broker payout",
      "All commission gates are clear. The broker can release payment.",
      "ok",
    ];
  }
  if (blockerCount > 0) {
    const noun = blockerCount === 1 ? "gate" : "gates";
    return [
      `Approved — blocked by ${blockerCount} ${noun}`,
      "The commission is approved, but at least one closing-day gate is not yet clear.",
      "warn",
    ];
  }
  // No verdict (fetch error fallback) — show approved with neutral copy.
  return [
    "Approved",
    "Awaiting broker payout.",
    "info",
  ];
}

function prettyStage(status: string): string {
  switch (status) {
    case "pending_calculation":
      return "pending calculation";
    case "calculated":
      return "calculated";
    case "compliance_check":
      return "compliance check";
    case "broker_approved":
      return "broker approved";
    case "payment_processing":
      return "payment processing";
    case "paid":
      return "paid";
    case "disputed":
      return "disputed";
    default:
      return status;
  }
}

// ── Side summaries ──────────────────────────────────────────────────

function brokerReviewSummary(status: string): string {
  switch (status) {
    case "approved":
      return "Approved by broker";
    case "submitted":
      return "Submitted for broker review";
    case "revisions_required":
      return "Broker requested revisions";
    case "draft":
      return "Draft — not yet submitted";
    default:
      return status ? `Status: ${status}` : "Not yet submitted";
  }
}

function complianceSummary(status: string): string {
  switch (status) {
    case "passed":
      return "Compliance passed";
    case "issues_found":
      return "Compliance found issues";
    case "failed":
      return "Compliance failed";
    case "pending":
      return "Compliance check pending";
    default:
      return "Compliance not yet checked";
  }
}

function closingDateString(
  closingDate: string | null,
  txnStatus: string | null
): string | null {
  if (!closingDate) return null;
  const d = new Date(closingDate);
  if (Number.isNaN(d.getTime())) return null;
  const formatted = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return txnStatus === "closed"
    ? `Closed ${formatted}`
    : `Scheduled closing: ${formatted}`;
}

function paymentMethodLabel(method: string | null): string {
  switch (method) {
    case "ach":
      return "ACH direct deposit";
    case "wire":
      return "Wire transfer";
    case "check":
      return "Check";
    default:
      return "Payment";
  }
}

// ── Gate-level drill targets ────────────────────────────────────────

function gateDrillFor(
  key: CommissionGateBlocker["key"],
  drillLinks: CommissionWorkspaceState["drillLinks"]
): string | null {
  switch (key) {
    case "transaction_not_closed":
      return null; // No agent-facing fix
    case "broker_review_not_approved":
      return drillLinks.timeline;
    case "compliance_not_passed":
      return drillLinks.compliance;
    case "required_checklist_incomplete":
      return drillLinks.compliance;
    case "required_forms_incomplete":
      return drillLinks.documents;
    case "signatures_incomplete":
      return drillLinks.documents;
    case "statutory_attestations_incomplete":
      return drillLinks.compliance;
  }
}
