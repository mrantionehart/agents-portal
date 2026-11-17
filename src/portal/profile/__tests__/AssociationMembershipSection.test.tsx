/**
 * @jest-environment jsdom
 */
// Association Membership & MLS Access — the agent's own section on /profile.
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

const calls: { url: string; init?: RequestInit }[] = []
let elections: unknown
let cases: unknown[] = []
let postStatus = 201
let postBody: unknown = {}
const resp = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body }) as unknown as Response
jest.mock('@/lib/supabase', () => ({
  authFetch: async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (init?.method === 'POST') return resp(postStatus, postBody)
    if (url === '/api/association/elections') return elections === 'fail' ? resp(503, {}) : resp(200, elections)
    if (url === '/api/association/assessments') return resp(200, { cases })
    return resp(404, {})
  },
}))

import AssociationMembershipSection from '../AssociationMembershipSection'

const base = {
  statuses: { brokerage_affiliation: 'affiliated', association_membership: 'declined', mls_access: 'active' },
  current: { association_name: null, association_member_id: null, assessment_disclosure: 'undeterminable', disclosed_estimated_amount: null },
  history: [],
  addendum: { released: false, executed: false, template: { title: 'Association Membership & Financial Responsibility Addendum' } },
}
beforeEach(() => { calls.length = 0; elections = base; cases = []; postStatus = 201; postBody = {} })

describe('AssociationMembershipSection', () => {
  it('shows the three statuses separately and that the addendum is not executed', async () => {
    render(<AssociationMembershipSection />)
    const section = await screen.findByRole('region', { name: 'Association membership' })
    expect(within(section).getByText('Brokerage affiliation', { selector: 'dt' }).nextSibling).toHaveTextContent('Affiliated')
    expect(within(section).getByText('Association membership', { selector: 'dt' }).nextSibling).toHaveTextContent('Declined')
    expect(within(section).getByText('MLS access', { selector: 'dt' }).nextSibling).toHaveTextContent('Active')
    expect(screen.getByTestId('addendum-status')).toHaveTextContent(/not executed\. It applies only after you and the Broker of Record sign it/)
    expect(screen.getByText(/REALTOR® membership is not required for every agent/)).toBeInTheDocument()
    expect(screen.queryByText('Reimbursement notices')).toBeNull()
  })

  it('records the agent’s own election — membership and MLS only, never the brokerage disclosure', async () => {
    render(<AssociationMembershipSection />)
    const save = await screen.findByRole('button', { name: 'Save election' })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/I currently maintain qualifying REALTOR/))
    fireEvent.change(screen.getByLabelText('Association name'), { target: { value: 'Example REALTORS' } })
    fireEvent.change(screen.getByLabelText('Membership / NRDS / M1 number'), { target: { value: 'M1-123' } })
    fireEvent.change(screen.getByLabelText('MLS access'), { target: { value: 'active' } })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    expect(await screen.findByRole('status')).toHaveTextContent('Your election has been recorded.')
    const post = calls.find((c) => c.init?.method === 'POST')!
    expect(post.url).toBe('/api/association/elections')
    const body = JSON.parse(post.init!.body as string)
    expect(body).toEqual({ membership_status: 'member', association_name: 'Example REALTORS', association_member_id: 'M1-123', mls_access_status: 'active' })
    expect(body).not.toHaveProperty('assessment_disclosure')
  })

  it('a refused save is shown as an error', async () => {
    postStatus = 422; postBody = { error: 'association_name_required' }
    render(<AssociationMembershipSection />)
    fireEvent.click(await screen.findByLabelText(/I currently maintain qualifying REALTOR/))
    fireEvent.change(screen.getByLabelText('MLS access'), { target: { value: 'active' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save election' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter your association name.')
  })

  it('a noticed case shows its basis and deadline; the agent objects in writing', async () => {
    cases = [{ id: '11111111-1111-4111-8111-111111111111', association_name: 'Example REALTORS', period_covered: '2027', proposed_amount: 500,
      calculation: '1 x $500', rule_basis: 'Bylaws art. 4', status: 'noticed', objection_deadline: '2027-01-29T04:59:59.999Z',
      objection_text: null, determination: null, determined_amount: null, payment_due_at: null }]
    postStatus = 200
    render(<AssociationMembershipSection />)
    const card = await screen.findByTestId('case-11111111-1111-4111-8111-111111111111')
    expect(card).toHaveTextContent('Basis: Bylaws art. 4. Calculation: 1 x $500.')
    expect(card).toHaveTextContent(/You may object in writing until Jan 28, 2027/)
    const submit = within(card).getByRole('button', { name: 'Submit objection' })
    expect(submit).toBeDisabled()
    fireEvent.change(within(card).getByLabelText('Your objection'), { target: { value: 'I was a member all year.' } })
    fireEvent.click(submit)
    await waitFor(() => expect(calls.some((c) => c.url === '/api/association/assessments/11111111-1111-4111-8111-111111111111')).toBe(true))
    const post = calls.find((c) => c.url.endsWith('11111111-1111-4111-8111-111111111111'))!
    expect(JSON.parse(post.init!.body as string)).toEqual({ action: 'object', objection: 'I was a member all year.' })
    expect(await screen.findByRole('status')).toHaveTextContent(/Broker of Record will review it/)
  })

  it('a determination states the amount, the due date and that nothing is deducted from commission', async () => {
    cases = [{ id: '22222222-2222-4222-8222-222222222222', association_name: 'Example REALTORS', period_covered: '2027', proposed_amount: 500,
      calculation: '1 x $500', rule_basis: 'Bylaws', status: 'determined', objection_deadline: null, objection_text: 'x',
      determination: 'reduced', determined_amount: 250, payment_due_at: '2027-03-01T17:00:00Z' }]
    render(<AssociationMembershipSection />)
    expect(await screen.findByTestId('case-22222222-2222-4222-8222-222222222222')).toHaveTextContent(/\$250\.00 payable by Mar 1, 2027.*No amount is deducted from your commission/)
  })

  it('a failed load is reported, not shown as empty', async () => {
    elections = 'fail'
    render(<AssociationMembershipSection />)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  })

  it('is mobile-first: statuses stack on a phone, the save button is full width', async () => {
    render(<AssociationMembershipSection />)
    expect((await screen.findByRole('button', { name: 'Save election' })).className).toMatch(/\bw-full\b.*\bsm:w-auto\b/)
    expect(screen.getByText('MLS access', { selector: 'dt' }).closest('dl')!.className).toMatch(/grid-cols-1 sm:grid-cols-3/)
  })
})
