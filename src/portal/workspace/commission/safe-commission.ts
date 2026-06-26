// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.4.3.1 — Safe commission projection
// ============================================================================
// Boundary mask. Vault's `/api/commissions/get` returns the FULL commission
// row including amounts, splits, cap math, Stripe IDs, payment_reference,
// notes. This module's job is to strip every broker-only field BEFORE the
// data reaches the composer.
//
// The output type (SafeCommissionRow) has NO amount / split / cap / stripe
// / reference / notes fields — broker-only data cannot leak even if the
// Vault response shape changes upstream (extra keys are dropped).
// ============================================================================

import type { SafeCommissionRow } from "./types";

/** Loose mirror of Vault's commission row. Used only as a Raw input shape
 *  — every field we DON'T pick is dropped at the boundary. */
export interface RawCommissionRow {
  id?: string;
  transaction_id?: string;
  commission_status?: string;
  approved_at?: string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  commission_statement_url?: string | null;
  /** Broker-only fields — INTENTIONALLY listed so consumers know they
   *  exist and MUST NOT reach the agent UI. They are stripped by the
   *  projection below. */
  net_commission?: number | null;
  agent_amount?: number | null;
  brokerage_amount?: number | null;
  agent_split_pct?: number | null;
  gross_commission?: number | null;
  commission_rate_pct?: number | null;
  transaction_fee?: number | null;
  team_split_amount?: number | null;
  cap_applied?: boolean | null;
  cap_remaining_before?: number | null;
  cap_remaining_after?: number | null;
  referral_fee_amount?: number | null;
  flat_fee_override?: number | null;
  stripe_payout_id?: string | null;
  notes?: string | null;
  approved_by?: string | null;
}

/** Project a raw commission row to its safe agent-visible subset. */
export function toSafeCommissionRow(
  raw: RawCommissionRow | null | undefined
): SafeCommissionRow | null {
  if (!raw || !raw.id || !raw.transaction_id || !raw.commission_status) {
    return null;
  }
  return {
    id: raw.id,
    transaction_id: raw.transaction_id,
    commission_status: raw.commission_status,
    approved_at: raw.approved_at ?? null,
    paid_at: raw.paid_at ?? null,
    payment_method: raw.payment_method ?? null,
    payment_reference_tail: maskReference(raw.payment_reference ?? null),
    has_statement: !!raw.commission_statement_url,
  };
}

/** Last 4 visible characters only. Returns null when the reference is
 *  empty / too short to mask. */
function maskReference(ref: string | null): string | null {
  if (typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (trimmed.length < 4) return null;
  return trimmed.slice(-4);
}

/** Picks the most relevant commission for a transaction from a list of
 *  raw rows. Most-recently-created wins. Returns null on empty input.
 *  Defensive against arrays with junk entries. */
export function pickCurrentCommission(
  raw: ReadonlyArray<RawCommissionRow> | null | undefined,
  transactionId: string
): RawCommissionRow | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const forTxn = raw.filter(
    (r) =>
      r &&
      typeof r === "object" &&
      r.transaction_id === transactionId &&
      typeof r.id === "string"
  );
  if (forTxn.length === 0) return null;
  // Caller may already be sorted by created_at DESC; we tie-break by
  // commission_status priority (`paid` > `broker_approved` > everything).
  const STATUS_PRIORITY: Record<string, number> = {
    paid: 5,
    broker_approved: 4,
    payment_processing: 3,
    compliance_check: 2,
    calculated: 1,
    pending_calculation: 0,
    disputed: -1,
  };
  forTxn.sort((a, b) => {
    const ap = STATUS_PRIORITY[(a.commission_status ?? "") as string] ?? -2;
    const bp = STATUS_PRIORITY[(b.commission_status ?? "") as string] ?? -2;
    return bp - ap;
  });
  return forTxn[0];
}
