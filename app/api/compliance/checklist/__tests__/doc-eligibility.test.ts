/**
 * @jest-environment node
 */
// DOC-ELIG-1 — the checklist's per-document status is Vault's verdict, never the raw row.
import { NextRequest } from 'next/server'

const DB: Record<string, any> = {}
function chain(table: string) {
  const c: any = {
    select: () => c, eq: () => c, is: () => c, order: () => c,
    single: async () => ({ data: table === 'transactions' ? DB.tx : table === 'profiles' ? { role: 'broker', full_name: 'A', email: 'a@x' } : null, error: null }),
    then: (f: any, g: any) => Promise.resolve({ data: table === 'documents' ? DB.docs : table === 'transaction_doc_requirements' ? DB.reqs : [], error: null }).then(f, g),
  }
  return c
}
jest.mock('@/lib/security', () => ({
  requireAuth: async () => ({ user: { id: 'u1' }, response: null }),
  userClient: () => ({ from: (t: string) => chain(t) }),
}))
jest.mock('@/lib/vault-forward', () => ({ ensureVaultForms: async () => ({ ok: false, status: 0, body: null }) }))
const reportMock = jest.fn()
jest.mock('@/lib/vault-requirements-report', () => {
  const actual = jest.requireActual('@/lib/vault-requirements-report')
  return { ...actual, fetchVaultRequirementsReport: (...a: unknown[]) => reportMock(...a) }
})
jest.mock('@/lib/portal-transaction-type', () => ({ mapPortalTransactionTypeToVaultType: () => ({ supported: false, vaultType: null }) }))

import { GET } from '../route'

const call = async () => {
  const res = await GET(new NextRequest('http://x/api/compliance/checklist?transaction_id=tx1'))
  const body = await res.json()
  return body.folders.flatMap((f: any) => f.items).find((i: any) => i.doc_label === 'Listing Agreement')
}

beforeEach(() => {
  DB.tx = { id: 'tx1', type: 'seller', agent_id: 'a1', financing_type: 'cash' }
  DB.reqs = [{ id: 'r1', folder: 'listing_intake', doc_label: 'Listing Agreement', is_required: true, signature_required: true, condition: null, sort_order: 1 }]
  DB.docs = [{ id: 'd1', name: 'Listing Agreement', status: 'verified', signature_status: 'present', reviewed_by: 'admin-1' }]
})

describe('[DOC-ELIG-1-AP] checklist route', () => {
  it('🛑 a verified row Vault says does not count shows uploaded, with the reason', async () => {
    reportMock.mockResolvedValue({ ok: true, report: {}, reviews: new Map([['d1', { document_id: 'd1', name: 'Listing Agreement', counts: false, reason: 'awaiting_broker_of_record', reason_text: 'Awaiting Broker of Record approval' }]]) })
    const it1 = await call()
    expect(it1.status).toBe('uploaded')
    expect(it1.document.compliance).toEqual({ counts: false, reason: 'awaiting_broker_of_record', reason_text: 'Awaiting Broker of Record approval' })
  })
  it('a document Vault says counts shows approved', async () => {
    reportMock.mockResolvedValue({ ok: true, report: {}, reviews: new Map([['d1', { document_id: 'd1', name: 'Listing Agreement', counts: true, reason: 'eligible', reason_text: 'Approved by the Broker of Record' }]]) })
    expect((await call()).status).toBe('approved')
  })
  it('🛑 Vault unavailable ⇒ nothing shows approved', async () => {
    reportMock.mockResolvedValue({ ok: false })
    const it1 = await call()
    expect(it1.status).toBe('uploaded')
    expect(it1.document.compliance.counts).toBe(false)
  })
})
