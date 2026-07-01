// ============================================================================
// AGENT.SIGN.1C — Vault-powered checklist logic (pure)
// ============================================================================
// Pure, dependency-free mapping + selection rules for the transaction document
// checklist. Consumes the agent-safe projection returned by Vault ensure-forms
// ({ requirements, documents }); produces render-ready rows. All the spec's
// status/requirement/selection rules live here so they are unit-testable.
// ============================================================================

// ── Vault-side projection shapes (agent-safe; mirror the Vault cards) ──────
export type VaultFormStatus =
  | 'recommended'
  | 'required'
  | 'blocked'
  | 'in_progress'
  | 'ready'
  | 'sent'
  | 'signed'
  | 'voided'

export interface VaultRequirementCard {
  form_id: string
  form_name: string
  category: string
  form_revision: string | null
  required: boolean
  reason: string
  requirement_basis?: 'always' | 'conditional'
}

export interface VaultDocumentCard {
  form_instance_id: string
  form_id: string
  form_name: string
  category: string
  disposition: string
  status_label: string
  downloadable: boolean
  last_updated: string
  status: VaultFormStatus
  form_revision: string | null
  manual_only: boolean
  generatable: boolean
  e_sign: boolean
  has_upload: boolean
}

// ── UI labels ──────────────────────────────────────────────────────────────
export type ChecklistStatusLabel =
  | 'Blocked'
  | 'Required'
  | 'Preparing'
  | 'Ready'
  | 'Sent'
  | 'Approved'
  | 'Hidden'

export type RequirementLabel = 'Required' | 'Conditional' | 'Optional'

/** Vault form_instance status → checklist STATUS column label. */
export function mapVaultStatusToLabel(status: VaultFormStatus): ChecklistStatusLabel {
  switch (status) {
    case 'blocked':
      return 'Blocked'
    case 'recommended':
    case 'required':
      return 'Required'
    case 'in_progress':
      return 'Preparing'
    case 'ready':
      return 'Ready'
    case 'sent':
      return 'Sent'
    case 'signed':
      return 'Approved'
    case 'voided':
      return 'Hidden'
    default:
      return 'Required'
  }
}

/**
 * REQUIREMENT column label. always_required → Required; a fired required_when
 * predicate → Conditional; anything else → Optional. NOTE: Vault System A does
 * not emit optional/recommended forms today, so "Optional" is effectively
 * unreachable from live data — kept for completeness.
 */
export function mapRequirementLabel(
  basis: 'always' | 'conditional' | undefined,
  required: boolean
): RequirementLabel {
  if (basis === 'always') return 'Required'
  if (basis === 'conditional') return 'Conditional'
  return required ? 'Required' : 'Optional'
}

// ── Selection rules ──────────────────────────────────────────────────────────
export interface Selectability {
  selectable: boolean
  reason?: string
}

/**
 * Selection rules (spec):
 *   Blocked      → not selectable
 *   Manual-only  → selectable only if a completed PDF is uploaded
 *   Ready        → selectable
 *   Signed       → selectable
 *   Preparing    → disabled
 *   (anything else / not started) → not selectable
 */
export function selectabilityFor(doc: VaultDocumentCard): Selectability {
  if (doc.status === 'voided') return { selectable: false, reason: 'Voided' }
  if (doc.status === 'blocked')
    return { selectable: false, reason: 'Blocked — awaiting required information' }
  if (doc.manual_only)
    return doc.has_upload
      ? { selectable: true }
      : { selectable: false, reason: 'Upload the completed PDF first' }
  if (doc.status === 'ready' || doc.status === 'signed') return { selectable: true }
  if (doc.status === 'in_progress')
    return { selectable: false, reason: 'Preparing' }
  return { selectable: false, reason: 'Not ready yet' }
}

// ── Row model ────────────────────────────────────────────────────────────────
export interface ChecklistRow {
  form_id: string
  form_instance_id: string | null
  form_name: string
  form_revision: string | null
  category: string
  reason: string
  rawStatus: VaultFormStatus | null
  statusLabel: ChecklistStatusLabel
  requirementLabel: RequirementLabel
  e_sign: boolean
  manual_only: boolean
  generatable: boolean
  has_upload: boolean
  downloadable: boolean
  selectable: boolean
  selectDisabledReason?: string
}

/**
 * Merge the rule-engine requirements (authoritative for what SHOULD exist) with
 * the materialized documents (status + actions), keyed by form_id. Drops any
 * Hidden (voided) rows. Requirements without a materialized doc (defensive —
 * shouldn't happen post-ensure-forms) render as not-yet-started "Required".
 */
export function buildChecklistRows(
  requirements: VaultRequirementCard[],
  documents: VaultDocumentCard[]
): ChecklistRow[] {
  const docByForm = new Map(documents.map((d) => [d.form_id, d]))
  const rows: ChecklistRow[] = []

  for (const req of requirements) {
    const doc = docByForm.get(req.form_id) ?? null
    const rawStatus = doc?.status ?? null
    const statusLabel: ChecklistStatusLabel = doc
      ? mapVaultStatusToLabel(doc.status)
      : 'Required'
    if (statusLabel === 'Hidden') continue

    const sel = doc ? selectabilityFor(doc) : { selectable: false, reason: 'Not ready yet' }

    rows.push({
      form_id: req.form_id,
      form_instance_id: doc?.form_instance_id ?? null,
      form_name: doc?.form_name ?? req.form_name,
      form_revision: doc?.form_revision ?? req.form_revision,
      category: req.category,
      reason: req.reason,
      rawStatus,
      statusLabel,
      requirementLabel: mapRequirementLabel(req.requirement_basis, req.required),
      e_sign: doc?.e_sign ?? false,
      manual_only: doc?.manual_only ?? false,
      generatable: doc?.generatable ?? false,
      has_upload: doc?.has_upload ?? false,
      downloadable: doc?.downloadable ?? false,
      selectable: sel.selectable,
      selectDisabledReason: sel.reason,
    })
  }

  return rows
}

// ── Action bar ───────────────────────────────────────────────────────────────
export interface ActionBarState {
  count: number
  canGenerate: boolean
  canDownload: boolean
}

/** Derive the action bar from the selected rows. Generate is enabled when any
 *  selected row is generatable; Download when any selected row is downloadable. */
export function deriveActionBar(
  rows: ChecklistRow[],
  selected: ReadonlySet<string>
): ActionBarState {
  const chosen = rows.filter((r) => selected.has(r.form_id) && r.selectable)
  return {
    count: chosen.length,
    canGenerate: chosen.some((r) => r.generatable && r.form_instance_id != null),
    canDownload: chosen.some((r) => r.downloadable && r.form_instance_id != null),
  }
}
