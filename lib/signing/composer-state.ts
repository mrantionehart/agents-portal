// ============================================================================
// Slice 2 Phase 3B-4 · Composer workflow state model
// ============================================================================
// Immutable state model + deterministic input fingerprint + stale-response
// protection. This module is PURE — no fetches, no side effects, no hooks.
// The React hook lives in useComposeWorkflow.ts and drives fetches; this
// file defines the state, the reducer, and the fingerprint algorithm.
//
// Design invariants:
//   * Every state transition is a fresh Object.freeze — no in-place mutation
//   * The preview result is treated as immutable. Consumers rerun the
//     composer instead of patching diagnostics or recipients locally.
//   * A monotonically increasing `previewSequence` guarantees that only
//     the response corresponding to the LATEST request can replace state.
//     If response 2 lands before response 1, response 1 is silently
//     dropped when it eventually arrives.
//   * A deterministic input fingerprint covers everything that could
//     change the composition result: transaction id, sorted document ids,
//     normalized authority selection map, previous_package_id. Any change
//     invalidates the prior preview (marked stale).
//   * Submission requires input fingerprint === preview fingerprint AND
//     no in-flight preview request AND no blocking diagnostics AND no
//     unresolved user_actions_required.
// ============================================================================

import type {
  ComposePreviewResponse,
  RecipientPlanEntryV2,
  VaultCallResult,
} from './vault-client'

// ─── State shapes ─────────────────────────────────────────────────────────

export type ComposerStep =
  | 'select_documents'
  | 'review_recipients'
  | 'resolve_actions'
  | 'confirm'

export interface ComposerState {
  readonly transactionId: string
  readonly step: ComposerStep
  readonly selectedDocumentIds: readonly string[]
  readonly authoritySelectionMap: Readonly<Record<string, string>>
  readonly routingOrder: 'sequential' | 'parallel'
  readonly submissionNote: string | undefined
  readonly previousPackageId: string | undefined
  /** Deterministic fingerprint of the current input set. Recomputed on
   *  every state transition that could change composition. */
  readonly inputFingerprint: string
  /** Fingerprint of the input set that produced `preview`. When these
   *  differ, the preview is stale. */
  readonly previewFingerprint: string | null
  /** The most recent successful preview response. Immutable. */
  readonly preview: ComposePreviewResponse | null
  /** Monotonic sequence used to reject stale in-flight responses. */
  readonly previewSequence: number
  /** True while a preview request is outstanding. */
  readonly previewLoading: boolean
  /** Last preview call outcome (kind only) when it wasn't a plain success. */
  readonly previewError:
    | { readonly kind: 'plan_version_not_enabled' }
    | { readonly kind: 'unauthorized' }
    | { readonly kind: 'forbidden' }
    | { readonly kind: 'not_found' }
    | { readonly kind: 'network' }
    | { readonly kind: 'invalid_response' }
    | { readonly kind: 'validation_error'; readonly reason?: string; readonly field?: string }
    | { readonly kind: 'unexpected_status'; readonly httpStatus: number }
    | null
  /** True after the first successful preview. Used to distinguish "not yet
   *  loaded" (previewFingerprint === null) from "stale after edits"
   *  (previewFingerprint !== inputFingerprint). */
  readonly hasEverLoadedPreview: boolean
  /** Idempotency key for the pending / most-recent submission. Reused on
   *  retry-same-intent, rotated when material intent changes. */
  readonly commandIdempotencyKey: string
  readonly submitLoading: boolean
  readonly submitError:
    | { readonly kind: 'idempotency_conflict' }
    | { readonly kind: 'plan_version_not_enabled' }
    | { readonly kind: 'unauthorized' }
    | { readonly kind: 'forbidden' }
    | { readonly kind: 'not_found' }
    | { readonly kind: 'network' }
    | { readonly kind: 'invalid_response' }
    | { readonly kind: 'validation_error'; readonly reason?: string; readonly field?: string }
    | { readonly kind: 'unexpected_status'; readonly httpStatus: number }
    | null
}

// ─── Fingerprint ──────────────────────────────────────────────────────────

/** Deterministic fingerprint covering everything that could change the
 *  composition result. Purely a string comparison — no crypto needed
 *  because collisions between different inputs are impossible for the
 *  data we hash (structured JSON of sorted arrays / sorted keys). */
export function computeInputFingerprint(input: {
  readonly transactionId: string
  readonly selectedDocumentIds: readonly string[]
  readonly authoritySelectionMap: Readonly<Record<string, string>>
  readonly previousPackageId: string | undefined
  readonly routingOrder: 'sequential' | 'parallel'
}): string {
  const sortedDocs = [...input.selectedDocumentIds].sort()
  const sortedKeys = Object.keys(input.authoritySelectionMap).sort()
  const normalizedMap: Array<[string, string]> = sortedKeys.map((k) => [
    k,
    input.authoritySelectionMap[k],
  ])
  return JSON.stringify({
    t: input.transactionId,
    d: sortedDocs,
    a: normalizedMap,
    p: input.previousPackageId ?? null,
    r: input.routingOrder,
  })
}

// ─── Initial state ────────────────────────────────────────────────────────

/** Build the initial state for a fresh composer session. Optionally seeded
 *  with a previous_package_id for the revision flow (§17). */
export function makeInitialState(input: {
  readonly transactionId: string
  readonly previousPackageId?: string
  readonly initialIdempotencyKey: string
}): ComposerState {
  const routingOrder: 'sequential' | 'parallel' = 'parallel'
  const initialInput = {
    transactionId: input.transactionId,
    selectedDocumentIds: [],
    authoritySelectionMap: {},
    previousPackageId: input.previousPackageId,
    routingOrder,
  }
  return Object.freeze({
    transactionId: input.transactionId,
    step: 'select_documents' as const,
    selectedDocumentIds: Object.freeze([]),
    authoritySelectionMap: Object.freeze({}),
    routingOrder,
    submissionNote: undefined,
    previousPackageId: input.previousPackageId,
    inputFingerprint: computeInputFingerprint(initialInput),
    previewFingerprint: null,
    preview: null,
    previewSequence: 0,
    previewLoading: false,
    previewError: null,
    hasEverLoadedPreview: false,
    commandIdempotencyKey: input.initialIdempotencyKey,
    submitLoading: false,
    submitError: null,
  })
}

// ─── Actions ──────────────────────────────────────────────────────────────

export type ComposerAction =
  | { readonly type: 'goto_step'; readonly step: ComposerStep }
  | { readonly type: 'toggle_document'; readonly documentId: string }
  | { readonly type: 'set_documents'; readonly documentIds: readonly string[] }
  | { readonly type: 'set_authority_selection'; readonly partyId: string; readonly grantId: string }
  | { readonly type: 'clear_authority_selection'; readonly partyId: string }
  | { readonly type: 'set_submission_note'; readonly note: string | undefined }
  | { readonly type: 'set_routing_order'; readonly routingOrder: 'sequential' | 'parallel' }
  | { readonly type: 'preview_started'; readonly sequence: number }
  | {
      readonly type: 'preview_resolved'
      readonly sequence: number
      readonly forFingerprint: string
      readonly result: VaultCallResult<ComposePreviewResponse>
    }
  | { readonly type: 'submit_started' }
  | {
      readonly type: 'submit_resolved'
      readonly result:
        | { readonly ok: true }
        | { readonly ok: false; readonly error: NonNullable<ComposerState['submitError']> }
    }
  | { readonly type: 'rotate_idempotency_key'; readonly newKey: string }

// ─── Reducer ──────────────────────────────────────────────────────────────

/**
 * Immutable reducer. Every branch returns a NEW frozen state object.
 * Any input change that could affect composition:
 *   1. updates the input,
 *   2. recomputes inputFingerprint,
 *   3. leaves preview/previewFingerprint in place (stale detected by mismatch).
 *
 * Preview replacement is race-safe:
 *   * On preview_started: bump previewSequence, mark previewLoading=true
 *   * On preview_resolved: accept ONLY if action.sequence === state.previewSequence
 *     AND action.forFingerprint === state.inputFingerprint at that moment.
 *     Otherwise silently drop (stale response).
 */
export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'goto_step':
      return Object.freeze({ ...state, step: action.step })

    case 'toggle_document': {
      const has = state.selectedDocumentIds.includes(action.documentId)
      const nextDocs = has
        ? state.selectedDocumentIds.filter((id) => id !== action.documentId)
        : [...state.selectedDocumentIds, action.documentId]
      return withRecomputedInput(state, { selectedDocumentIds: Object.freeze(nextDocs) })
    }

    case 'set_documents':
      return withRecomputedInput(state, {
        selectedDocumentIds: Object.freeze([...action.documentIds]),
      })

    case 'set_authority_selection': {
      const nextMap: Record<string, string> = { ...state.authoritySelectionMap }
      nextMap[action.partyId] = action.grantId
      return withRecomputedInput(state, {
        authoritySelectionMap: Object.freeze(nextMap),
      })
    }

    case 'clear_authority_selection': {
      const nextMap: Record<string, string> = { ...state.authoritySelectionMap }
      delete nextMap[action.partyId]
      return withRecomputedInput(state, {
        authoritySelectionMap: Object.freeze(nextMap),
      })
    }

    case 'set_submission_note':
      return Object.freeze({ ...state, submissionNote: action.note })

    case 'set_routing_order':
      return withRecomputedInput(state, { routingOrder: action.routingOrder })

    case 'preview_started':
      return Object.freeze({
        ...state,
        previewSequence: action.sequence,
        previewLoading: true,
        previewError: null,
      })

    case 'preview_resolved': {
      // Race guard: only accept the response that matches the LATEST
      // request. If a later request has already been dispatched, drop
      // this response silently.
      if (action.sequence !== state.previewSequence) return state
      // Fingerprint guard: if inputs changed between dispatch and response,
      // the response no longer reflects current intent — drop it.
      if (action.forFingerprint !== state.inputFingerprint) {
        return Object.freeze({ ...state, previewLoading: false })
      }
      if (action.result.ok) {
        return Object.freeze({
          ...state,
          previewLoading: false,
          preview: action.result.value,
          previewFingerprint: action.forFingerprint,
          previewError: null,
          hasEverLoadedPreview: true,
        })
      }
      // AP tsconfig has strict:false — narrowing via `if (r.ok)` doesn't
      // help downstream refinement. Cast to the failure arm explicitly.
      const err = action.result as Exclude<
        VaultCallResult<ComposePreviewResponse>,
        { ok: true }
      >
      const previewError = mapPreviewError(err)
      return Object.freeze({
        ...state,
        previewLoading: false,
        previewError,
      })
    }

    case 'submit_started':
      return Object.freeze({ ...state, submitLoading: true, submitError: null })

    case 'submit_resolved': {
      if (action.result.ok) {
        return Object.freeze({ ...state, submitLoading: false, submitError: null })
      }
      const submitError = (action.result as { ok: false; error: NonNullable<ComposerState['submitError']> }).error
      return Object.freeze({
        ...state,
        submitLoading: false,
        submitError,
      })
    }

    case 'rotate_idempotency_key':
      return Object.freeze({ ...state, commandIdempotencyKey: action.newKey })

    default: {
      // Exhaustiveness check — unreachable branch guards the discriminant.
      const _exhaustive: never = action
      void _exhaustive
      return state
    }
  }
}

function withRecomputedInput(
  state: ComposerState,
  patch: Partial<Pick<ComposerState, 'selectedDocumentIds' | 'authoritySelectionMap' | 'routingOrder' | 'previousPackageId'>>,
): ComposerState {
  const next = { ...state, ...patch } as ComposerState
  const fp = computeInputFingerprint({
    transactionId: next.transactionId,
    selectedDocumentIds: next.selectedDocumentIds,
    authoritySelectionMap: next.authoritySelectionMap,
    previousPackageId: next.previousPackageId,
    routingOrder: next.routingOrder,
  })
  return Object.freeze({ ...next, inputFingerprint: fp })
}

function mapPreviewError(
  err: Exclude<VaultCallResult<ComposePreviewResponse>, { ok: true }>,
): NonNullable<ComposerState['previewError']> {
  switch (err.kind) {
    case 'aborted':
      // Aborted requests are not user-facing errors — treat as no change.
      // (The caller will just wait for the next in-flight response.)
      return { kind: 'network' } // conservative fallback if surfaced
    case 'plan_version_not_enabled':
    case 'unauthorized':
    case 'forbidden':
    case 'not_found':
    case 'network':
    case 'invalid_response':
      return { kind: err.kind }
    case 'validation_error':
      return {
        kind: 'validation_error',
        ...(err.reason !== undefined ? { reason: err.reason } : {}),
        ...(err.field !== undefined ? { field: err.field } : {}),
      }
    case 'unexpected_status':
      return { kind: 'unexpected_status', httpStatus: err.httpStatus }
    case 'idempotency_conflict':
      // Preview never returns 409 in the current contract; treat as unexpected.
      return { kind: 'unexpected_status', httpStatus: 409 }
  }
}

// ─── Derived selectors ────────────────────────────────────────────────────

/** True when the current input matches the fingerprint of the loaded
 *  preview AND a preview exists. Fresh loads / edits after preview both
 *  cause this to be false. */
export function isPreviewCurrent(state: ComposerState): boolean {
  return (
    state.preview !== null &&
    state.previewFingerprint !== null &&
    state.previewFingerprint === state.inputFingerprint
  )
}

/** Blocking diagnostics + unresolved user_actions_required both block
 *  confirmation and submit. */
export function hasBlockingConditions(state: ComposerState): boolean {
  if (!state.preview) return true
  if (state.preview.diagnostics.blocking.length > 0) return true
  if (state.preview.diagnostics.user_actions_required.length > 0) return true
  return false
}

/**
 * Full submit-eligibility gate. Returns a stable reason code when
 * ineligible, or null when submission may proceed. Consumers use this
 * to compute the disabled state of the submit button AND to render a
 * short explanation of why submit is not available.
 */
export function submitIneligibleReason(state: ComposerState):
  | null
  | 'no_documents_selected'
  | 'preview_missing'
  | 'preview_stale'
  | 'preview_in_flight'
  | 'submit_in_flight'
  | 'blocking_diagnostic'
  | 'unresolved_user_action'
  | 'empty_recipient_plan' {
  if (state.selectedDocumentIds.length === 0) return 'no_documents_selected'
  if (state.previewLoading) return 'preview_in_flight'
  if (state.submitLoading) return 'submit_in_flight'
  if (!state.preview) return 'preview_missing'
  if (!isPreviewCurrent(state)) return 'preview_stale'
  if (state.preview.recipient_plan.length === 0) return 'empty_recipient_plan'
  if (state.preview.diagnostics.blocking.length > 0) return 'blocking_diagnostic'
  if (state.preview.diagnostics.user_actions_required.length > 0) return 'unresolved_user_action'
  return null
}

/** Extract the party ids that need a representative selection right now
 *  (from the current preview's user_actions_required bucket). */
export function pendingAnyOneSelections(preview: ComposePreviewResponse): readonly string[] {
  const out = new Set<string>()
  for (const d of preview.diagnostics.user_actions_required) {
    if (d.code === 'action_provide_selection') {
      const partyId = typeof d.context.party_id === 'string' ? d.context.party_id : null
      if (partyId) out.add(partyId)
    }
  }
  return Object.freeze([...out])
}

/** Recipients grouped by category for §10 rendering. */
export function groupRecipientsByRole(preview: ComposePreviewResponse): {
  readonly signers: readonly RecipientPlanEntryV2[]
  readonly witnessesNotaries: readonly RecipientPlanEntryV2[]
  readonly observersCc: readonly RecipientPlanEntryV2[]
} {
  const signers: RecipientPlanEntryV2[] = []
  const witnessesNotaries: RecipientPlanEntryV2[] = []
  const observersCc: RecipientPlanEntryV2[] = []
  for (const r of preview.recipient_plan) {
    if (r.capacity_kind === 'signer') signers.push(r)
    else if (r.capacity_kind === 'witness' || r.capacity_kind === 'notary') witnessesNotaries.push(r)
    else observersCc.push(r)
  }
  return Object.freeze({
    signers: Object.freeze(signers),
    witnessesNotaries: Object.freeze(witnessesNotaries),
    observersCc: Object.freeze(observersCc),
  })
}
