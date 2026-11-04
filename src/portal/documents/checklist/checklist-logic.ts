// ============================================================================
// AGENT.SIGN.1C — Vault-powered checklist logic (pure)
// ============================================================================
// Pure, dependency-free mapping + selection rules for the transaction document
// checklist. Consumes the agent-safe projection returned by Vault ensure-forms
// ({ requirements, documents }); produces render-ready rows. All the spec's
// status/requirement/selection rules live here so they are unit-testable.
// ============================================================================

import type { FormInstanceStatus } from '../shared-types'

// ── Vault-side projection shapes (agent-safe; mirror the Vault cards) ──────
/**
 * 🔑 P4H — THIS WAS A THIRD HAND-WRITTEN COPY of Vault's status vocabulary,
 * and it was the fifth such copy to be found drifting in two days. It listed
 * eight statuses and none of the three approval states, so a broker-approved
 * agreement hit `mapVaultStatusToLabel`'s default and read "Required" at the
 * top of the Documents tab, above a panel that said "Approved".
 *
 * It is now an ALIAS of the canonical union in shared-types.ts — which is
 * pure and dependency-free, so this file stays pure too. A status Vault adds
 * is now added in exactly one place, and this file cannot silently fall
 * behind it again.
 */
export type VaultFormStatus = FormInstanceStatus

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
  /** P4H-13 — Vault says whether this form also accepts an uploaded PDF. */
  accepts_upload?: boolean
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
  | 'Pending Broker Approval'
  | 'Changes Requested'
  | 'Approved — Awaiting Signature'
  | 'Sent'
  | 'Signed'
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
    case 'pending_approval':
      return 'Pending Broker Approval'
    case 'changes_requested':
      return 'Changes Requested'
    case 'approved':
      return 'Approved — Awaiting Signature'
    case 'sent':
      return 'Sent'
    // 🔑 `signed` used to render as 'Approved'. With a broker-approved
    // document now labelled "Approved — Awaiting Signature", the shorter
    // string would have sat on the MORE advanced state — the confusion that
    // produced this report. Execution is `Signed`; approval is the broker's
    // act earlier in the chain.
    case 'signed':
      return 'Signed'
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
  // 🔑 P4H — AN APPROVED DOCUMENT IS SELECTABLE. It fell to the catch-all
  // below and read "Not ready yet", which is the opposite of true: the broker
  // has approved it and it is the one state that IS ready to go out.
  if (doc.status === 'ready' || doc.status === 'signed' || doc.status === 'approved') {
    return { selectable: true }
  }
  // Awaiting a decision, or returned for one. Both have a document; neither
  // is the agent's to act on from here, and saying WHICH is the point.
  if (doc.status === 'pending_approval')
    return { selectable: false, reason: 'Pending broker approval' }
  if (doc.status === 'changes_requested')
    return { selectable: false, reason: 'Broker requested changes' }
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
  accepts_upload: boolean
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
      accepts_upload: doc?.accepts_upload ?? false,
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

// ── E-sign send gating ───────────────────────────────────────────────────────
/** The part of GET /api/esign/status this UI is allowed to read. All three
 *  fields are non-secret; no token ever reaches the client. */
export interface EsignStatusLite {
  connected?: boolean
  needs_reconnect?: boolean
  /** The connected account's address, for telling the agent WHICH account. */
  email?: string | null
}

/**
 * The account's state in the only three flavours any surface here cares about,
 * plus `unknown` for "not answered yet / could not be read".
 *
 * 🔑 P4H — `connected` IS NOT THE QUESTION, and a boolean cannot carry the
 * answer. An account whose access token has expired still reads
 * `connected: true`; Vault flags it with `needs_reconnect`. For gating a send
 * that collapses safely onto "no" — but for TELLING THE AGENT WHAT IS WRONG it
 * does not, and the record-envelope surface said "No DocuSign account is
 * connected" to a pilot agent whose account was connected the whole time.
 *
 * So this is the one derivation, and `esignSendEnabled` is a projection of it.
 * A surface that needs to explain itself reads the state; a surface that needs
 * a gate reads the boolean. They cannot disagree.
 */
export type EsignConnectionState = 'checking' | 'unknown' | 'none' | 'stale' | 'ready'

/**
 * 🔑 `checking` and `unknown` are deliberately NOT the same state. "Not asked
 * yet" and "asked, and could not find out" read identically to a careless
 * caller — and a test whose expected copy is also the initial copy passes
 * whether or not the question was ever put. This union makes that mistake
 * impossible to write.
 */

export function esignConnectionState(
  status: EsignStatusLite | null | undefined
): EsignConnectionState {
  if (!status) return 'unknown'
  if (status.connected !== true) return 'none'
  return status.needs_reconnect === true ? 'stale' : 'ready'
}

/** Whether the per-row "Send via My DocuSign" action may be offered.
 *
 *  Sending on an expired account fails at the provider, after the agent has
 *  already told a client the agreement is on its way — so an account needing
 *  reconnection is treated exactly as no account at all and the row offers
 *  Connect instead.
 *
 *  An absent or unparseable status refuses: this gate fails CLOSED. */
export function esignSendEnabled(status: EsignStatusLite | null | undefined): boolean {
  return esignConnectionState(status) === 'ready'
}
