// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.2 — Compliance tab composer
// ============================================================================
// Pure function. Composes the per-section state for the Compliance tab
// from already-loaded signals + the safe payout-readiness projection.
//
// ZERO business-rule recomputation. ZERO commission amounts. ZERO
// Stripe data. ZERO broker notes. ZERO raw Vault per-check blocker
// strings. Boundary lint asserts.
// ============================================================================

import type { WorkspaceCard } from "../types";
import type { DocumentRow, RequirementRow } from "../../documents/types";
import type {
  MissingFieldsItem,
} from "../../documents/details/types";
import { formDrawerHref } from "../../documents/details/helpers";

import type {
  BlockerItem,
  ComplianceReadinessHeader,
  ComplianceTabState,
  EnvelopeSummaryRow,
  GateStatus,
  GateSummary,
  PillTone,
  RequiredFormSummary,
  SafePayoutReadinessSummary,
  StatutoryItemSummary,
  WarningItem,
} from "./types";

const STATUTORY_LABELS: Record<string, string> = {
  "facts.flood_history": "Flood history disclosure",
  "facts.prior_insurance_claim": "Prior insurance claim disclosure",
  "facts.prior_fema_assistance": "Prior FEMA assistance disclosure",
  "facts.lead_paint_knowledge": "Lead paint knowledge disclosure",
  "facts.lead_paint_records": "Lead paint records disclosure",
};

const GATE_LABELS: Record<keyof SafePayoutReadinessSummary["gates"], string> = {
  transaction_status_valid: "Transaction closed",
  closing_date_present: "Closing date present",
  agent_profile_complete: "Agent profile complete",
  agent_payout_method: "Payout method on file",
  tax_info_w9: "Tax info on file",
  compliance_checklist_complete: "Compliance checklist complete",
  documents_uploaded: "Documents uploaded",
};

export interface ComposeComplianceInputs {
  card: WorkspaceCard;
  /** Already-loaded MissingFieldsReport items[]. */
  missingItems: MissingFieldsItem[];
  /** From /missing-fields. */
  satisfiedStatutoryPaths: ReadonlyArray<string>;
  /** From /missing-fields. */
  statutoryCount: number;
  /** Documents (merged) — for required-forms list. */
  documents: ReadonlyArray<DocumentRow>;
  /** Raw requirements — for reason text. */
  requirements: ReadonlyArray<RequirementRow>;
  /** transactions.status. */
  transactionStatus: string | null;
  /** transactions.broker_review_status. */
  brokerReviewStatus: string | null;
  /** transactions.closing_date (ISO). */
  closingDate: string | null;
  /** Safe projection of /payout-readiness. null when fetch degraded. */
  payoutReadiness: SafePayoutReadinessSummary | null;
  /** Vault paperwork-package URL. */
  paperworkPackageUrl: string;
}

export function composeComplianceTabState(
  input: ComposeComplianceInputs
): ComplianceTabState {
  const readiness = composeReadinessHeader(input);
  const blockers = composeBlockers(input);
  const warnings = composeWarnings(input);
  const requiredForms = composeRequiredForms(input);
  const statutory = composeStatutory(input);
  const brokerReview = composeBrokerReview(input);
  const envelope = composeEnvelopeSummary(input);
  const gates = composeGates(input);

  return {
    readiness,
    blockers,
    warnings,
    requiredForms,
    statutory,
    brokerReview,
    envelope,
    gates,
    paperworkPackageUrl: input.paperworkPackageUrl,
    payoutReadinessDegraded: input.payoutReadiness === null,
  };
}

// ── Readiness header ────────────────────────────────────────────────

function composeReadinessHeader(
  i: ComposeComplianceInputs
): ComplianceReadinessHeader {
  return {
    score: i.card.readiness_score,
    tier: i.card.readiness_tier,
    stage: i.card.stage,
    nextAction: i.card.next_action,
    suggestedPrompt: i.card.suggested_prompt,
  };
}

// ── Blockers ─────────────────────────────────────────────────────────

function composeBlockers(i: ComposeComplianceInputs): BlockerItem[] {
  const out: BlockerItem[] = [];

  // 1. Statutory missing — always a blocker
  for (const item of i.missingItems) {
    const sev = item.severity ?? "";
    if (sev.startsWith("statutory_")) {
      const path = item.transaction_path;
      out.push({
        key: `statutory:${path}`,
        label: `${STATUTORY_LABELS[path] ?? path} awaiting party portal`,
        severity: sev,
      });
    }
  }

  // 2. High-severity non-statutory missing — first form they block deep-links to drawer
  for (const item of i.missingItems) {
    const sev = item.severity ?? "";
    if (sev === "high") {
      const firstForm = item.blocks_forms?.[0];
      const cta = firstForm
        ? {
            label: `Open ${firstForm}`,
            href: formDrawerHref(i.card.transaction_id, firstForm),
          }
        : undefined;
      out.push({
        key: `missing:${item.transaction_path}`,
        label: item.label ?? item.transaction_path,
        severity: sev,
        cta,
      });
    }
  }

  // 3. Blocked forms (status='blocked') — even when missing-fields hasn't surfaced an item for them
  for (const doc of i.documents) {
    if (doc.status === "blocked") {
      out.push({
        key: `form-blocked:${doc.form_id}`,
        label: `Form ${doc.form_id} blocked`,
        severity: "high",
        cta: {
          label: `Open ${doc.form_id}`,
          href: formDrawerHref(i.card.transaction_id, doc.form_id),
        },
      });
    }
  }

  // 4. Broker review requested revisions
  if ((i.brokerReviewStatus ?? "").toLowerCase() === "revisions_required") {
    out.push({
      key: "broker:revisions",
      label: "Broker requested revisions",
      severity: "high",
    });
  }

  // Dedupe by key — preserves first occurrence order.
  const seen = new Set<string>();
  return out.filter((b) => {
    if (seen.has(b.key)) return false;
    seen.add(b.key);
    return true;
  });
}

// ── Warnings ─────────────────────────────────────────────────────────

function composeWarnings(i: ComposeComplianceInputs): WarningItem[] {
  const out: WarningItem[] = [];

  // Closing date soon but forms incomplete
  if (i.closingDate) {
    const daysUntil = daysUntilDate(i.closingDate);
    if (
      daysUntil != null &&
      daysUntil >= 0 &&
      daysUntil <= 7 &&
      i.card.required_forms_count > 0 &&
      i.card.signed_forms_count < i.card.required_forms_count
    ) {
      out.push({
        key: "closing-soon",
        label: `Closing date in ${daysUntil} day${daysUntil === 1 ? "" : "s"} · ${i.card.signed_forms_count} of ${i.card.required_forms_count} required forms signed`,
      });
    }
  } else {
    out.push({
      key: "closing-date-missing",
      label: "Closing date not yet set",
    });
  }

  // Pre-close staging
  const txnStatus = (i.transactionStatus ?? "").toLowerCase();
  if (txnStatus === "approved" || txnStatus === "pending") {
    out.push({
      key: "pre-close",
      label: "Transaction is in pre-close staging",
    });
  }

  // Payout-readiness not_tracked items (when broker can't yet verify)
  if (i.payoutReadiness) {
    const g = i.payoutReadiness.gates;
    if (g.agent_payout_method === "not_tracked") {
      out.push({
        key: "payout-method",
        label: "Payout method not yet recorded",
      });
    }
    if (g.tax_info_w9 === "not_tracked") {
      out.push({
        key: "tax-info",
        label: "Tax info (W-9) not yet recorded",
      });
    }
  }

  return out;
}

// ── Required forms ───────────────────────────────────────────────────

function composeRequiredForms(
  i: ComposeComplianceInputs
): RequiredFormSummary[] {
  // We surface every DocumentRow (which already merges rule-engine
  // requirements + form_instances). Statuses already derived by Vault.
  return i.documents.map((d) => {
    const req = i.requirements.find((r) => r.form_id === d.form_id) ?? null;
    return {
      form_id: d.form_id,
      form_revision: d.form_revision,
      form_category: d.form_category,
      status: d.status,
      reason: req?.reason ?? d.reason ?? null,
      drawerHref: formDrawerHref(i.card.transaction_id, d.form_id),
      vaultHref: d.open_in_vault_url,
    };
  });
}

// ── Statutory disclosures ───────────────────────────────────────────

function composeStatutory(i: ComposeComplianceInputs): StatutoryItemSummary[] {
  const STATUTORY_PATHS = Object.keys(STATUTORY_LABELS);
  const satisfied = new Set(i.satisfiedStatutoryPaths);
  // For each known statutory key, surface its satisfaction state.
  // Only include keys that appear in the missing report OR satisfied
  // paths (otherwise the form may not be required at all on this txn).
  const referenced = new Set<string>(satisfied);
  for (const item of i.missingItems) {
    if ((item.severity ?? "").startsWith("statutory_")) {
      referenced.add(item.transaction_path);
    }
  }
  return STATUTORY_PATHS.filter((p) => referenced.has(p)).map((path) => {
    const isSatisfied = satisfied.has(path);
    return {
      transaction_path: path,
      label: STATUTORY_LABELS[path] ?? path,
      satisfied: isSatisfied,
      awaitingHint: isSatisfied
        ? "Attested via party portal"
        : "Awaiting party portal attestation",
    };
  });
}

// ── Broker review ───────────────────────────────────────────────────

function composeBrokerReview(
  i: ComposeComplianceInputs
): ComplianceTabState["brokerReview"] {
  const status = (i.brokerReviewStatus ?? "").toLowerCase();
  let pill: { tone: PillTone; label: string };
  switch (status) {
    case "draft":
      pill = { tone: "muted", label: "Not yet submitted" };
      break;
    case "submitted":
      pill = { tone: "info", label: "Awaiting broker review" };
      break;
    case "approved":
      pill = { tone: "ok", label: "Approved by broker" };
      break;
    case "revisions_required":
      pill = { tone: "warn", label: "Broker requested revisions" };
      break;
    case "":
      pill = { tone: "muted", label: "Status unknown" };
      break;
    default:
      pill = { tone: "muted", label: `Status: ${status}` };
  }
  return { status, pill };
}

// ── Envelope summary ────────────────────────────────────────────────

function composeEnvelopeSummary(
  i: ComposeComplianceInputs
): EnvelopeSummaryRow {
  return {
    pending: i.card.pending_envelopes_count,
    signed: i.card.signed_forms_count,
    ready_awaiting_send: Math.max(
      0,
      i.card.ready_forms_count - i.card.pending_envelopes_count
    ),
  };
}

// ── Readiness gates ─────────────────────────────────────────────────

function composeGates(i: ComposeComplianceInputs): GateSummary[] {
  // 4 composed gates from already-loaded data, regardless of
  // payout-readiness availability. Mirrors the W3.3 enforcement gates.
  const composed: GateSummary[] = [];

  // 1. Transaction closed
  const txnStatus = (i.transactionStatus ?? "").toLowerCase();
  composed.push({
    key: "transaction-closed",
    label: "Transaction closed",
    status: txnStatus === "closed" ? "ok" : "blocked",
    detail: txnStatus === "closed" ? "Closed" : "Not yet closed",
  });

  // 2. Broker review approved
  const review = (i.brokerReviewStatus ?? "").toLowerCase();
  composed.push({
    key: "broker-review-approved",
    label: "Broker review approved",
    status:
      review === "approved"
        ? "ok"
        : review === "submitted"
        ? "warning"
        : "blocked",
    detail:
      review === "approved"
        ? "Approved"
        : review === "submitted"
        ? "Submitted, awaiting broker"
        : review === "revisions_required"
        ? "Revisions requested"
        : "Not yet submitted",
  });

  // 3. Required forms complete
  const required = i.card.required_forms_count;
  const signed = i.card.signed_forms_count;
  composed.push({
    key: "required-forms-complete",
    label: "Required forms complete",
    status:
      required > 0 && signed === required
        ? "ok"
        : required > 0
        ? "warning"
        : "not_tracked",
    detail:
      required > 0
        ? `${signed} of ${required} signed`
        : "No required forms yet",
  });

  // 4. Statutory attestations complete
  composed.push({
    key: "statutory-complete",
    label: "Statutory attestations complete",
    status:
      i.statutoryCount === 0
        ? "ok"
        : "warning",
    detail:
      i.statutoryCount === 0
        ? "All attested"
        : `${i.statutoryCount} awaiting party portal`,
  });

  // Append the agent-safe payout-readiness gates (if available).
  // These are status-only — labels come from GATE_LABELS, never Vault.
  if (i.payoutReadiness) {
    const g = i.payoutReadiness.gates;
    const orderedKeys: Array<keyof typeof g> = [
      "closing_date_present",
      "documents_uploaded",
      "agent_profile_complete",
      "compliance_checklist_complete",
      "agent_payout_method",
      "tax_info_w9",
    ];
    for (const k of orderedKeys) {
      composed.push({
        key: `payout-readiness:${k}`,
        label: GATE_LABELS[k],
        status: g[k],
        detail: gateDetailLabel(g[k]),
      });
    }
  }

  return composed;
}

function gateDetailLabel(s: GateStatus): string {
  if (s === "ok") return "Satisfied";
  if (s === "warning") return "Needs attention";
  if (s === "blocked") return "Blocking";
  return "Not tracked yet";
}

// ── Helpers ─────────────────────────────────────────────────────────

function daysUntilDate(iso: string, now: Date = new Date()): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - now.getTime();
  return Math.round(ms / 86400000);
}
