// ============================================================================
// FINSEC closeout (P1) — financial pages never present invented or default
// terms as the agent's own. RTL renders of the real pages:
//   /commissions            — terms_verified gates the "Your Compensation" figures
//   /commission-calculator  — no hardcoded 80% / $295 presented as the agent's
//   /dashboard              — "Payable to You" is net_commission, never agent_amount
// ============================================================================
import { render, screen, waitFor, within } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockAuthFetch = authFetch as jest.Mock

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
const auth = {
  user: { id: 'agent-1', email: 'a@x.test', user_metadata: {} },
  role: 'agent',
  loading: false,
  signOut: jest.fn(),
  trainingGate: { gateOpen: false, vol2: { done: true, completed: [], total: 0 } },
}
jest.mock('@/app/providers', () => ({ useAuth: () => auth }))
jest.mock('../../providers', () => ({ useAuth: () => auth }))

// Dashboard chrome that is not under test.
jest.mock('@/app/components/SidebarNav', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/components/NotificationsPanel', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/components/TrainingGate', () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }))
jest.mock('@/app/components/compliance-notifications', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/SupportModal', () => ({ __esModule: true, default: () => null }))

import CommissionsPage from '@/app/commissions/page'
import CommissionCalculatorPage from '@/app/commission-calculator/page'
import DashboardPage from '@/app/dashboard/page'

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

const DEFAULT_PLAN = {
  tier: 'standard', tierLabel: 'Standard', agentSplitPct: 80, brokerageSplitPct: 20,
  transactionFee: 295, annualCap: 25000, splitSource: 'tier',
  waiver: { monthsTotal: null, lastWaivedMonth: null, source: 'none', activeThisMonth: false, billingStartsMonth: null },
}
const NOTICE = 'No verified signed compensation agreement is on file. These are profile defaults, not your agreement.'
const UNVERIFIED = { plan: DEFAULT_PLAN, capProgress: null, cap: null, terms_verified: false, signed_terms: null, terms_notice: NOTICE }
const VERIFIED = {
  plan: { ...DEFAULT_PLAN, agentSplitPct: 85, brokerageSplitPct: 15, transactionFee: 395, annualCap: 18000, splitSource: 'signed_terms' },
  capProgress: null,
  cap: null,
  terms_verified: true,
  terms_notice: null,
  signed_terms: { planVersion: 'v1', agentSplitPct: 85, annualThreshold: 18000, postThresholdAgentPct: 100, transactionFee: 395, leaseFee: null, effectiveFrom: '2026-06-01' },
}

function route(compensation: unknown, extra: Record<string, unknown> = {}) {
  mockAuthFetch.mockImplementation(async (url: string) => {
    if (url.includes('/api/vault/compensation')) return ok(compensation)
    if (url.includes('/api/vault/commissions')) return ok({ commissions: [] })
    for (const [k, v] of Object.entries(extra)) if (url.includes(k)) return ok(v)
    return ok({})
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn(async () => ok({})) as unknown as typeof fetch
})

describe('/commissions — Your Compensation', () => {
  it('unverified terms → notice shown; no $295 / $25,000 / 80% figures', async () => {
    route(UNVERIFIED)
    render(<CommissionsPage />)
    const region = await screen.findByRole('region', { name: /your compensation terms/i })
    await waitFor(() => expect(within(region).getByTestId('terms-unverified')).toHaveTextContent(NOTICE))
    expect(region.textContent).not.toMatch(/\$295|\$25,000|80%/)
  })

  it('verified terms → the signed figures, including the post-threshold %', async () => {
    route(VERIFIED)
    render(<CommissionsPage />)
    const region = await screen.findByRole('region', { name: /your compensation terms/i })
    await waitFor(() => expect(within(region).getByText('85% / 15%')).toBeInTheDocument())
    expect(within(region).getByText('$395')).toBeInTheDocument()
    expect(within(region).getByText('After cap')).toBeInTheDocument()
    expect(within(region).getByText('100%')).toBeInTheDocument()
    expect(region.textContent).not.toMatch(/\$295/)
  })
})

describe('/commission-calculator — no invented terms presented as the agent\'s', () => {
  it('unverified → split and fee start empty, results labelled illustrative, no $295 / 80%', async () => {
    route(UNVERIFIED)
    render(<CommissionCalculatorPage />)
    await waitFor(() => expect(screen.getByTestId('calc-terms-basis')).toHaveTextContent(/Illustrative estimate only/))
    expect(screen.getByTestId('calc-terms-basis')).toHaveTextContent(NOTICE)
    expect(screen.getByLabelText('Brokerage split percent')).toHaveValue(null)
    expect(screen.getByLabelText('Transaction fee')).toHaveValue(null)
    expect(screen.getByText(/Illustrative Estimate — not your terms/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\$295|80%/)
    expect(screen.queryByText(/Your Split/)).toBeNull()
    // The action is still there and enabled.
    expect(screen.getByRole('button', { name: /Calculate with Vault/i })).toBeEnabled()
  })

  it('verified → prefilled from the signed agreement and labelled as such', async () => {
    route(VERIFIED)
    render(<CommissionCalculatorPage />)
    await waitFor(() => expect(screen.getByLabelText('Brokerage split percent')).toHaveValue(85))
    expect(screen.getByLabelText('Transaction fee')).toHaveValue(395)
    expect(screen.getByTestId('calc-terms-basis')).toHaveTextContent(/signed agreement \(plan v1\)/)
    expect(screen.getByText(/Estimated Net Commission \(your signed terms\)/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\$295/)
  })

  it('compensation unreachable → unverified wording, never a default', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    render(<CommissionCalculatorPage />)
    await waitFor(() => expect(screen.getByTestId('calc-terms-basis')).toHaveTextContent(/not your compensation terms/))
    expect(screen.getByLabelText('Transaction fee')).toHaveValue(null)
  })
})

describe('/dashboard — payable figure', () => {
  // NOTE: app/dashboard/page.tsx defines fetchData but never calls it
  // (pre-existing), so in the running app these tiles receive no commission
  // rows. What an agent sees is therefore the empty state, and it must not
  // present a figure. The payable arithmetic itself is lib/commissionPayable
  // (covered by its own suite).
  it('no commission data → "Payable to You" shows no figure; Volume has no invented $500K/deal', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Payable to You')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-payable')).toHaveTextContent('—')
    expect(screen.queryByText('Net Earned')).toBeNull()
    expect(screen.getByText('Volume').nextSibling).toHaveTextContent('—')
    expect(document.body.textContent).not.toMatch(/After splits & fees/)
  })
})
