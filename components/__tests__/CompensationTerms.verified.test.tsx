// ============================================================================
// FEE-NO-ASSUME-1 (Portal side) — profile defaults are not "Your Compensation"
// ============================================================================
// Vault /api/agents/me/compensation returns `terms_verified: false` and
// `terms_notice` when no verified executed agreement is on file; the plan is
// then profile defaults ($295 fee / $25,000 cap / tier split). Those figures
// must not render as the agent's terms. Verified → the signed figures, plus
// the signed post-threshold agent %.
// ============================================================================
import { render, screen } from '@testing-library/react'
import CompensationTerms, {
  TERMS_BEING_VERIFIED_FALLBACK,
  type CompensationPlan,
  type SignedTerms,
} from '@/components/CompensationTerms'

const VAULT_NOTICE =
  'No verified signed compensation agreement is on file. These are profile defaults, not your agreement — no commission is calculated until your signed terms are recorded.'

const defaultsPlan: CompensationPlan = {
  tier: 'standard',
  tierLabel: 'Standard',
  agentSplitPct: 80,
  brokerageSplitPct: 20,
  transactionFee: 295,
  annualCap: 25000,
  splitSource: 'tier',
  waiver: { monthsTotal: null, lastWaivedMonth: null, source: 'none', activeThisMonth: false, billingStartsMonth: null },
}

const signed: SignedTerms = {
  planVersion: 'v1',
  agentSplitPct: 85,
  annualThreshold: 18000,
  postThresholdAgentPct: 100,
  transactionFee: 395,
  leaseFee: null,
  effectiveFrom: '2026-06-01',
}
const signedPlan: CompensationPlan = {
  ...defaultsPlan,
  agentSplitPct: 85,
  brokerageSplitPct: 15,
  transactionFee: 395,
  annualCap: 18000,
  splitSource: 'signed_terms',
}

const capProgress = {
  cap_year: 2026, annual_cap: 25000, total_contributed: 1000, remaining_to_cap: 24000,
  cap_reached: false, progress_pct: 4, source: 'x',
}

function expectNoDefaultFigures() {
  const text = document.body.textContent || ''
  expect(text).not.toMatch(/\$295/)
  expect(text).not.toMatch(/\$25,000/)
  expect(text).not.toMatch(/80%/)
  expect(screen.queryByText('Your split')).toBeNull()
  expect(screen.queryByText('Transaction fee')).toBeNull()
  expect(screen.queryByText('Annual cap')).toBeNull()
}

describe('CompensationTerms — unverified terms', () => {
  it('terms_verified false → Vault notice shown, no $295 / $25,000 / 80% figures', () => {
    render(
      <CompensationTerms plan={defaultsPlan} capProgress={capProgress} termsVerified={false} termsNotice={VAULT_NOTICE} />,
    )
    expect(screen.getByRole('region', { name: /your compensation terms/i })).toBeInTheDocument()
    expect(screen.getByTestId('terms-unverified')).toHaveTextContent(VAULT_NOTICE)
    expect(screen.getByText(/being verified by the Broker of Record/i)).toBeInTheDocument()
    expectNoDefaultFigures()
  })

  it('terms_verified MISSING (older payload) → treated as unverified, fallback notice', () => {
    render(<CompensationTerms plan={defaultsPlan} capProgress={capProgress} />)
    expect(screen.getByTestId('terms-unverified')).toHaveTextContent(TERMS_BEING_VERIFIED_FALLBACK)
    expectNoDefaultFigures()
  })
})

describe('CompensationTerms — verified signed terms', () => {
  it('renders the signed split, fee, cap and post-threshold agent %', () => {
    render(
      <CompensationTerms plan={signedPlan} capProgress={capProgress} termsVerified signedTerms={signed} termsNotice={null} />,
    )
    expect(screen.queryByTestId('terms-unverified')).toBeNull()
    expect(screen.getByText('85% / 15%')).toBeInTheDocument()
    expect(screen.getByText('$395')).toBeInTheDocument()
    expect(screen.getByText('$18,000')).toBeInTheDocument()
    expect(screen.getByText('After cap')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByTestId('signed-terms-source')).toHaveTextContent('plan v1')
    expect(document.body.textContent).not.toMatch(/\$295/)
  })
})
