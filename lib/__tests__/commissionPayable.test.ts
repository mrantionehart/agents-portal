// ============================================================================
// COMMISSION-CANONICAL-FORMULA-1 — the Portal's payable-amount rule
// ============================================================================
import {
  payableAmount,
  totalPayable,
  pendingCalculationCount,
  referralDeduction,
  formatPayable,
  PENDING_CALCULATION_LABEL,
} from '../commissionPayable'

describe('payableAmount', () => {
  it('returns the calculated net commission', () => {
    expect(payableAmount({ net_commission: 8193.5 })).toBe(8193.5)
  })

  it('accepts a numeric column that arrives as a string', () => {
    expect(payableAmount({ net_commission: '8193.50' })).toBe(8193.5)
  })

  it('returns null when the calculation has not run', () => {
    expect(payableAmount({ net_commission: null })).toBeNull()
    expect(payableAmount({})).toBeNull()
    expect(payableAmount(null)).toBeNull()
    expect(payableAmount(undefined)).toBeNull()
  })

  it('returns null rather than NaN on an unparseable value', () => {
    expect(payableAmount({ net_commission: 'not-a-number' })).toBeNull()
    expect(payableAmount({ net_commission: Number.NaN })).toBeNull()
  })

  it('NEVER falls back to agent_amount', () => {
    // The specific defect: a row this Portal created carries agent_amount
    // 8,400.00 (its own third formula, no transaction fee) and no
    // net_commission. The payable answer is "not yet", never 8,400.
    const apCreatedRow = {
      net_commission: null,
      agent_amount: 8400,
      commission_status: 'pending_calculation',
    } as never
    expect(payableAmount(apCreatedRow)).toBeNull()
    expect(formatPayable(apCreatedRow)).toBe(PENDING_CALCULATION_LABEL)
    expect(formatPayable(apCreatedRow)).not.toContain('8,400')
  })

  it('a zero payable amount is a figure, not an absence', () => {
    // agent_amount is seeded 0 on an uncalculated row, but a CALCULATED zero
    // is a real answer and must not read as "pending".
    expect(payableAmount({ net_commission: 0 })).toBe(0)
    expect(formatPayable({ net_commission: 0 })).toBe('$0')
  })
})

describe('totalPayable / pendingCalculationCount', () => {
  const ROWS = [
    { net_commission: 8193.5 },
    { net_commission: 5393.5 },
    { net_commission: null, agent_amount: 13650 } as never,
  ]

  it('sums only the calculated rows', () => {
    expect(totalPayable(ROWS)).toBe(13587)
  })

  it('an uncalculated row contributes nothing — not its agent_amount', () => {
    expect(totalPayable(ROWS)).not.toBe(13587 + 13650)
  })

  it('counts what is still waiting on the calculation', () => {
    expect(pendingCalculationCount(ROWS)).toBe(1)
    expect(pendingCalculationCount([])).toBe(0)
    expect(pendingCalculationCount([{ net_commission: 1 }])).toBe(0)
  })

  it('an empty list totals zero', () => {
    expect(totalPayable([])).toBe(0)
  })
})

describe('formatPayable', () => {
  it('formats a calculated figure with thousands separators', () => {
    expect(formatPayable({ net_commission: 8193.5 })).toBe('$8,193.5')
  })
  it('labels an uncalculated row', () => {
    expect(formatPayable({ net_commission: null })).toBe(
      PENDING_CALCULATION_LABEL
    )
  })
})

// ── COMMISSION-REFERRAL-CANONICAL-1 ──────────────────────────────────
describe('referralDeduction', () => {
  it('returns the referral taken off the gross', () => {
    expect(referralDeduction({ referral_fee_amount: 3000 })).toBe(3000)
  })

  it('accepts a numeric column that arrives as a string', () => {
    expect(referralDeduction({ referral_fee_amount: '3000.00' })).toBe(3000)
  })

  it('returns null when there is no referral', () => {
    expect(referralDeduction({ referral_fee_amount: null })).toBeNull()
    expect(referralDeduction({ referral_fee_amount: 0 })).toBeNull()
    expect(referralDeduction({})).toBeNull()
    expect(referralDeduction(null)).toBeNull()
  })

  it('never presents a negative as a deduction', () => {
    // A stored negative is data we cannot explain; showing "-$-500" would
    // misstate the agent's own figure.
    expect(referralDeduction({ referral_fee_amount: -500 })).toBeNull()
  })

  it('returns null rather than NaN on an unparseable value', () => {
    expect(referralDeduction({ referral_fee_amount: 'n/a' })).toBeNull()
    expect(referralDeduction({ referral_fee_amount: Number.NaN })).toBeNull()
  })

  it('is independent of the payable amount', () => {
    // An uncalculated commission can still carry a referral the create path
    // recorded, and a calculated one can carry none.
    const pending = { net_commission: null, referral_fee_amount: 3000 }
    expect(payableAmount(pending)).toBeNull()
    expect(referralDeduction(pending)).toBe(3000)

    const noReferral = { net_commission: 8193.5, referral_fee_amount: null }
    expect(payableAmount(noReferral)).toBe(8193.5)
    expect(referralDeduction(noReferral)).toBeNull()
  })

  it('the referral is NOT subtracted again from the payable total', () => {
    // net_commission is already net of the referral. Double-counting here
    // would understate what the agent is owed.
    const rows = [{ net_commission: 6093.5, referral_fee_amount: 3000 }]
    expect(totalPayable(rows)).toBe(6093.5)
    expect(totalPayable(rows)).not.toBe(6093.5 - 3000)
  })
})
