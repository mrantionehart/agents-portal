// DOC-ELIG-1 — the portal reads Vault's compliance verdict; it never re-derives it.
import {
  complianceCompleteFromReport, fetchVaultRequirementsReport, uploadedDocStatus, type VaultReportResult,
} from '../vault-requirements-report'

jest.mock('../vault-forward', () => ({ resolveAccessToken: jest.fn(async () => 'tok') }))

const report = (o: Record<string, unknown> = {}) => ({
  catalogue: 'present', wouldBlock: false, missing: [], underReview: [], signatureNotEvidenced: [], checklistIncomplete: [], ...o,
})
const ok = (rep = report()): VaultReportResult => ({ ok: true, report: rep as never, reviews: new Map() })

describe('[DOC-ELIG-1-AP] uploadedDocStatus — approved only on Vault\'s say-so', () => {
  it('a verified row does NOT show approved unless Vault says it counts', () => {
    expect(uploadedDocStatus('verified', null)).toBe('uploaded')
    expect(uploadedDocStatus('verified', { document_id: 'd', name: 'x', counts: false, reason: 'awaiting_broker_of_record', reason_text: '' })).toBe('uploaded')
    expect(uploadedDocStatus('verified', { document_id: 'd', name: 'x', counts: true, reason: 'eligible', reason_text: '' })).toBe('approved')
  })
  it('rejected stays rejected even if a stale verdict says it counts', () => {
    expect(uploadedDocStatus('rejected', { document_id: 'd', name: 'x', counts: true, reason: 'eligible', reason_text: '' })).toBe('rejected')
  })
  it('an uploaded row is never approved by itself', () => {
    expect(uploadedDocStatus('uploaded', undefined)).toBe('uploaded')
  })
})

describe('[DOC-ELIG-1-AP] complianceCompleteFromReport', () => {
  it('complete only when the catalogue is present and nothing blocks', () => {
    expect(complianceCompleteFromReport(ok()).complete).toBe(true)
    expect(complianceCompleteFromReport(ok(report({ wouldBlock: true, underReview: [{ doc_label: 'A' }] })))).toMatchObject({ complete: false, unapproved: 1 })
  })
  it('🛑 no requirement catalogue is NOT complete (the old portal check said it was)', () => {
    expect(complianceCompleteFromReport(ok(report({ catalogue: 'no_catalogue' }))).complete).toBe(false)
  })
  it('🛑 Vault unavailable ⇒ never complete', () => {
    expect(complianceCompleteFromReport({ ok: false }).complete).toBe(false)
  })
})

describe('[DOC-ELIG-1-AP] fetchVaultRequirementsReport', () => {
  const req = {} as never
  afterEach(() => { (global as { fetch?: unknown }).fetch = undefined })
  it('reads the report and indexes per-document reviews', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ report: report(), document_review: [{ document_id: 'd1', counts: true, reason: 'eligible', reason_text: 'x', name: 'A' }] }) })) as never
    const r = await fetchVaultRequirementsReport(req, 'tx1')
    expect(r.ok && r.reviews.get('d1')?.counts).toBe(true)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/transactions\/tx1\/requirements-report$/)
  })
  it.each([
    ['a non-2xx', { ok: false, json: async () => ({}) }],
    ['a body without document_review (older Vault)', { ok: true, json: async () => ({ report: report() }) }],
    ['a non-JSON body', { ok: true, json: async () => { throw new Error('x') } }],
  ])('🛑 %s ⇒ unavailable (fail closed)', async (_l, res) => {
    global.fetch = jest.fn(async () => res) as never
    expect((await fetchVaultRequirementsReport(req, 'tx1')).ok).toBe(false)
  })
  it('🛑 the network throws ⇒ unavailable', async () => {
    global.fetch = jest.fn(async () => { throw new Error('down') }) as never
    expect((await fetchVaultRequirementsReport(req, 'tx1')).ok).toBe(false)
  })
})
