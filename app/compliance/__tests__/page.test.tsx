/**
 * @jest-environment jsdom
 */
// DOC-ELIG-1 — the compliance page shows Vault's verdict: a document an office
// administrator verified is "Awaiting Broker of Record approval", not Approved,
// and an administrator's action is labelled a recommendation.
import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('../../providers', () => {
  // A STABLE user object: a new one each render re-runs the page's loaders.
  const auth = { user: { id: 'u1', email: 'a@x.co' }, role: 'admin', loading: false, signOut: () => {} }
  return { useAuth: () => auth }
})
jest.mock('../../components/SidebarNav', () => () => null)

import CompliancePage from '../page'

const TX = { id: 'tx1', type: 'buyer', status: 'under_contract', property_address: '1 Test Way', city: 'X', state: 'FL', client_name: 'C', contract_price: 1, closing_date: '2026-12-01', contract_date: '2026-11-01', agent_id: 'a1', agent_name: 'Agent', compliance: { required_docs: 1, uploaded: 1, approved: 0, progress: 0, missing_signatures: 0 } }
const doc = (o: Record<string, unknown>) => ({ id: 'd1', name: 'Listing Agreement', status: 'verified', file_path: 'p', file_size: 1, mime_type: 'application/pdf', upload_date: '2026-11-11', verified_date: null, signature_status: 'present', signature_notes: null, reviewed_by: 'admin-1', reviewed_at: null, ...o })
const item = (status: string, d: Record<string, unknown>) => ({ requirement_id: 'r1', doc_label: 'Listing Agreement', is_required: true, signature_required: true, condition: null, condition_met: true, condition_label: null, folder: 'listing_intake', sort_order: 1, document: doc(d), status })

function mount(role: string, it: unknown) {
  global.fetch = jest.fn(async (url: string) => {
    const body = url.startsWith('/api/compliance/transactions') ? { transactions: [TX] }
      : url.startsWith('/api/compliance/checklist') ? { transaction: TX, role, stats: {}, folders: [{ id: 'listing_intake', label: 'Intake / Listed', items: [it], stats: { total: 1, required: 1, uploaded: 1, approved: 0 } }] }
      : { notifications: [] }
    return { ok: true, status: 200, json: async () => body } as Response
  }) as never
  render(<CompliancePage />)
}

describe('[DOC-ELIG-1-AP] compliance page', () => {
  it('an administrator-verified document reads "Awaiting Broker of Record approval" and offers only a recommendation', async () => {
    mount('admin', item('uploaded', { compliance: { counts: false, reason: 'awaiting_broker_of_record', reason_text: 'Awaiting Broker of Record approval' } }))
    fireEvent.click(await screen.findByText('1 Test Way'))
    expect(await screen.findByTestId('compliance-reason')).toHaveTextContent('Awaiting Broker of Record approval')
    expect(screen.getByRole('button', { name: /Recommend approval/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Approve$/ })).toBeNull()
  })
  it('a broker sees Approve on the same document', async () => {
    mount('broker', item('uploaded', { compliance: { counts: false, reason: 'awaiting_broker_of_record', reason_text: 'Awaiting Broker of Record approval' } }))
    fireEvent.click(await screen.findByText('1 Test Way'))
    await screen.findByTestId('compliance-reason')
    expect(screen.getByRole('button', { name: /Approve/ })).toBeVisible()
  })
  it('a Broker-of-Record-approved document shows no pending reason', async () => {
    mount('broker', item('approved', { reviewed_by: 'bor', compliance: { counts: true, reason: 'eligible', reason_text: 'Approved by the Broker of Record' } }))
    fireEvent.click(await screen.findByText('1 Test Way'))
    await waitFor(() => expect(screen.getAllByText('Listing Agreement').length).toBeGreaterThan(0))
    expect(screen.queryByTestId('compliance-reason')).toBeNull()
  })
})
