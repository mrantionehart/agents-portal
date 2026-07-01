// ============================================================================
// AGENT.SIGN.1B (Phase 0) — Vault→compliance-checklist mapping (pure)
// ============================================================================
// Pure projection helpers that map Vault System A output (agent-safe
// requirements + documents from ensure-forms) into the legacy /compliance
// checklist item shape, so the existing /compliance page keeps working while
// the required-document SET is now Vault-derived.
//
// Pure + dependency-free so it is unit-testable in isolation.
// ============================================================================

export type ChecklistStatus = 'approved' | 'uploaded' | 'rejected' | 'missing'

export interface VaultRequirementCard {
  form_id: string
  form_name: string
  category: string
  form_revision: string | null
  required: boolean
  reason: string
}

export interface VaultDocumentCard {
  form_id: string
  disposition: string
}

/** Map a Vault form_category onto the checklist's phase folders. */
export function categoryToFolder(category: string | null | undefined): string {
  switch (category) {
    case 'buyer_rep':
    case 'listing':
    case 'lease':
    case 'purchase':
      return 'listing_intake'
    case 'addendum':
      return 'under_contract'
    case 'disclosure':
      return 'compliance'
    default:
      return 'compliance'
  }
}

/**
 * Resolve the checklist status. A real uploaded file wins (its review status
 * maps directly); otherwise derive from the Vault materialized disposition;
 * otherwise missing.
 */
export function deriveChecklistStatus(
  matchedDocStatus: string | null | undefined,
  vaultDisposition: string | null | undefined
): ChecklistStatus {
  if (matchedDocStatus) {
    if (matchedDocStatus === 'verified') return 'approved'
    if (matchedDocStatus === 'rejected') return 'rejected'
    return 'uploaded'
  }
  if (vaultDisposition === 'signed' || vaultDisposition === 'completed_manual') {
    return 'approved'
  }
  if (
    vaultDisposition === 'ready_for_review' ||
    vaultDisposition === 'sent_for_signature'
  ) {
    return 'uploaded'
  }
  return 'missing'
}

/**
 * Build one checklist item from a Vault requirement (+ its materialized
 * document, if any, + a matched uploaded-file projection, if any).
 * `documentProjection` is the already-scrubbed uploaded-file object or null;
 * it MUST NOT carry Vault-internal fields (field_map/checksum/paths).
 */
export function buildVaultChecklistItem(
  req: VaultRequirementCard,
  vaultDoc: VaultDocumentCard | null,
  documentProjection: { status?: string } | null,
  sortOrder: number
) {
  const status = deriveChecklistStatus(
    documentProjection?.status,
    vaultDoc?.disposition
  )
  return {
    requirement_id: req.form_id,
    doc_label: req.form_name,
    is_required: req.required,
    // Disclosures don't require a signature by default; agreements do.
    signature_required: req.category !== 'disclosure',
    condition: null as string | null, // System A expresses conditionality by presence.
    condition_met: true,
    condition_label: null as string | null,
    folder: categoryToFolder(req.category),
    sort_order: sortOrder,
    // Additive fields (page ignores unknown keys):
    form_id: req.form_id,
    esign: !!vaultDoc, // DS indicator — a materialized e-sign instance exists
    vault_status: vaultDoc?.disposition ?? null,
    document: documentProjection,
    status,
  }
}
