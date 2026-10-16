/**
 * HARTFELT-CAP-DASHBOARD-FINAL-1 — projected vs actual, in the Agent Portal.
 *
 * This component used to render Vault's PROJECTED balance as
 * "{x} contributed", which presents a forecast as earned money. Only a
 * broker-verified commission receipt credits the cap. Every figure here is
 * Vault's — the Portal does no cap arithmetic — so these tests check what is
 * SHOWN and, just as importantly, what is never substituted.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import CompensationTerms, {
  type CapBlock,
  type CapProgress,
  type CompensationPlan,
} from '../CompensationTerms'

// Same shape the sibling suite uses, so a plan-field change breaks both
// together rather than leaving this one silently rendering a partial plan.
const plan: CompensationPlan = {
  tier: 'standard',
  tierLabel: 'Standard Agent',
  agentSplitPct: 70,
  brokerageSplitPct: 30,
  transactionFee: 295,
  annualCap: 25000,
  waiver: {
    monthsTotal: 3,
    lastWaivedMonth: '2026-08-01',
    source: 'stored',
    activeThisMonth: false,
    billingStartsMonth: '2026-09-01',
  },
}

const capBlock = (o: Partial<CapBlock> = {}): CapBlock => ({
  cap_year: 2026,
  annual_cap: 25000,
  verified_contributions: 0,
  remaining_annual_cap: 25000,
  projected_contributions: 13050,
  projected_not_yet_credited: 13050,
  cap_reached_actual: false,
  awaiting_verification_count: 0,
  awaiting_verification_amount: 0,
  last_verified_at: null,
  actual_unavailable: false,
  ...o,
})

const legacyProgress: CapProgress = {
  cap_year: 2026, annual_cap: 25000, total_contributed: 13050,
  remaining_to_cap: 11950, cap_reached: false, progress_pct: 52.2, source: 'ledger',
}

describe('the historical $13,050 is projected, never earned', () => {
  it('shows verified $0 and the full $25,000 remaining', () => {
    render(<CompensationTerms plan={plan} capProgress={null} cap={capBlock()} error={null} />)
    expect(screen.getByTestId('cap-verified')).toHaveTextContent('$0')
    expect(screen.getByTestId('cap-remaining')).toHaveTextContent('$25,000')
    expect(screen.getByTestId('cap-projected')).toHaveTextContent('$13,050')
  })

  it('uses the mandated labels, and never calls projected money "contributed"', () => {
    render(<CompensationTerms plan={plan} capProgress={null} cap={capBlock()} error={null} />)
    expect(screen.getByText(/Verified Cap Contributions/i)).toBeInTheDocument()
    expect(screen.getByText(/Remaining Annual Cap/i)).toBeInTheDocument()
    expect(screen.getByText(/Projected — Not Yet Credited/i)).toBeInTheDocument()
    expect(screen.getByText(/Awaiting Receipt Verification/i)).toBeInTheDocument()
    expect(screen.queryByText(/13,050 contributed/i)).not.toBeInTheDocument()
  })

  it('the progress bar tracks VERIFIED money, so it is empty at zero', () => {
    render(<CompensationTerms plan={plan} capProgress={null} cap={capBlock()} error={null} />)
    expect(screen.getByTestId('cap-bar')).toHaveStyle({ width: '0%' })
  })
})

describe('partial receipts and reversals', () => {
  it('a partial verified receipt moves verified and remaining only', () => {
    render(
      <CompensationTerms
        plan={plan} capProgress={null}
        cap={capBlock({
          verified_contributions: 1800, remaining_annual_cap: 23200,
          projected_not_yet_credited: 11250,
        })}
        error={null}
      />,
    )
    expect(screen.getByTestId('cap-verified')).toHaveTextContent('$1,800')
    expect(screen.getByTestId('cap-remaining')).toHaveTextContent('$23,200')
    expect(screen.getByTestId('cap-projected')).toHaveTextContent('$11,250')
    // 1800 / 25000 = 7.2%
    expect(screen.getByTestId('cap-bar')).toHaveStyle({ width: '7.2%' })
  })

  it('shows what is awaiting broker verification', () => {
    render(
      <CompensationTerms
        plan={plan} capProgress={null}
        cap={capBlock({ awaiting_verification_count: 2, awaiting_verification_amount: 4200 })}
        error={null}
      />,
    )
    expect(screen.getByTestId('cap-awaiting')).toHaveTextContent('$4,200')
    expect(screen.getByText(/2 receipts with your broker/i)).toBeInTheDocument()
  })

  it('reports the cap met only when verified receipts reach it', () => {
    render(
      <CompensationTerms
        plan={plan} capProgress={null}
        cap={capBlock({
          verified_contributions: 25000, remaining_annual_cap: 0,
          cap_reached_actual: true, projected_not_yet_credited: 0,
        })}
        error={null}
      />,
    )
    expect(screen.getByTestId('cap-bar')).toHaveClass('bg-green-500')
    expect(screen.getByTestId('cap-remaining')).toHaveTextContent('$0')
  })

  it('a huge PROJECTED balance never turns the bar green or fills it', () => {
    render(
      <CompensationTerms
        plan={plan} capProgress={null}
        cap={capBlock({ projected_contributions: 90000, projected_not_yet_credited: 90000 })}
        error={null}
      />,
    )
    expect(screen.getByTestId('cap-bar')).not.toHaveClass('bg-green-500')
    expect(screen.getByTestId('cap-bar')).toHaveStyle({ width: '0%' })
  })
})

describe('a failed verified read NEVER falls back to projected', () => {
  it('shows an explicit notice and no verified figure', () => {
    render(
      <CompensationTerms
        plan={plan} capProgress={null}
        cap={capBlock({
          verified_contributions: null, remaining_annual_cap: null,
          cap_reached_actual: null, projected_not_yet_credited: null,
          actual_unavailable: true,
        })}
        error={null}
      />,
    )
    expect(screen.getByTestId('cap-unavailable')).toBeInTheDocument()
    expect(screen.getByTestId('cap-verified')).toHaveTextContent('—')
    expect(screen.getByTestId('cap-remaining')).toHaveTextContent('—')
    // The projected figure is still shown, but in the PROJECTED slot only.
    expect(screen.getByTestId('cap-projected')).toHaveTextContent('$13,050')
    expect(screen.getByTestId('cap-verified')).not.toHaveTextContent('13,050')
    expect(screen.getByTestId('cap-bar')).toHaveStyle({ width: '0%' })
  })
})

describe('an older Vault response without the cap block', () => {
  it('labels the projected figure as projected, not as contributed', () => {
    render(<CompensationTerms plan={plan} capProgress={legacyProgress} cap={null} error={null} />)
    expect(screen.getByText(/\$13,050 projected/i)).toBeInTheDocument()
    expect(screen.getByText(/Forecast only/i)).toBeInTheDocument()
    expect(screen.queryByText(/13,050 contributed/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('cap-verified')).not.toBeInTheDocument()
  })

  it('renders nothing cap-related when Vault sent neither', () => {
    render(<CompensationTerms plan={plan} capProgress={null} cap={null} error={null} />)
    expect(screen.queryByTestId('cap-bar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cap-block')).not.toBeInTheDocument()
  })
})
