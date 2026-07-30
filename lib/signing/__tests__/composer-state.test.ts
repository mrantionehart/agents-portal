/**
 * @jest-environment node
 */
// ============================================================================
// Slice 2 Phase 3B-4 · composer state / reducer / fingerprint tests
// ============================================================================
// Covers:
//   * fingerprint determinism + sort-invariance
//   * reducer immutability + freeze
//   * stale-response race: response 2 wins over response 1
//   * fingerprint mismatch: stale by input change
//   * submitIneligibleReason gate matrix
// ============================================================================

import {
  composerReducer,
  computeInputFingerprint,
  hasBlockingConditions,
  isPreviewCurrent,
  makeInitialState,
  submitIneligibleReason,
  type ComposerState,
} from '../composer-state'
import type { ComposePreviewResponse, RecipientPlanEntryV2, VaultCallResult } from '../vault-client'

const TXN = '00000000-0000-4000-8000-000000000001'
const DOC1 = '00000000-0000-4000-8000-000000000002'
const DOC2 = '00000000-0000-4000-8000-000000000003'
const PKG_PREV = '00000000-0000-4000-8000-000000000009'
const KEY = 'initial-idem-key-abc'

function base(over: Partial<ComposerState> = {}): ComposerState {
  const s = makeInitialState({ transactionId: TXN, initialIdempotencyKey: KEY })
  // Preserve the freeze guarantee — the shipped reducer always returns
  // Object.freeze'd states, so tests should use frozen fixtures too.
  return Object.freeze({ ...s, ...over }) as ComposerState
}

const validRec: RecipientPlanEntryV2 = Object.freeze({
  recipient_instance_id: '00000000-0000-4000-8000-00000000000a',
  role: 'buyer', capacity_kind: 'signer', routing_order: 1,
  name: 'A', email: 'a@x.com', signature_required: true,
})

function preview(over: Partial<ComposePreviewResponse['diagnostics']> = {}): ComposePreviewResponse {
  return {
    plan_version: 'v2',
    recipient_plan: [validRec],
    diagnostics: {
      blocking: over.blocking ?? [],
      warnings: over.warnings ?? [],
      informational: over.informational ?? [],
      user_actions_required: over.user_actions_required ?? [],
    },
    metadata: {},
  }
}

describe('computeInputFingerprint', () => {
  it('is deterministic for same inputs', () => {
    const a = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [DOC1, DOC2],
      authoritySelectionMap: { x: 'y' }, previousPackageId: PKG_PREV, routingOrder: 'parallel',
    })
    const b = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [DOC1, DOC2],
      authoritySelectionMap: { x: 'y' }, previousPackageId: PKG_PREV, routingOrder: 'parallel',
    })
    expect(a).toBe(b)
  })

  it('is invariant to document-array order', () => {
    const a = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [DOC1, DOC2],
      authoritySelectionMap: {}, previousPackageId: undefined, routingOrder: 'parallel',
    })
    const b = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [DOC2, DOC1],
      authoritySelectionMap: {}, previousPackageId: undefined, routingOrder: 'parallel',
    })
    expect(a).toBe(b)
  })

  it('is invariant to authority_selection_map key order', () => {
    const a = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [],
      authoritySelectionMap: { a: '1', b: '2' }, previousPackageId: undefined, routingOrder: 'parallel',
    })
    const b = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [],
      authoritySelectionMap: { b: '2', a: '1' }, previousPackageId: undefined, routingOrder: 'parallel',
    })
    expect(a).toBe(b)
  })

  it('changes when routing_order changes', () => {
    const a = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [], authoritySelectionMap: {},
      previousPackageId: undefined, routingOrder: 'parallel',
    })
    const b = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [], authoritySelectionMap: {},
      previousPackageId: undefined, routingOrder: 'sequential',
    })
    expect(a).not.toBe(b)
  })

  it('changes when previous_package_id changes', () => {
    const a = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [], authoritySelectionMap: {},
      previousPackageId: undefined, routingOrder: 'parallel',
    })
    const b = computeInputFingerprint({
      transactionId: TXN, selectedDocumentIds: [], authoritySelectionMap: {},
      previousPackageId: PKG_PREV, routingOrder: 'parallel',
    })
    expect(a).not.toBe(b)
  })
})

describe('composerReducer immutability', () => {
  it('returns a frozen state', () => {
    const s = base()
    expect(Object.isFrozen(s)).toBe(true)
  })
  it('toggle_document returns new frozen state', () => {
    const s = base()
    const next = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    expect(next).not.toBe(s)
    expect(Object.isFrozen(next)).toBe(true)
    expect(next.selectedDocumentIds).toEqual([DOC1])
  })
  it('recomputes inputFingerprint on document change', () => {
    const s = base()
    const before = s.inputFingerprint
    const next = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    expect(next.inputFingerprint).not.toBe(before)
  })
})

describe('stale-response race safety', () => {
  it('response with earlier sequence is DROPPED after later sequence started', () => {
    let s = base()
    // Start request 1 (seq 1)
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    expect(s.previewSequence).toBe(1)
    // Start request 2 (seq 2) — supersedes 1
    s = composerReducer(s, { type: 'preview_started', sequence: 2 })
    expect(s.previewSequence).toBe(2)
    // Response 1 arrives late — should be dropped, no state change
    const stale: VaultCallResult<ComposePreviewResponse> = { ok: true, value: preview() }
    const afterStale = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: s.inputFingerprint, result: stale,
    })
    expect(afterStale).toBe(s) // reference equality — reducer returned same state
    expect(afterStale.preview).toBeNull()
    // Response 2 arrives — accepted
    const fresh: VaultCallResult<ComposePreviewResponse> = { ok: true, value: preview() }
    const afterFresh = composerReducer(afterStale, {
      type: 'preview_resolved', sequence: 2, forFingerprint: s.inputFingerprint, result: fresh,
    })
    expect(afterFresh.preview).not.toBeNull()
    expect(afterFresh.previewFingerprint).toBe(s.inputFingerprint)
  })

  it('response with matching sequence but stale fingerprint is DROPPED', () => {
    let s = base()
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    // Snapshot the fingerprint at request time
    const requestFp = s.inputFingerprint
    // User changes inputs — fingerprint advances
    s = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    expect(s.inputFingerprint).not.toBe(requestFp)
    // Response 1 arrives with sequence match but stale fingerprint
    const stale: VaultCallResult<ComposePreviewResponse> = { ok: true, value: preview() }
    const after = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: requestFp, result: stale,
    })
    // Preview NOT replaced, but previewLoading cleared
    expect(after.preview).toBeNull()
    expect(after.previewLoading).toBe(false)
  })
})

describe('isPreviewCurrent / hasBlockingConditions', () => {
  it('is false when preview is null', () => {
    expect(isPreviewCurrent(base())).toBe(false)
  })
  it('is true when previewFingerprint matches inputFingerprint', () => {
    let s = base()
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    s = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: s.inputFingerprint,
      result: { ok: true, value: preview() },
    })
    expect(isPreviewCurrent(s)).toBe(true)
  })
  it('hasBlockingConditions=true when blocking diagnostics exist', () => {
    let s = base()
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    s = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: s.inputFingerprint,
      result: { ok: true, value: preview({ blocking: [{ code: 'x', severity: 'blocking', message: 'm', context: {} }] }) },
    })
    expect(hasBlockingConditions(s)).toBe(true)
  })
  it('hasBlockingConditions=true when user_actions_required present', () => {
    let s = base()
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    s = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: s.inputFingerprint,
      result: { ok: true, value: preview({ user_actions_required: [{ code: 'action_provide_selection', severity: 'user_action_required', message: 'm', context: {} }] }) },
    })
    expect(hasBlockingConditions(s)).toBe(true)
  })
})

describe('submitIneligibleReason gate matrix', () => {
  it('no docs → no_documents_selected', () => {
    expect(submitIneligibleReason(base())).toBe('no_documents_selected')
  })
  it('preview loading → preview_in_flight', () => {
    let s = base()
    s = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    expect(submitIneligibleReason(s)).toBe('preview_in_flight')
  })
  it('preview absent → preview_missing', () => {
    let s = base()
    s = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    expect(submitIneligibleReason(s)).toBe('preview_missing')
  })
  it('stale preview → preview_stale', () => {
    let s = base()
    s = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    s = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: s.inputFingerprint,
      result: { ok: true, value: preview() },
    })
    // User changes input
    s = composerReducer(s, { type: 'toggle_document', documentId: DOC2 })
    expect(submitIneligibleReason(s)).toBe('preview_stale')
  })
  it('blocking diag → blocking_diagnostic', () => {
    let s = base()
    s = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    s = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: s.inputFingerprint,
      result: { ok: true, value: preview({ blocking: [{ code: 'x', severity: 'blocking', message: 'm', context: {} }] }) },
    })
    expect(submitIneligibleReason(s)).toBe('blocking_diagnostic')
  })
  it('all clear → null (eligible)', () => {
    let s = base()
    s = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    s = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: s.inputFingerprint,
      result: { ok: true, value: preview() },
    })
    expect(submitIneligibleReason(s)).toBeNull()
  })
})

describe('mutation-defense assertions', () => {
  it('reducer NEVER mutates the incoming state object', () => {
    const s = base()
    const clone = { ...s, selectedDocumentIds: [...s.selectedDocumentIds] }
    composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    expect(s).toEqual(clone)
  })

  it('preview replacement preserves recipient references (no local mutation)', () => {
    let s = base()
    s = composerReducer(s, { type: 'toggle_document', documentId: DOC1 })
    s = composerReducer(s, { type: 'preview_started', sequence: 1 })
    const original = preview()
    s = composerReducer(s, {
      type: 'preview_resolved', sequence: 1, forFingerprint: s.inputFingerprint,
      result: { ok: true, value: original },
    })
    // Same reference — reducer does not clone/patch
    expect(s.preview).toBe(original)
    expect(s.preview!.recipient_plan[0]).toBe(original.recipient_plan[0])
  })
})
