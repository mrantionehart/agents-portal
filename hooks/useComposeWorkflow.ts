// ============================================================================
// Slice 2 Phase 3B-4 · useComposeWorkflow — hook driving the composer state
// ============================================================================
// Wires the pure reducer (composerReducer) to the typed Vault client with:
//   * abort-per-request via AbortController
//   * monotonic previewSequence for race safety (only the response that
//     matches the LATEST sequence + fingerprint can replace preview state)
//   * automatic re-preview when input fingerprint changes (debounced NO —
//     the composer route triggers preview explicitly on step transitions)
// ============================================================================

'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import {
  composerReducer,
  makeInitialState,
  type ComposerAction,
  type ComposerState,
} from '@/lib/signing/composer-state'
import {
  requestComposePreview,
  submitPackage,
  buildSubmitBody,
  type SubmitCommandResult,
  type VaultCallResult,
} from '@/lib/signing/vault-client'

interface UseComposeWorkflowInput {
  readonly transactionId: string
  readonly previousPackageId?: string
}

interface UseComposeWorkflowApi {
  readonly state: ComposerState
  readonly dispatch: (a: ComposerAction) => void
  /** Explicitly request a preview NOW. Safe to call on the same input;
   *  the reducer's race guard handles stale replies. */
  readonly triggerPreview: () => void
  /** Attempt to submit. Returns the parsed SubmitCommandResult on success
   *  (and the caller navigates); otherwise the state carries submitError. */
  readonly submit: () => Promise<SubmitCommandResult | null>
}

/** Cryptographically-strong per-session UUID (falls back to timestamp+random
 *  when crypto.randomUUID is unavailable in the render environment). */
function freshUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Test-only fallback — never used in the browser.
  const rand = Math.random().toString(16).slice(2)
  return `00000000-0000-4000-8000-${rand.padEnd(12, '0').slice(0, 12)}`
}

export function useComposeWorkflow(input: UseComposeWorkflowInput): UseComposeWorkflowApi {
  const initialKeyRef = useRef<string | null>(null)
  if (initialKeyRef.current === null) initialKeyRef.current = freshUuid()
  const [state, dispatch] = useReducer(
    composerReducer,
    undefined,
    () =>
      makeInitialState({
        transactionId: input.transactionId,
        previousPackageId: input.previousPackageId,
        initialIdempotencyKey: initialKeyRef.current!,
      }),
  )

  // Track the AbortController for the current preview so a new dispatch
  // cancels the outstanding one.
  const previewAbortRef = useRef<AbortController | null>(null)
  // Also track a monotonic sequence — reducer already carries one, but we
  // increment locally so preview_started sees the value we're about to use.
  const sequenceRef = useRef(0)

  // Track prior key values so a material change ROTATES the idempotency
  // key. Per spec §15, key rotates on: selected documents change, authority
  // selection change, previous_package_id change, preview recipients change
  // after a fresh preview, submission note change if server treats as
  // command intent (we treat it as intent). We also rotate on routing_order.
  const lastMaterialRef = useRef<string>(
    JSON.stringify({
      d: [...state.selectedDocumentIds].sort(),
      a: state.authoritySelectionMap,
      p: state.previousPackageId ?? null,
      r: state.routingOrder,
      n: state.submissionNote ?? '',
      // recipient identity fingerprint updates when preview replaces recipients
      rec: state.preview?.recipient_plan.map((r) => r.recipient_instance_id).sort() ?? [],
    }),
  )
  useEffect(() => {
    const key = JSON.stringify({
      d: [...state.selectedDocumentIds].sort(),
      a: state.authoritySelectionMap,
      p: state.previousPackageId ?? null,
      r: state.routingOrder,
      n: state.submissionNote ?? '',
      rec: state.preview?.recipient_plan.map((r) => r.recipient_instance_id).sort() ?? [],
    })
    if (key !== lastMaterialRef.current) {
      lastMaterialRef.current = key
      dispatch({ type: 'rotate_idempotency_key', newKey: freshUuid() })
    }
  }, [
    state.selectedDocumentIds,
    state.authoritySelectionMap,
    state.previousPackageId,
    state.routingOrder,
    state.submissionNote,
    state.preview,
  ])

  const triggerPreview = useCallback(() => {
    // Abort any in-flight preview.
    if (previewAbortRef.current) previewAbortRef.current.abort()
    const ctrl = new AbortController()
    previewAbortRef.current = ctrl
    // Bump sequence + snapshot the fingerprint we're requesting for.
    sequenceRef.current += 1
    const seq = sequenceRef.current
    const fp = state.inputFingerprint
    dispatch({ type: 'preview_started', sequence: seq })
    // Kick the fetch. Do NOT await — response comes back via dispatch.
    void requestComposePreview(
      state.transactionId,
      {
        document_ids: state.selectedDocumentIds,
        routing_order: state.routingOrder,
        ...(Object.keys(state.authoritySelectionMap).length > 0
          ? { authority_selection_map: state.authoritySelectionMap }
          : {}),
      },
      { signal: ctrl.signal },
    ).then((result) => {
      dispatch({
        type: 'preview_resolved',
        sequence: seq,
        forFingerprint: fp,
        result,
      })
    })
  }, [
    state.transactionId,
    state.selectedDocumentIds,
    state.routingOrder,
    state.authoritySelectionMap,
    state.inputFingerprint,
  ])

  const submit = useCallback(async (): Promise<SubmitCommandResult | null> => {
    if (!state.preview) return null
    if (state.submitLoading || state.previewLoading) return null
    dispatch({ type: 'submit_started' })
    const body = buildSubmitBody({
      preview: state.preview,
      document_ids: state.selectedDocumentIds,
      routing_order: state.routingOrder,
      command_idempotency_key: state.commandIdempotencyKey,
      ...(state.submissionNote !== undefined ? { submission_note: state.submissionNote } : {}),
      ...(state.previousPackageId !== undefined
        ? { previous_package_id: state.previousPackageId }
        : {}),
    })
    const result: VaultCallResult<SubmitCommandResult> = await submitPackage(
      state.transactionId,
      body,
    )
    if (result.ok) {
      dispatch({ type: 'submit_resolved', result: { ok: true } })
      return result.value
    }
    // AP tsconfig has strict:false — narrowing via `if (result.ok)` doesn't
    // help downstream refinement. Cast to the failure arm.
    const err = result as Exclude<VaultCallResult<SubmitCommandResult>, { ok: true }>
    // Map error to the state shape. `aborted` is not user-facing here —
    // treat as network for consistency.
    const kind = err.kind === 'aborted' ? 'network' : err.kind
    const submitError =
      kind === 'validation_error'
        ? {
            kind: 'validation_error' as const,
            ...(err.kind === 'validation_error' && err.reason !== undefined ? { reason: err.reason } : {}),
            ...(err.kind === 'validation_error' && err.field !== undefined ? { field: err.field } : {}),
          }
        : kind === 'unexpected_status'
          ? { kind: 'unexpected_status' as const, httpStatus: (err as { httpStatus: number }).httpStatus }
          : { kind: kind as 'idempotency_conflict' | 'plan_version_not_enabled' | 'unauthorized' | 'forbidden' | 'not_found' | 'network' | 'invalid_response' }
    dispatch({ type: 'submit_resolved', result: { ok: false, error: submitError } })
    return null
  }, [
    state.preview,
    state.previewLoading,
    state.submitLoading,
    state.transactionId,
    state.selectedDocumentIds,
    state.routingOrder,
    state.commandIdempotencyKey,
    state.submissionNote,
    state.previousPackageId,
  ])

  // Cancel any in-flight preview on unmount.
  useEffect(() => {
    return () => {
      if (previewAbortRef.current) previewAbortRef.current.abort()
    }
  }, [])

  return { state, dispatch, triggerPreview, submit }
}
