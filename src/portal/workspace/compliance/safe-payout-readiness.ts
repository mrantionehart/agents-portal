// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.C.2 — Safe payout-readiness mask
// ============================================================================
// Pure function. Boundary between Vault's full PayoutReadinessSummary
// (which carries broker-context strings) and Agent Portal's safe
// projection (which only carries the 7 allowlisted gate statuses).
//
// CONTRACT — by construction:
//   • Drops checks not in the AGENT_SAFE_CHECK_IDS allowlist
//     (approval / ledger / brokerage_math / cap / projection / revision)
//   • Drops every per-check detail/blocker/warning string
//   • Drops aggregated blockers[] / warnings[] (may contain broker context)
//   • Keeps only: overall status, score, per-gate status enum
//
// Boundary lint asserts none of the dropped field names appear in this
// file or in any consumer.
// ============================================================================

import type { GateStatus, SafePayoutReadinessSummary } from "./types";

/** The 7 check IDs from Vault payout-readiness that are agent-safe to
 *  show as gate statuses. Mirror of the IDs in:
 *  vault/src/lib/deal-copilot/payout-readiness.ts
 *
 *  The OTHER 7 IDs (approval_exists, approval_status_correct,
 *  ledger_snapshot_is_latest, brokerage_commission_math_confirmed,
 *  cap_ledger_materialized, no_stale_projection_warning,
 *  no_unresolved_revision_request) are broker-flavored. Agent Portal
 *  intentionally does not surface them in this tab. */
export const AGENT_SAFE_CHECK_IDS = [
  "transaction_status_valid",
  "closing_date_present",
  "agent_profile_complete",
  "agent_payout_method",
  "tax_info_w9",
  "compliance_checklist_complete",
  "documents_uploaded",
] as const;

type AgentSafeCheckId = (typeof AGENT_SAFE_CHECK_IDS)[number];

/** Loose shape that Vault returns. We intentionally do NOT depend on
 *  Vault's exact `PayoutReadinessSummary` import — we read only what we
 *  need and drop the rest. */
interface UnsafePayoutReadinessShape {
  status?: string;
  score?: number;
  checks?: Array<{
    id?: string;
    status?: string;
    // intentionally NOT extracted: label, detail, blocker, warning,
    // source, raw_messages. Boundary lint asserts they are not
    // referenced in this module.
  }>;
  // intentionally NOT extracted: blockers, warnings, computed_at
  // (computed_at is harmless but we don't need it; blockers/warnings
  // may carry broker context).
}

const VALID_OVERALL: ReadonlySet<string> = new Set(["ready", "partial", "blocked"]);

/** Coerce an unknown gate status from Vault into our enum. */
function coerceGateStatus(s: unknown): GateStatus {
  if (s === "ok" || s === "warning" || s === "blocked" || s === "not_tracked") {
    return s;
  }
  return "not_tracked";
}

/** Mask a Vault response into the agent-safe projection. */
export function toSafePayoutReadiness(
  raw: unknown
): SafePayoutReadinessSummary {
  const body = (raw ?? {}) as UnsafePayoutReadinessShape;

  // Build a key→status map filtered to the allowlist.
  const gateMap = new Map<AgentSafeCheckId, GateStatus>();
  for (const id of AGENT_SAFE_CHECK_IDS) {
    gateMap.set(id, "not_tracked");
  }
  if (Array.isArray(body.checks)) {
    for (const c of body.checks) {
      if (typeof c?.id !== "string") continue;
      if (!(AGENT_SAFE_CHECK_IDS as ReadonlyArray<string>).includes(c.id)) {
        continue; // not on allowlist — dropped
      }
      gateMap.set(c.id as AgentSafeCheckId, coerceGateStatus(c.status));
    }
  }

  const overallRaw = typeof body.status === "string" ? body.status : "";
  const overallStatus = VALID_OVERALL.has(overallRaw)
    ? (overallRaw as SafePayoutReadinessSummary["overallStatus"])
    : "blocked";

  const score =
    typeof body.score === "number" && Number.isFinite(body.score)
      ? Math.max(0, Math.min(100, Math.round(body.score)))
      : 0;

  return {
    overallStatus,
    score,
    gates: {
      transaction_status_valid: gateMap.get("transaction_status_valid")!,
      closing_date_present: gateMap.get("closing_date_present")!,
      agent_profile_complete: gateMap.get("agent_profile_complete")!,
      agent_payout_method: gateMap.get("agent_payout_method")!,
      tax_info_w9: gateMap.get("tax_info_w9")!,
      compliance_checklist_complete: gateMap.get("compliance_checklist_complete")!,
      documents_uploaded: gateMap.get("documents_uploaded")!,
    },
  };
}
