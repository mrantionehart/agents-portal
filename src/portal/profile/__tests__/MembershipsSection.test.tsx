/**
 * MDC-1 — My Memberships & MLS, mounted (jest + RTL, synthetic data).
 * Entry point visible, nonmember election submits as a declaration (no block,
 * no termination language), uploads go to the evidence forwarder with the
 * record id and never an agent/tenant id, a disclosure is acknowledged, a
 * refused caller sees nothing, and flag-off makes no request at all.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

let mockFlag = true
jest.mock('../membership-flag', () => ({ membershipSectionEnabled: () => mockFlag }))

import MembershipsSection from '../MembershipsSection'

const VIEW = {
  memberships: [{ id: 'm1', association_name: 'Synthetic Association', declared_status: 'active', is_primary: true, verified_status: null, declared_renewal_date: '2027-01-31', renewal_date: null, renewal_date_verified: false, record_state: 'agent_submitted' }],
  mls_subscriptions: [{ id: 's1', mls_provider: 'Synthetic MLS', declared_status: 'active', verified_status: 'active', renewal_date: '2027-03-01' }],
  documentation_requests: [{ id: 'r1', description: 'Upload your renewal receipt', due_date: '2026-12-15' }],
  disclosures: [{ id: 'd1', disclosure_text: 'Synthetic disclosure text.', outcome: 'amount_pending_verification', amount_cents: null, agent_acknowledged_at: null }],
  policies: [{ key: 'membership_optional', title: 'Association membership is optional', summary: 'Synthetic summary' }],
  statuses: { brokerage_affiliation: 'affiliated', association_membership: 'nonmember', mls_access: 'active' },
  addendum: { title: 'Association Membership & Financial Responsibility Addendum', version: '2026-11-17-draft', released: false, executed: false },
  reimbursement_notices: [
    { id: 'n1', issuing_association: 'Synthetic Association', amount_cents: 61500, fiscal_period: '2027', rule_basis: 'Bylaws Art. X §3', calculation_method: '1 x DR dues',
      reimbursement_stage: 'noticed', objection_deadline: '2026-12-03T04:59:59.999Z' },
  ],
}

const fetchMock = jest.fn()
beforeEach(() => {
  mockFlag = true
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/profile/memberships' && (!init || !init.method || init.method === 'GET')) return { ok: true, json: async () => VIEW }
    return { ok: true, json: async () => ({ ok: true }) }
  })
  ;(global as any).fetch = fetchMock
})

const posts = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')

describe('MembershipsSection', () => {
  it('renders the section with the agent’s own records, requests, disclosure and policies', async () => {
    render(<MembershipsSection />)
    expect(await screen.findByRole('region', { name: 'My Memberships & MLS' })).toBeInTheDocument()
    expect(screen.getByText('MY MEMBERSHIPS & MLS')).toBeInTheDocument()
    expect(screen.getByText('Synthetic Association')).toBeInTheDocument()
    expect(screen.getByText('Submitted by you — awaiting review')).toBeInTheDocument()
    expect(screen.getByText(/your entry, not verified/)).toBeInTheDocument()
    expect(screen.getByText('Synthetic MLS')).toBeInTheDocument()
    expect(screen.getByText(/Upload your renewal receipt/)).toBeInTheDocument()
    expect(screen.getByText(/amount not yet known/)).toBeInTheDocument()
    expect(screen.getByText(/Association membership is optional/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit declaration/ })).toBeEnabled()
  })

  it('nonmember election submits a declaration only — no block, no termination language', async () => {
    render(<MembershipsSection />)
    fireEvent.click(await screen.findByLabelText('I am not currently a REALTOR® association member.'))
    expect(within(screen.getByRole('group', { name: 'Declare or report a change' })).queryByText(/terminat|deduct|blocked/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Submit declaration/ }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    const [url, init] = posts()[0]
    expect(url).toBe('/api/profile/memberships')
    expect(JSON.parse(init.body)).toEqual({ kind: 'membership', declared_status: 'nonmember', association_name: null })
    expect(await screen.findByRole('status')).toHaveTextContent('Declaration submitted for review.')
  })

  it('member declaration carries declaration fields only', async () => {
    render(<MembershipsSection />)
    fireEvent.change(await screen.findByLabelText('Association'), { target: { value: 'Synthetic Association' } })
    fireEvent.change(screen.getByLabelText('Membership number'), { target: { value: 'X-1' } })
    fireEvent.click(screen.getByRole('button', { name: /Submit declaration/ }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    const body = JSON.parse(posts()[0][1].body)
    expect(body).toEqual({ kind: 'membership', declared_status: 'active', association_name: 'Synthetic Association', is_primary: true, membership_number: 'X-1', declared_renewal_date: null })
  })

  it('uploads evidence against the membership id, never an agent or tenant id', async () => {
    render(<MembershipsSection />)
    const input = await screen.findByLabelText('Upload evidence for Synthetic Association')
    const file = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(posts()).toHaveLength(1))
    const [url, init] = posts()[0]
    expect(url).toBe('/api/profile/memberships/evidence')
    const fd = init.body as FormData
    expect(fd.get('kind')).toBe('membership_confirmation')
    expect(fd.get('membership_id')).toBe('m1')
    expect(fd.get('agent_id')).toBeNull()
    expect(fd.get('tenant_id')).toBeNull()
  })

  it('acknowledges a disclosure', async () => {
    render(<MembershipsSection />)
    const card = await screen.findByTestId('ap-disclosure-d1')
    fireEvent.click(within(card).getByRole('button', { name: 'I acknowledge this disclosure' }))
    await waitFor(() => expect(posts()[0][0]).toBe('/api/profile/memberships/disclosures/d1/acknowledge'))
  })

  it('hides itself when Vault refuses the caller', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 403, json: async () => ({}) }))
    const { container } = render(<MembershipsSection />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('flag off: renders nothing and makes no request', () => {
    mockFlag = false
    const { container } = render(<MembershipsSection />)
    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows three separate statuses and the addendum status (consolidated)', async () => {
    render(<MembershipsSection />)
    const dl = await screen.findByLabelText('Your statuses')
    expect(within(dl).getByText('Affiliated')).toBeInTheDocument()
    expect(within(dl).getByText('Not a member')).toBeInTheDocument()
    expect(screen.getByTestId('ap-addendum-status')).toHaveTextContent(/not executed/)
  })

  it('"intend to join" is recorded as a pending declaration', async () => {
    render(<MembershipsSection />)
    fireEvent.click(await screen.findByLabelText('I intend to obtain or maintain qualifying REALTOR® membership'))
    fireEvent.click(screen.getByRole('button', { name: /Submit declaration/ }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(JSON.parse(posts()[0][1].body)).toEqual({ kind: 'membership', declared_status: 'pending', association_name: null })
  })

  it('the agent can object in writing to a reimbursement notice', async () => {
    render(<MembershipsSection />)
    const card = await screen.findByTestId('ap-reimbursement-n1')
    expect(within(card).getByText(/Nothing is deducted from your commissions/)).toBeInTheDocument()
    const btn = within(card).getByRole('button', { name: 'Submit objection' })
    expect(btn).toBeDisabled()
    fireEvent.change(within(card).getByLabelText('Objection to Synthetic Association notice'), { target: { value: 'I paid the association directly.' } })
    fireEvent.click(btn)
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0][0]).toBe('/api/profile/memberships/reimbursements/n1/object')
    expect(JSON.parse(posts()[0][1].body)).toEqual({ objection: 'I paid the association directly.' })
  })

  // Production defect (2026-11-19): the profile page sets `text-white` for its dark
  // theme and this white card set no text colour of its own, so the four election
  // choices, policy text and typed values rendered white-on-white. jsdom applies no
  // Tailwind CSS, so this asserts the classes that set the colour, not the pixels.
  it('the white card sets its own dark text colour so nothing inherits the page’s white text', async () => {
    render(<MembershipsSection />)
    const section = await screen.findByRole('region', { name: 'My Memberships & MLS' })
    expect(section.className).toMatch(/\bbg-white\b/)
    expect(section.className).toMatch(/\btext-gray-900\b/)
    for (const name of ['Association', 'MLS']) {
      expect(screen.getByRole('textbox', { name }).className).toMatch(/\btext-gray-900\b/)
    }
  })
})
