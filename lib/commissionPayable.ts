// ============================================================================
// COMMISSION-CANONICAL-FORMULA-1 — what the Portal may call "your amount"
// ============================================================================
// The Portal displayed `commissions.agent_amount`. Two problems with that:
//
//   1. It is not what gets paid. Vault's /api/commissions/pay moves
//      `net_commission`. On a calculated row the two agree; on a row this
//      Portal created they did not, because this Portal's own
//      transaction-create path wrote agent_amount with a third formula that
//      charged no transaction fee (8,400.00 where 8,193.50 is payable).
//   2. It is NOT NULL in the schema, so it always renders as a number —
//      including on a row whose money was never calculated at all, where the
//      honest answer is "not yet", not "$0" and certainly not an estimate.
//
// `net_commission` is nullable and is written only by Vault's calculator, so
// its presence is the signal: a figure means calculated and payable, null
// means the calculation has not run. That is the only distinction this
// module makes, and every agent-facing commission figure goes through it.
// ============================================================================

export interface PayableCommissionRow {
  net_commission?: number | string | null
  commission_status?: string | null
}

/**
 * The amount actually payable on this commission, or null when it has not
 * been calculated. Never falls back to `agent_amount` — that field is
 * exactly what this function exists to stop displaying.
 */
export function payableAmount(row: PayableCommissionRow | null | undefined): number | null {
  if (!row) return null
  const raw = row.net_commission
  // PostgREST returns numeric columns as numbers, but a numeric(12,2) can
  // arrive as a string depending on the driver; accept both, reject anything
  // that is not a finite number once coerced.
  const n = typeof raw === 'string' ? Number(raw) : raw
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return n
}

/** Sum of the payable amounts, skipping rows with no calculated figure. */
export function totalPayable(rows: ReadonlyArray<PayableCommissionRow>): number {
  return rows.reduce((sum, r) => {
    const a = payableAmount(r)
    return a == null ? sum : sum + a
  }, 0)
}

/** How many rows are still waiting on Vault's commission calculation. */
export function pendingCalculationCount(
  rows: ReadonlyArray<PayableCommissionRow>
): number {
  return rows.filter((r) => payableAmount(r) == null).length
}

export const PENDING_CALCULATION_LABEL = 'Pending calculation'

/** What to render in a "your amount" cell. */
export function formatPayable(row: PayableCommissionRow | null | undefined): string {
  const a = payableAmount(row)
  return a == null ? PENDING_CALCULATION_LABEL : `$${a.toLocaleString()}`
}
