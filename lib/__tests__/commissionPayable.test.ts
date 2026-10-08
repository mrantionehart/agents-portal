// ============================================================================
// COMMISSION-CANONICAL-FORMULA-1 — the Portal's payable-amount rule
// ============================================================================
import {
  payableAmount,
  totalPayable,
  pendingCalculationCount,
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
