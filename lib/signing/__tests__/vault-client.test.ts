/**
 * @jest-environment node
 */
// ============================================================================
// Slice 2 Phase 3B-4 · Typed Vault client tests
// ============================================================================
// Covers:
//   * exact request body serialization
//   * runtime coercion (rejects malformed; preserves recipient identity)
//   * status-code → discriminated result mapping (401/403/404/409/400
//     with plan_version_not_enabled / 400 validation / network / invalid)
//   * abort-signal support
//   * buildSubmitBody passthrough (preview.recipient_plan → submit.recipients
//     with NO field-level semantic transformation)
// ============================================================================

import {
  buildSubmitBody,
  coerceComposePreviewResponse,
  coerceDocumentsResponse,
  coerceSubmitResponse,
  fetchTransactionDocuments,
  requestComposePreview,
  submitPackage,
  type ComposePreviewResponse,
  type RecipientPlanEntryV2,
  type VaultCallResult,
} from '../vault-client'

const TXN = '00000000-0000-4000-8000-000000000001'
const PKG = '00000000-0000-4000-8000-000000000002'
const REC = '00000000-0000-4000-8000-000000000003'

function fetchImpl(res: Partial<{ status: number; body: unknown; throws: boolean; abort: boolean }>): typeof fetch {
  return (async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (res.abort && init?.signal) {
      const signal = init.signal
      if (signal.aborted) {
        const err = new Error('aborted')
        ;(err as { name: string }).name = 'AbortError'
        throw err
      }
    }
    if (res.throws) throw new Error('network fail')
    return {
      status: res.status ?? 200,
      json: async () => res.body,
    } as unknown as Response
  }) as unknown as typeof fetch
}

// Fail-branch cast helper (AP tsconfig strict:false — see 3B-3.5 comment).
type FailBranch<T> = Exclude<VaultCallResult<T>, { ok: true }>
const asFailure = <T,>(r: VaultCallResult<T>): FailBranch<T> => r as FailBranch<T>

const validRecipient: RecipientPlanEntryV2 = Object.freeze({
  recipient_instance_id: REC,
  role: 'buyer',
  capacity_kind: 'signer',
  routing_order: 1,
  name: 'Alice',
  email: 'alice@example.com',
  signature_required: true,
})

function validPreviewBody() {
  return {
    plan_version: 'v2',
    recipient_plan: [
      {
        recipient_instance_id: REC,
        role: 'buyer',
        capacity_kind: 'signer',
        routing_order: 1,
        name: 'Alice',
        email: 'alice@example.com',
        signature_required: true,
      },
    ],
    diagnostics: {
      blocking: [],
      warnings: [],
      informational: [],
      user_actions_required: [],
    },
    metadata: {},
  }
}

describe('coerceComposePreviewResponse', () => {
  it('accepts a canonical body', () => {
    const v = coerceComposePreviewResponse(validPreviewBody())
    expect(v).not.toBeNull()
    expect(v!.recipient_plan).toHaveLength(1)
    expect(v!.plan_version).toBe('v2')
  })
  it('rejects when plan_version is not v2', () => {
    expect(coerceComposePreviewResponse({ ...validPreviewBody(), plan_version: 'v1' })).toBeNull()
  })
  it('rejects when a recipient has malformed recipient_instance_id', () => {
    const body = validPreviewBody()
    body.recipient_plan[0].recipient_instance_id = 'not-uuid'
    expect(coerceComposePreviewResponse(body)).toBeNull()
  })
  it('rejects when diagnostics bucket contains malformed entry', () => {
    const body = validPreviewBody() as unknown as Record<string, unknown>
    ;(body.diagnostics as { blocking: unknown[] }).blocking = [{ code: 'x' }] // missing severity
    expect(coerceComposePreviewResponse(body)).toBeNull()
  })
  it('freezes the returned response object', () => {
    const v = coerceComposePreviewResponse(validPreviewBody())
    expect(Object.isFrozen(v)).toBe(true)
    expect(Object.isFrozen(v!.recipient_plan)).toBe(true)
    expect(Object.isFrozen(v!.diagnostics)).toBe(true)
  })
})

describe('coerceSubmitResponse', () => {
  it('accepts fresh 201 shape', () => {
    const v = coerceSubmitResponse({
      packageId: PKG,
      matterId: 'm-1',
      matterOpened: true,
      packageStatus: 'awaiting_broker_approval',
      approvalStatus: 'pending',
      submittedAt: '2026-08-01T00:00:00Z',
      previousPackageId: null,
      cached: false,
    })
    expect(v).not.toBeNull()
    expect(v!.cached).toBe(false)
  })
  it('accepts cached 200 shape', () => {
    const v = coerceSubmitResponse({
      packageId: PKG,
      matterId: 'm-1',
      matterOpened: false,
      packageStatus: 'awaiting_broker_approval',
      approvalStatus: 'pending',
      submittedAt: '2026-08-01T00:00:00Z',
      previousPackageId: null,
      cached: true,
    })
    expect(v).not.toBeNull()
    expect(v!.cached).toBe(true)
  })
  it('rejects invalid packageId UUID', () => {
    expect(
      coerceSubmitResponse({
        packageId: 'not-uuid',
        matterId: 'm',
        matterOpened: false,
        packageStatus: 'awaiting_broker_approval',
        approvalStatus: 'pending',
        submittedAt: '2026',
        previousPackageId: null,
      }),
    ).toBeNull()
  })
})

describe('coerceDocumentsResponse', () => {
  it('accepts documents array', () => {
    const v = coerceDocumentsResponse({
      documents: [
        {
          form_instance_id: 'x',
          form_id: 'f',
          form_name: 'F',
          category: 'c',
          disposition: 'd',
          status_label: 's',
          downloadable: true,
          last_updated: '2026',
        },
      ],
    })
    expect(v).not.toBeNull()
    expect(v).toHaveLength(1)
  })
  it('rejects missing documents key', () => {
    expect(coerceDocumentsResponse({})).toBeNull()
  })
  it('rejects malformed row (missing field)', () => {
    expect(
      coerceDocumentsResponse({
        documents: [{ form_instance_id: 'x' /* missing rest */ }],
      }),
    ).toBeNull()
  })
})

describe('fetchTransactionDocuments', () => {
  it('200 → ok', async () => {
    const r = await fetchTransactionDocuments(TXN, {
      fetchImpl: fetchImpl({ status: 200, body: { documents: [] } }),
    })
    expect(r.ok).toBe(true)
  })
  it('401 → unauthorized', async () => {
    const r = await fetchTransactionDocuments(TXN, {
      fetchImpl: fetchImpl({ status: 401 }),
    })
    expect(asFailure(r).kind).toBe('unauthorized')
  })
  it('404 → not_found', async () => {
    const r = await fetchTransactionDocuments(TXN, {
      fetchImpl: fetchImpl({ status: 404 }),
    })
    expect(asFailure(r).kind).toBe('not_found')
  })
  it('network throw → network', async () => {
    const r = await fetchTransactionDocuments(TXN, {
      fetchImpl: fetchImpl({ throws: true }),
    })
    expect(asFailure(r).kind).toBe('network')
  })
})

describe('requestComposePreview', () => {
  it('sends exact body shape (plan_version="v2", document_ids, routing_order)', async () => {
    let captured: unknown = null
    const custom: typeof fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      captured = { url, body: init?.body }
      return {
        status: 200,
        json: async () => validPreviewBody(),
      } as unknown as Response
    }) as unknown as typeof fetch
    await requestComposePreview(
      TXN,
      { document_ids: ['00000000-0000-4000-8000-00000000000a'], routing_order: 'parallel' },
      { fetchImpl: custom },
    )
    const c = captured as { url: string; body: string }
    expect(c.url).toBe(`/api/signing/transactions/${TXN}/packages/compose-preview`)
    const body = JSON.parse(c.body)
    expect(body).toEqual({
      plan_version: 'v2',
      document_ids: ['00000000-0000-4000-8000-00000000000a'],
      routing_order: 'parallel',
    })
  })

  it('includes authority_selection_map when provided', async () => {
    let captured: unknown = null
    const custom: typeof fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      captured = init?.body
      return { status: 200, json: async () => validPreviewBody() } as unknown as Response
    }) as unknown as typeof fetch
    await requestComposePreview(
      TXN,
      {
        document_ids: [REC],
        routing_order: 'parallel',
        authority_selection_map: { [TXN]: PKG },
      },
      { fetchImpl: custom },
    )
    expect(JSON.parse(captured as string).authority_selection_map).toEqual({ [TXN]: PKG })
  })

  it('400 with plan_version_not_enabled reason → plan_version_not_enabled', async () => {
    const r = await requestComposePreview(
      TXN,
      { document_ids: [REC], routing_order: 'parallel' },
      { fetchImpl: fetchImpl({ status: 400, body: { reason: 'plan_version_not_enabled' } }) },
    )
    expect(asFailure(r).kind).toBe('plan_version_not_enabled')
  })

  it('400 with other reason → validation_error with reason', async () => {
    const r = await requestComposePreview(
      TXN,
      { document_ids: [REC], routing_order: 'parallel' },
      { fetchImpl: fetchImpl({ status: 400, body: { reason: 'invalid_document_ids', field: 'document_ids' } }) },
    )
    const err = asFailure(r)
    expect(err.kind).toBe('validation_error')
    if (err.kind === 'validation_error') {
      expect(err.reason).toBe('invalid_document_ids')
      expect(err.field).toBe('document_ids')
    }
  })

  it('malformed body → invalid_response', async () => {
    const r = await requestComposePreview(
      TXN,
      { document_ids: [REC], routing_order: 'parallel' },
      { fetchImpl: fetchImpl({ status: 200, body: { plan_version: 'v1' } }) },
    )
    expect(asFailure(r).kind).toBe('invalid_response')
  })

  it('AbortSignal already-aborted → aborted result', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const r = await requestComposePreview(
      TXN,
      { document_ids: [REC], routing_order: 'parallel' },
      { signal: ctrl.signal, fetchImpl: fetchImpl({ abort: true }) },
    )
    expect(asFailure(r).kind).toBe('aborted')
  })
})

describe('submitPackage', () => {
  const submitBody = buildSubmitBody({
    preview: {
      plan_version: 'v2',
      recipient_plan: [validRecipient],
      diagnostics: {
        blocking: [], warnings: [], informational: [], user_actions_required: [],
      },
      metadata: {},
    } as ComposePreviewResponse,
    document_ids: [REC],
    routing_order: 'parallel',
    command_idempotency_key: 'idem-key-abcdefghij',
  })

  it('accepts 200 (cached) as ok', async () => {
    const r = await submitPackage(TXN, submitBody, {
      fetchImpl: fetchImpl({
        status: 200,
        body: {
          packageId: PKG, matterId: 'm', matterOpened: false,
          packageStatus: 'awaiting_broker_approval', approvalStatus: 'pending',
          submittedAt: '2026', previousPackageId: null, cached: true,
        },
      }),
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.cached).toBe(true)
  })

  it('accepts 201 (fresh) as ok', async () => {
    const r = await submitPackage(TXN, submitBody, {
      fetchImpl: fetchImpl({
        status: 201,
        body: {
          packageId: PKG, matterId: 'm', matterOpened: true,
          packageStatus: 'awaiting_broker_approval', approvalStatus: 'pending',
          submittedAt: '2026', previousPackageId: null, cached: false,
        },
      }),
    })
    expect(r.ok).toBe(true)
  })

  it('409 → idempotency_conflict', async () => {
    const r = await submitPackage(TXN, submitBody, {
      fetchImpl: fetchImpl({ status: 409 }),
    })
    expect(asFailure(r).kind).toBe('idempotency_conflict')
  })

  it('400 plan_version_not_enabled → plan_version_not_enabled', async () => {
    const r = await submitPackage(TXN, submitBody, {
      fetchImpl: fetchImpl({ status: 400, body: { reason: 'plan_version_not_enabled' } }),
    })
    expect(asFailure(r).kind).toBe('plan_version_not_enabled')
  })

  it('403 → forbidden', async () => {
    const r = await submitPackage(TXN, submitBody, { fetchImpl: fetchImpl({ status: 403 }) })
    expect(asFailure(r).kind).toBe('forbidden')
  })
})

describe('buildSubmitBody', () => {
  it('passes preview.recipient_plan into submit.recipients WITHOUT semantic transformation', () => {
    const preview: ComposePreviewResponse = {
      plan_version: 'v2',
      recipient_plan: [validRecipient],
      diagnostics: {
        blocking: [], warnings: [], informational: [], user_actions_required: [],
      },
      metadata: {},
    }
    const body = buildSubmitBody({
      preview,
      document_ids: [REC],
      routing_order: 'parallel',
      command_idempotency_key: 'idem-1',
    })
    // Same array reference — proves no map/spread that could drop fields
    expect(body.recipients).toBe(preview.recipient_plan)
    // Same first recipient reference — proves no per-entry copy
    expect(body.recipients[0]).toBe(preview.recipient_plan[0])
    // plan_version is constant "v2"
    expect(body.plan_version).toBe('v2')
    // No provider_recipient_id invented
    expect(body.recipients[0].provider_recipient_id).toBeUndefined()
  })

  it('omits optional fields when absent', () => {
    const body = buildSubmitBody({
      preview: {
        plan_version: 'v2',
        recipient_plan: [validRecipient],
        diagnostics: { blocking: [], warnings: [], informational: [], user_actions_required: [] },
        metadata: {},
      },
      document_ids: [REC],
      routing_order: 'parallel',
      command_idempotency_key: 'idem-1',
    })
    expect(Object.prototype.hasOwnProperty.call(body, 'submission_note')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(body, 'previous_package_id')).toBe(false)
  })

  it('includes submission_note + previous_package_id when provided', () => {
    const body = buildSubmitBody({
      preview: {
        plan_version: 'v2',
        recipient_plan: [validRecipient],
        diagnostics: { blocking: [], warnings: [], informational: [], user_actions_required: [] },
        metadata: {},
      },
      document_ids: [REC],
      routing_order: 'parallel',
      command_idempotency_key: 'idem-1',
      submission_note: 'please review',
      previous_package_id: PKG,
    })
    expect(body.submission_note).toBe('please review')
    expect(body.previous_package_id).toBe(PKG)
  })
})
