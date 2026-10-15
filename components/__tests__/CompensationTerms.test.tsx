import React from 'react'
import { render, screen } from '@testing-library/react'
import CompensationTerms, {
  type CompensationPlan,
  type CapProgress,
} from '../CompensationTerms'

const plan = (over: Partial<CompensationPlan> = {}): CompensationPlan => ({
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
  ...over,
})

const cap = (over: Partial<CapProgress> = {}): CapProgress => ({
  cap_year: 2026,
  annual_cap: 25000,
  total_contributed: 10000,
  remaining_to_cap: 15000,
  cap_reached: false,
  progress_pct: 40,
  source: 'ledger',
  ...over,
})

describe('HFOS-P1 — CompensationTerms', () => {
  it('shows the standard tier with its split, fee and cap', () => {
    render(<CompensationTerms plan={plan()} capProgress={cap()} />)
    expect(screen.getByTestId('tier-badge')).toHaveTextContent('Standard Agent')
    expect(screen.getByText('70% / 30%')).toBeInTheDocument()
    expect(screen.getByText('$295')).toBeInTheDocument()
    expect(screen.getByText('$25,000')).toBeInTheDocument()
  })

  it('shows the FOUNDING tier distinctly', () => {
    render(
      <CompensationTerms
        plan={plan({ tier: 'founding', tierLabel: 'Founding Agent', agentSplitPct: 75, brokerageSplitPct: 25 })}
        capProgress={cap()}
      />,
    )
    expect(screen.getByTestId('tier-badge')).toHaveTextContent('Founding Agent')
    expect(screen.getByText('75% / 25%')).toBeInTheDocument()
    // anti-vacuity: the standard split must NOT also be on screen
    expect(screen.queryByText('70% / 30%')).toBeNull()
  })

  it('renders the fee and cap Vault sent, not the familiar defaults', () => {
    render(
      <CompensationTerms
        plan={plan({ transactionFee: 0, annualCap: 30000 })}
        capProgress={cap({ annual_cap: 30000 })}
      />,
    )
    // a waived $0 fee must read as $0 — never silently "$295"
    expect(screen.getByText('$0')).toBeInTheDocument()
    expect(screen.queryByText('$295')).toBeNull()
    expect(screen.getByText('$30,000')).toBeInTheDocument()
  })

  it("uses VAULT's progress_pct for the bar — it does not recompute a ratio", () => {
    // Deliberately inconsistent: 10000/25000 would be 40%, Vault says 88%.
    // The component must trust Vault; a second calculation is a second answer.
    render(
      <CompensationTerms
        plan={plan()}
        capProgress={cap({ total_contributed: 10000, annual_cap: 25000, progress_pct: 88 })}
      />,
    )
    expect(screen.getByTestId('cap-bar')).toHaveStyle({ width: '88%' })
  })

  it('treats an uncapped (null) progress_pct as empty, not full', () => {
    render(<CompensationTerms plan={plan()} capProgress={cap({ progress_pct: null })} />)
    expect(screen.getByTestId('cap-bar')).toHaveStyle({ width: '0%' })
  })

  it('reports an active waiver and an ended one differently', () => {
    const { unmount } = render(
      <CompensationTerms
        plan={plan({ waiver: { ...plan().waiver, activeThisMonth: true } })}
        capProgress={cap()}
      />,
    )
    expect(screen.getByText('Active')).toBeInTheDocument()
    unmount()
    render(<CompensationTerms plan={plan()} capProgress={cap()} />)
    expect(screen.getByText('Ended')).toBeInTheDocument()
  })

  it('shows the error and NO figures when Vault could not be read', () => {
    render(<CompensationTerms plan={null} capProgress={null} error="Session expired." />)
    expect(screen.getByText('Session expired.')).toBeInTheDocument()
    expect(screen.queryByTestId('tier-badge')).toBeNull()
    expect(screen.queryByText('$295')).toBeNull()
  })

  it('renders nothing at all rather than a placeholder plan', () => {
    const { container } = render(<CompensationTerms plan={null} capProgress={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('HFOF-P1 — custom split overrides', () => {
  it('marks a broker-authorized custom split and shows the effective figures', () => {
    render(
      <CompensationTerms
        plan={plan({ agentSplitPct: 85, brokerageSplitPct: 15, splitSource: 'override' })}
        capProgress={cap()}
      />,
    )
    expect(screen.getByTestId('override-badge')).toHaveTextContent('Custom split')
    expect(screen.getByText('85% / 15%')).toBeInTheDocument()
    // the tier badge stays — the agent is still a Standard Agent on a custom split
    expect(screen.getByTestId('tier-badge')).toHaveTextContent('Standard Agent')
    expect(screen.queryByTestId('override-pending')).toBeNull()
  })

  it('shows no custom marker on the ordinary tier path', () => {
    render(<CompensationTerms plan={plan({ splitSource: 'tier' })} capProgress={cap()} />)
    expect(screen.queryByTestId('override-badge')).toBeNull()
    expect(screen.getByText('70% / 30%')).toBeInTheDocument()
  })

  it('states an UNAUTHORIZED override instead of displaying it as in force', () => {
    render(
      <CompensationTerms
        plan={plan({ splitSource: 'tier', splitOverrideRefusal: 'not_authorized', splitRequestedPct: 100 })}
        capProgress={cap()}
      />,
    )
    const pending = screen.getByTestId('override-pending')
    expect(pending).toHaveTextContent('100%')
    expect(pending).toHaveTextContent('has not been')
    // the figure shown as effective is still the tier rate, never the request
    expect(screen.getByText('70% / 30%')).toBeInTheDocument()
    expect(screen.queryByText('100% / 0%')).toBeNull()
    expect(screen.queryByTestId('override-badge')).toBeNull()
  })

  it('says nothing about overrides when there is no request at all', () => {
    render(<CompensationTerms plan={plan()} capProgress={cap()} />)
    expect(screen.queryByTestId('override-pending')).toBeNull()
    expect(screen.queryByTestId('override-badge')).toBeNull()
  })
})
