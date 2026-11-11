// ============================================================================
// DEAL-DISPO-AGENTS — Deal Opportunities, MOUNTED and CLICKED (jest)
// ============================================================================
// Vault decides who may see what; these tests pin that the Portal renders what
// Vault hands it, sends nothing Vault would have to trust, cannot submit an
// offer twice from one tap, and shows a denied agent a refusal, not data.
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('@/lib/supabase', () => ({ authFetch: jest.fn() }))
import { authFetch } from '@/lib/supabase'
const mockFetch = authFetch as jest.Mock

import DealOpportunities, { agentActionsFor } from '@/src/portal/deal-opportunities/DealOpportunities'
import { NAV_ITEMS } from '@/src/portal/nav-config'
import { linkTargetFor } from '@/src/portal/notifications/notifications-helpers'

const AID = '0b7c6a52-0e4e-4d1b-9a55-1c9a6f1c2a11'
const deal = {
  dealId: 'd1', status: 'active', askingPriceCents: 25000000, propertyType: 'land',
  opportunityTags: [], headline: 'Buildable lot', buyerDescription: 'Level 1.3 acre lot.',
  beds: null, baths: null, sqft: null, lotSizeSqft: 58806, units: null, yearBuilt: null, dealTerms: 'Cash, 21-day close',
}
const summary = (stage = 'published') => ({
  assignmentId: AID, stage, publishedAt: '2026-11-11T12:00:00Z', deal,
  location: { city: 'Denville Township', region: 'NJ', street: null },
})
// jsdom here has no global Response; the client reads only ok/status/text().
const ok = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, text: async () => JSON.stringify(body) })

let stage = 'published'
let events: Array<Record<string, unknown>> = []
const posts: Array<{ url: string; body: any }> = []

function vault(opts: { listStatus?: number; listCode?: string; postDelay?: boolean } = {}) {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      posts.push({ url, body })
      const next: Record<string, string> = { interest: 'interested', offer: 'offer_submitted', pass: 'passed' }
      if (next[body.action]) stage = next[body.action]
      events.push({ id: String(events.length), party: 'agent', kind: body.action, amountCents: body.amountCents ?? null, message: body.message ?? null, createdAt: '2026-11-11T13:00:00Z' })
      const respond = () => ok({ kind: 'ok', stage }, 201)
      return opts.postDelay ? new Promise((r) => setTimeout(() => r(respond()), 30)) : respond()
    }
    if (url.endsWith('/agent-opportunities')) {
      if (opts.listStatus) return ok({ error: 'x', code: opts.listCode }, opts.listStatus)
      return ok({ opportunities: [summary(stage)] })
    }
    return ok({ opportunity: { ...summary(stage), events } })
  })
}

beforeEach(() => {
  mockFetch.mockReset(); posts.length = 0; stage = 'published'; events = []
})

describe('entry points', () => {
  it('the nav carries Deal Opportunities, agent-visible, right after Developer Opportunities', () => {
    const labels = NAV_ITEMS.map((i) => i.label)
    expect(labels.indexOf('Deal Opportunities')).toBe(labels.indexOf('Developer Opportunities') + 1)
    const item = NAV_ITEMS.find((i) => i.id === 'deal-opportunities')!
    expect(item.href).toBe('/deal-opportunities')
    expect(item.brokerOnly).toBeUndefined()
  })
  it("the bell row Vault writes on publish deep-links into this page", () => {
    expect(linkTargetFor({
      id: 'n', user_id: 'u', type: 'reminder', title: 't', body: 'b', read_at: null, created_at: '',
      action_url: `/deal-opportunities?id=${AID}`, related_type: 'dispo_opportunity', related_id: AID,
    } as any)).toBe(`/deal-opportunities?id=${AID}`)
  })
})

describe('an assigned agent', () => {
  it('sees the list, opens the deal, and the buyer package — no internal numbers — renders', async () => {
    vault()
    render(<DealOpportunities />)
    const card = await screen.findByTestId(`deal-opp-${AID}`)
    expect(card).toHaveTextContent('Buildable lot')
    expect(card).toHaveTextContent('Denville Township, NJ')
    expect(card).toHaveTextContent('Asking $250,000')
    fireEvent.click(card)
    expect(await screen.findByTestId('deal-opp-detail')).toHaveTextContent('Cash, 21-day close')
    expect(screen.getByTestId('deal-opp-stage')).toHaveTextContent('NEW')
    expect(screen.getByTestId('deal-opp-interest')).toBeEnabled()
    expect(screen.getByTestId('deal-opp-offer')).toBeEnabled()
  })

  it('submits an offer in cents with a clientRef; the stage and history update; no second offer is offered', async () => {
    vault()
    render(<DealOpportunities initialId={AID} />)
    await screen.findByTestId('deal-opp-detail')
    fireEvent.change(screen.getByTestId('deal-opp-amount'), { target: { value: '$240,000' } })
    fireEvent.change(screen.getByTestId('deal-opp-message'), { target: { value: 'My buyer is cash' } })
    fireEvent.click(screen.getByTestId('deal-opp-offer'))
    await waitFor(() => expect(screen.getByTestId('deal-opp-note')).toHaveTextContent('Offer sent to your broker.'))
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toMatch(new RegExp(`/dispo/agent-opportunities/${AID}$`))
    expect(posts[0].body).toEqual({
      action: 'offer', amountCents: 24000000, message: 'My buyer is cash', clientRef: expect.stringMatching(/^[A-Za-z0-9_-]{8,}$/),
    })
    // 🔒 nothing Vault would have to trust
    for (const k of ['tenantId', 'agentId', 'dealId', 'stage', 'tenant_id', 'agent_id']) expect(posts[0].body).not.toHaveProperty(k)
    await waitFor(() => expect(screen.getByTestId('deal-opp-stage')).toHaveTextContent('OFFER SENT'))
    expect(screen.queryByTestId('deal-opp-offer')).toBeNull()
    expect(screen.getByTestId('deal-opp-pending')).toBeInTheDocument()
    expect(screen.getByTestId('deal-opp-thread')).toHaveTextContent('Your offer · $240,000')
  })

  it('a double tap sends ONE offer', async () => {
    vault({ postDelay: true })
    render(<DealOpportunities initialId={AID} />)
    await screen.findByTestId('deal-opp-detail')
    fireEvent.change(screen.getByTestId('deal-opp-amount'), { target: { value: '100000' } })
    const btn = screen.getByTestId('deal-opp-offer')
    fireEvent.click(btn); fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('deal-opp-note')).toBeInTheDocument())
    expect(posts.filter((p) => p.body.action === 'offer')).toHaveLength(1)
  })

  it('an empty offer or empty question is stopped on the page, not sent', async () => {
    vault()
    render(<DealOpportunities initialId={AID} />)
    await screen.findByTestId('deal-opp-detail')
    fireEvent.click(screen.getByTestId('deal-opp-offer'))
    expect(await screen.findByTestId('deal-opp-note')).toHaveTextContent('greater than zero')
    fireEvent.click(screen.getByTestId('deal-opp-inquiry'))
    expect(await screen.findByTestId('deal-opp-note')).toHaveTextContent('Write your question first')
    expect(posts).toHaveLength(0)
  })
})

describe('a denied agent', () => {
  it('an unlicensed agent sees the refusal, not data', async () => {
    vault({ listStatus: 403, listCode: 'license_not_verified' })
    render(<DealOpportunities />)
    expect(await screen.findByTestId('deal-opps-error')).toHaveTextContent('licence has not been verified')
    expect(screen.queryByTestId('deal-opps-list')).toBeNull()
  })
  it('an opportunity not assigned to them (Vault 404) shows "no longer available"', async () => {
    mockFetch.mockImplementation(() => ok({ error: 'not_found' }, 404))
    render(<DealOpportunities initialId={AID} />)
    expect(await screen.findByTestId('deal-opp-error')).toHaveTextContent('no longer available')
    expect(screen.queryByTestId('deal-opp-respond')).toBeNull()
  })
  it('a broker opening the agent page is told where they work instead', async () => {
    vault({ listStatus: 403, listCode: 'role_not_entitled' })
    render(<DealOpportunities />)
    expect(await screen.findByTestId('deal-opps-error')).toHaveTextContent('Brokers manage and publish deals in Vault')
  })
  it('nothing assigned → the empty state', async () => {
    mockFetch.mockImplementation(() => ok({ opportunities: [] }))
    render(<DealOpportunities />)
    expect(await screen.findByTestId('deal-opps-empty')).toBeInTheDocument()
  })
})

describe('the rules come from Vault', () => {
  it('terminal stages offer no action', () => {
    for (const s of ['accepted', 'declined', 'passed']) expect(agentActionsFor(s)).toEqual([])
    expect(agentActionsFor('offer_submitted')).toEqual(['inquiry', 'pass'])
    expect(agentActionsFor('negotiating')).toEqual(['offer', 'inquiry', 'pass'])
  })
  it('the Portal never reads a dispo table itself', () => {
    const src = readFileSync(join(process.cwd(), 'src/portal/deal-opportunities/DealOpportunities.tsx'), 'utf8')
      + readFileSync(join(process.cwd(), 'lib/deal-opportunities/vault-deal-opportunities-client.ts'), 'utf8')
    expect(src).not.toMatch(/\.from\(\s*['"]dispo_/)
    expect(src).not.toMatch(/createClient|supabase\.from/)
  })
})
