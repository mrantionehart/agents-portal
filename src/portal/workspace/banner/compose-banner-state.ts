// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.1 — ComplianceBanner state composer
// ============================================================================
// Pure functions. Take only signals already published by existing Vault
// endpoints and compose three banner pills (compliance / broker review /
// commission eligibility).
//
// SAFETY CONTRACT — the BannerSignals input type intentionally OMITS
// every broker-only field:
//   • no commission amounts / splits / brokerage_amount / cap_applied
//   • no Stripe IDs (stripe_payout_id, payment_reference)
//   • no broker notes / review_notes / coaching_notes / revision_notes
//   • no payout-readiness raw blockers
//
// The composer cannot leak what it never receives. Tests assert no
// broker-only field names appear anywhere in this module.
// ============================================================================

/** Pure input — every field is already loaded by the workspace page
 *  from agent-readable sources (WorkspaceCard, Supabase tenant-RLS
 *  SELECT on transactions, or /paperwork/transactions/[id]/missing-fields). */
export interface BannerSignals {
  // ── From WorkspaceCard (always loaded by W3.1 page) ────────────────
  readiness_tier:
    | "collecting"
    | "drafting"
    | "almost_ready"
    | "ready_for_review"
    | "ready_for_signature";
  required_forms_count: number;
  ready_forms_count: number;
  signed_forms_count: number;
  blocked_forms_count: number;
  pending_envelopes_count: number;
  portal_status: "none" | "invite_sent" | "submitted";
  /** Structural invariant in WorkspaceCard. */
  broker_confirmation_required: boolean;

  // ── From /paperwork/transactions/[id]/missing-fields (page-level) ──
  /** Total statutory items currently outstanding (across all forms). */
  statutory_count: number;
  /** Number of statutory transaction_paths attested via the portal. */
  satisfied_statutory_count: number;

  // ── From transactions table (RLS-bound Supabase SELECT) ────────────
  /** Current broker review state. null when row missing / state unset. */
  broker_review_status:
    | "draft"
    | "submitted"
    | "approved"
    | "revisions_required"
    | string
    | null;
  /** transactions.status — 'closed' is the canonical close marker.
   *  Other values include 'pending', 'approved', 'draft', etc. */
  transaction_status: string | null;
}

export type PillTone = "ok" | "info" | "warn" | "muted";

export interface BannerPillState {
  tone: PillTone;
  label: string;
  /** Optional short detail line under the pill (e.g. exact counts). */
  detail?: string;
}

export interface ComposedBannerState {
  compliance: BannerPillState;
  brokerReview: BannerPillState;
  commission: BannerPillState;
}

// ────────────────────────────────────────────────────────────────────
// Compliance pill — derives from blocked forms + statutory + form counts
// ────────────────────────────────────────────────────────────────────

export function complianceStatus(s: BannerSignals): BannerPillState {
  const blocked = s.blocked_forms_count;
  const statOpen = Math.max(0, s.statutory_count);
  const required = s.required_forms_count;
  const signed = s.signed_forms_count;
  const ready = s.ready_forms_count;

  if (blocked > 0 && statOpen > 0) {
    return {
      tone: "warn",
      label: `${statOpen} statutory · ${blocked} blocked`,
      detail: "Forms blocked on missing required fields or attestations.",
    };
  }
  if (blocked > 0) {
    return {
      tone: "warn",
      label: `${blocked} form${blocked === 1 ? "" : "s"} blocked`,
      detail: "Forms blocked on missing required fields.",
    };
  }
  if (statOpen > 0) {
    return {
      tone: "warn",
      label: `${statOpen} statutory disclosure${statOpen === 1 ? "" : "s"} open`,
      detail: "Awaiting party portal attestation.",
    };
  }
  if (required > 0 && signed === required) {
    return {
      tone: "ok",
      label: "All required forms signed",
    };
  }
  if (required > 0 && ready === required) {
    return {
      tone: "info",
      label: "All required forms ready",
      detail: "Awaiting envelope send.",
    };
  }
  if (required > 0) {
    const completed = signed + ready;
    return {
      tone: "info",
      label: `${completed} / ${required} forms ready or signed`,
    };
  }
  return {
    tone: "muted",
    label: "No required forms yet",
    detail: "Rule engine has not yet emitted required forms for this transaction.",
  };
}

// ────────────────────────────────────────────────────────────────────
// Broker review pill — real value from transactions.broker_review_status
// ────────────────────────────────────────────────────────────────────

export function brokerReviewStatus(s: BannerSignals): BannerPillState {
  const status = (s.broker_review_status ?? "").toLowerCase();
  switch (status) {
    case "draft":
      return { tone: "muted", label: "Not yet submitted" };
    case "submitted":
      return {
        tone: "info",
        label: "Awaiting broker review",
      };
    case "approved":
      return { tone: "ok", label: "Approved by broker" };
    case "revisions_required":
      return {
        tone: "warn",
        label: "Broker requested revisions",
      };
    case "":
      // Unknown — treat as draft-equivalent display, but mark muted.
      return { tone: "muted", label: "Review status unknown" };
    default:
      // Unrecognized — surface raw label, muted tone. Caller logs upstream.
      return { tone: "muted", label: `Status: ${status}` };
  }
}

// ────────────────────────────────────────────────────────────────────
// Commission eligibility pill — composed from agent-safe signals
// ────────────────────────────────────────────────────────────────────
// SAFETY: No amounts, no splits, no Stripe data. Composer only knows
// closure / approval / form-completeness / statutory satisfaction.
// W3.3 will ENFORCE these gates at /api/commissions/pay; W3.2.C.1
// only PRESENTS them.
// ────────────────────────────────────────────────────────────────────

export function commissionEligibility(s: BannerSignals): BannerPillState {
  const closed = (s.transaction_status ?? "").toLowerCase() === "closed";
  const approved = (s.broker_review_status ?? "").toLowerCase() === "approved";
  const formsDone =
    s.required_forms_count > 0 && s.signed_forms_count === s.required_forms_count;
  const statutoryDone = s.statutory_count === 0;

  if (!closed) {
    return {
      tone: "muted",
      label: "Awaiting transaction close",
      detail: "Commission becomes eligible after the transaction closes.",
    };
  }
  if (!approved) {
    return {
      tone: "muted",
      label: "Awaiting broker approval",
      detail: "Broker must approve the transaction before commission processing.",
    };
  }
  if (!formsDone) {
    return {
      tone: "warn",
      label: "Documents incomplete",
      detail: `${s.signed_forms_count} / ${s.required_forms_count} required forms signed.`,
    };
  }
  if (!statutoryDone) {
    return {
      tone: "warn",
      label: "Statutory attestations incomplete",
      detail: "Awaiting party portal attestations.",
    };
  }
  return {
    tone: "info",
    label: "Ready for broker payout review",
    detail: "Commission release lives in Vault.",
  };
}

export function composeBannerState(s: BannerSignals): ComposedBannerState {
  return {
    compliance: complianceStatus(s),
    brokerReview: brokerReviewStatus(s),
    commission: commissionEligibility(s),
  };
}
