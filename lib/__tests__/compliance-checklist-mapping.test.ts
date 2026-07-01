/**
 * @jest-environment node
 */
// ============================================================================
// AGENT.SIGN.1B (Phase 0) — Vault→compliance-checklist mapping tests
// ============================================================================

import {
  categoryToFolder,
  deriveChecklistStatus,
  buildVaultChecklistItem,
  type VaultRequirementCard,
} from '../compliance-checklist-mapping'

describe('categoryToFolder', () => {
  it('maps agreement categories into listing_intake', () => {
    for (const c of ['buyer_rep', 'listing', 'lease', 'purchase']) {
      expect(categoryToFolder(c)).toBe('listing_intake')
    }
  })
  it('maps addendum → under_contract, disclosure → compliance', () => {
    expect(categoryToFolder('addendum')).toBe('under_contract')
    expect(categoryToFolder('disclosure')).toBe('compliance')
  })
  it('defaults unknown/null to compliance', () => {
    expect(categoryToFolder('weird')).toBe('compliance')
    expect(categoryToFolder(null)).toBe('compliance')
  })
})

describe('deriveChecklistStatus', () => {
  it('uploaded file wins: verified→approved, rejected→rejected, else uploaded', () => {
    expect(deriveChecklistStatus('verified', 'in_preparation')).toBe('approved')
    expect(deriveChecklistStatus('rejected', 'signed')).toBe('rejected')
    expect(deriveChecklistStatus('pending', undefined)).toBe('uploaded')
  })
  it('falls back to Vault disposition when no uploaded file', () => {
    expect(deriveChecklistStatus(undefined, 'signed')).toBe('approved')
    expect(deriveChecklistStatus(undefined, 'completed_manual')).toBe('approved')
    expect(deriveChecklistStatus(undefined, 'ready_for_review')).toBe('uploaded')
    expect(deriveChecklistStatus(undefined, 'sent_for_signature')).toBe('uploaded')
    expect(deriveChecklistStatus(undefined, 'blocked')).toBe('missing')
    expect(deriveChecklistStatus(undefined, 'in_preparation')).toBe('missing')
  })
  it('missing when nothing is known', () => {
    expect(deriveChecklistStatus(undefined, undefined)).toBe('missing')
    expect(deriveChecklistStatus(null, null)).toBe('missing')
  })
})

describe('buildVaultChecklistItem', () => {
  const req = (over: Partial<VaultRequirementCard> = {}): VaultRequirementCard => ({
    form_id: 'EBBA-8sa',
    form_name: 'Exclusive Buyer Brokerage Agreement',
    category: 'buyer_rep',
    form_revision: 'Rev 10/25',
    required: true,
    reason: 'FL Statute',
    ...over,
  })

  it('produces the legacy checklist item shape from a Vault requirement', () => {
    const item = buildVaultChecklistItem(req(), { form_id: 'EBBA-8sa', disposition: 'ready_for_review' }, null, 0)
    expect(item.requirement_id).toBe('EBBA-8sa')
    expect(item.doc_label).toBe('Exclusive Buyer Brokerage Agreement')
    expect(item.is_required).toBe(true)
    expect(item.folder).toBe('listing_intake')
    expect(item.signature_required).toBe(true)
    expect(item.condition).toBeNull()
    expect(item.esign).toBe(true) // materialized e-sign instance present
    expect(item.vault_status).toBe('ready_for_review')
    expect(item.status).toBe('uploaded')
    expect(item.document).toBeNull()
  })

  it('disclosures do not require a signature; no vault doc → esign false + missing', () => {
    const item = buildVaultChecklistItem(
      req({ form_id: 'LFD-1', form_name: 'Lease Flood Disclosure', category: 'disclosure', required: false }),
      null,
      null,
      3
    )
    expect(item.signature_required).toBe(false)
    expect(item.folder).toBe('compliance')
    expect(item.is_required).toBe(false)
    expect(item.esign).toBe(false)
    expect(item.status).toBe('missing')
    expect(item.sort_order).toBe(3)
  })

  it('an uploaded verified file marks the item approved and carries the document', () => {
    const doc = { status: 'verified', id: 'd1', name: 'x.pdf' }
    const item = buildVaultChecklistItem(req(), null, doc, 1)
    expect(item.status).toBe('approved')
    expect(item.document).toBe(doc)
  })

  it('never leaks Vault-internal fields', () => {
    const item = buildVaultChecklistItem(req(), { form_id: 'EBBA-8sa', disposition: 'signed' }, null, 0)
    const json = JSON.stringify(item)
    expect(json).not.toContain('field_map')
    expect(json).not.toContain('checksum')
    expect(json).not.toContain('tenant_id')
    expect(json).not.toContain('pdf_path')
  })
})
