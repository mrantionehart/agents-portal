// ============================================================================
// Slice 2 Phase 3B-4 · Typed Vault client for the AP composer workflow
// ============================================================================
// Centralizes every Vault call the composer needs:
//   * transaction documents (via AP proxy → Vault paperwork/agents/... list)
//   * compose-preview (via AP proxy → Vault signing compose-preview)
//   * V2 package submission (via AP proxy → Vault signing submit)
//   * package detail/status (via existing 3B-3.5 AP proxy)
//
// Contract guarantees:
//   * Exact request serialization — no extra keys, no dropped required fields
//   * Runtime response coercion — malformed responses REJECTED (invalid_response)
//   * Stable handling of 401 / 403 / 404 / 409 / network / plan_version_not_enabled
//   * No V1 fallback anywhere
//   * No silent dropping of required V2 fields
//   * Abort signal + stale-response support via caller-supplied AbortSignal
//   * The compose-preview response's recipient_plan entries pass into the
//     submit request as `recipients` WITHOUT field-level semantic
//     transformation (documented at buildSubmitBody)
//   * No provider_recipient_id ever invented by the client
//   * No recipient identity/routing/capacity/role/routing_order generation
// ============================================================================

// ─── Common shapes ────────────────────────────────────────────────────────

/** RFC 4122 UUID (any version, case-insensitive). */
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export type SigningCapacityKind = 'signer' | 'observer' | 'cc' | 'witness' | 'notary'

export type SigningRecipientRoleV2 =
  | 'buyer'
  | 'seller'
  | 'landlord'
  | 'tenant'
  | 'broker'
  | 'cooperating_agent'
  | 'escrow'
  | 'cc_only'
  | 'witness'
  | 'notary'
  | 'guarantor'
  | 'lender'
  | 'agent'
  | 'attorney'
  | 'title_company'
  | 'observer'

/**
 * The V2 recipient shape exactly as returned by Vault compose-preview and
 * accepted by Vault V2 submit. The client MUST NOT mutate these entries —
 * they flow from preview.recipient_plan → submit.recipients unchanged.
 */
export interface RecipientPlanEntryV2 {
  readonly recipient_instance_id: string
  readonly represented_party_id?: string
  readonly representative_party_id?: string
  readonly authority_grant_id?: string
  readonly role: SigningRecipientRoleV2
  readonly capacity_kind: SigningCapacityKind
  readonly routing_order: number
  readonly name: string
  readonly email: string
  readonly signature_required: boolean
  readonly phone?: string | null
  readonly provider_recipient_id?: string
  readonly signed_at?: string | null
}

export type DiagnosticSeverity =
  | 'blocking'
  | 'warning'
  | 'informational'
  | 'user_action_required'

export interface Diagnostic {
  readonly code: string
  readonly severity: DiagnosticSeverity
  readonly message: string
  readonly context: Readonly<Record<string, unknown>>
}

export interface ComposePreviewResponse {
  readonly plan_version: 'v2'
  readonly recipient_plan: readonly RecipientPlanEntryV2[]
  readonly diagnostics: {
    readonly blocking: readonly Diagnostic[]
    readonly warnings: readonly Diagnostic[]
    readonly informational: readonly Diagnostic[]
    readonly user_actions_required: readonly Diagnostic[]
  }
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface SubmitCommandResult {
  readonly packageId: string
  readonly matterId: string
  readonly matterOpened: boolean
  readonly packageStatus: 'awaiting_broker_approval'
  readonly approvalStatus: 'pending'
  readonly submittedAt: string
  readonly previousPackageId: string | null
  readonly cached: boolean
}

/** Agent-visible document card as returned by Vault agent-safe docs list. */
export interface TransactionDocumentCard {
  /** Opaque identifier that Vault accepts as `document_ids[i]` at compose
   *  preview + submit time. This client does NOT interpret the value — it
   *  is passed verbatim between endpoints. */
  readonly form_instance_id: string
  readonly form_id: string
  readonly form_name: string
  readonly category: string
  readonly disposition: string
  readonly status_label: string
  readonly downloadable: boolean
  readonly last_updated: string
}

// ─── Discriminated fetch results ──────────────────────────────────────────

/** Every network call collapses to one of these outcomes. Callers switch
 *  on `kind` — never on inspection of arbitrary error strings. */
export type VaultCallResult<TOk> =
  | { readonly ok: true; readonly value: TOk }
  | { readonly ok: false; readonly kind: 'aborted' }
  | { readonly ok: false; readonly kind: 'unauthorized'; readonly httpStatus: 401 }
  | { readonly ok: false; readonly kind: 'forbidden'; readonly httpStatus: 403 }
  | { readonly ok: false; readonly kind: 'not_found'; readonly httpStatus: 404 }
  | { readonly ok: false; readonly kind: 'idempotency_conflict'; readonly httpStatus: 409 }
  | { readonly ok: false; readonly kind: 'plan_version_not_enabled'; readonly httpStatus: 400 }
  | { readonly ok: false; readonly kind: 'validation_error'; readonly httpStatus: number; readonly reason?: string; readonly field?: string }
  | { readonly ok: false; readonly kind: 'network'; readonly httpStatus: 0 }
  | { readonly ok: false; readonly kind: 'invalid_response'; readonly httpStatus: number }
  | { readonly ok: false; readonly kind: 'unexpected_status'; readonly httpStatus: number }

// ─── Compose preview request shape ───────────────────────────────────────

/** The exact request body accepted by Vault compose-preview. `plan_version`
 *  is a constant `"v2"` — the client never asks for V1. */
export interface ComposePreviewRequest {
  readonly document_ids: readonly string[]
  readonly routing_order: 'sequential' | 'parallel'
  readonly authority_selection_map?: Readonly<Record<string, string>>
  /** Broker-added recipients — not exposed by the agent-facing composer.
   *  Kept typed for future broker workflows only. */
  readonly broker_added_recipients?: readonly unknown[]
}

// ─── Coercers (pure, no throw) ────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function coerceRecipient(v: unknown): RecipientPlanEntryV2 | null {
  if (!isPlainObject(v)) return null
  if (typeof v.recipient_instance_id !== 'string' || !UUID_RE.test(v.recipient_instance_id)) return null
  if (typeof v.role !== 'string') return null
  if (typeof v.capacity_kind !== 'string') return null
  if (typeof v.routing_order !== 'number' || !Number.isInteger(v.routing_order)) return null
  if (typeof v.name !== 'string' || v.name.length === 0) return null
  if (typeof v.email !== 'string' || v.email.length === 0) return null
  if (typeof v.signature_required !== 'boolean') return null
  // Provenance UUIDs — validate WHEN PRESENT; missing = allowed (broker-added
  // recipients omit them).
  if (v.represented_party_id !== undefined) {
    if (typeof v.represented_party_id !== 'string' || !UUID_RE.test(v.represented_party_id)) return null
  }
  if (v.representative_party_id !== undefined) {
    if (typeof v.representative_party_id !== 'string' || !UUID_RE.test(v.representative_party_id)) return null
  }
  if (v.authority_grant_id !== undefined) {
    if (typeof v.authority_grant_id !== 'string' || !UUID_RE.test(v.authority_grant_id)) return null
  }
  // Rebuild a fresh frozen entry with ONLY the whitelisted fields, so
  // wire-body drift can never introduce unknown recipient keys into
  // client state or the submit body.
  const out: RecipientPlanEntryV2 = {
    recipient_instance_id: v.recipient_instance_id,
    role: v.role as SigningRecipientRoleV2,
    capacity_kind: v.capacity_kind as SigningCapacityKind,
    routing_order: v.routing_order,
    name: v.name,
    email: v.email,
    signature_required: v.signature_required,
    ...(v.represented_party_id !== undefined
      ? { represented_party_id: v.represented_party_id as string }
      : {}),
    ...(v.representative_party_id !== undefined
      ? { representative_party_id: v.representative_party_id as string }
      : {}),
    ...(v.authority_grant_id !== undefined
      ? { authority_grant_id: v.authority_grant_id as string }
      : {}),
    ...(v.phone !== undefined ? { phone: v.phone as string | null } : {}),
    ...(v.provider_recipient_id !== undefined
      ? { provider_recipient_id: v.provider_recipient_id as string }
      : {}),
    ...(v.signed_at !== undefined ? { signed_at: v.signed_at as string | null } : {}),
  }
  return Object.freeze(out)
}

function coerceDiagnostic(v: unknown): Diagnostic | null {
  if (!isPlainObject(v)) return null
  if (typeof v.code !== 'string' || v.code.length === 0) return null
  const sev = v.severity
  if (
    sev !== 'blocking' &&
    sev !== 'warning' &&
    sev !== 'informational' &&
    sev !== 'user_action_required'
  ) return null
  if (typeof v.message !== 'string') return null
  const ctx = isPlainObject(v.context) ? v.context : {}
  return Object.freeze({
    code: v.code,
    severity: sev,
    message: v.message,
    context: Object.freeze({ ...ctx }),
  })
}

export function coerceComposePreviewResponse(v: unknown): ComposePreviewResponse | null {
  if (!isPlainObject(v)) return null
  if (v.plan_version !== 'v2') return null
  if (!Array.isArray(v.recipient_plan)) return null
  const recipients: RecipientPlanEntryV2[] = []
  for (const raw of v.recipient_plan) {
    const rec = coerceRecipient(raw)
    if (!rec) return null // strict: any bad recipient → whole response invalid
    recipients.push(rec)
  }
  if (!isPlainObject(v.diagnostics)) return null
  const d = v.diagnostics
  const coerceBucket = (b: unknown): readonly Diagnostic[] | null => {
    if (!Array.isArray(b)) return null
    const out: Diagnostic[] = []
    for (const raw of b) {
      const c = coerceDiagnostic(raw)
      if (!c) return null
      out.push(c)
    }
    return Object.freeze(out)
  }
  const blocking = coerceBucket(d.blocking)
  const warnings = coerceBucket(d.warnings)
  const informational = coerceBucket(d.informational)
  const userActions = coerceBucket(d.user_actions_required)
  if (!blocking || !warnings || !informational || !userActions) return null
  const metadata = isPlainObject(v.metadata) ? v.metadata : {}
  return Object.freeze({
    plan_version: 'v2' as const,
    recipient_plan: Object.freeze(recipients),
    diagnostics: Object.freeze({
      blocking,
      warnings,
      informational,
      user_actions_required: userActions,
    }),
    metadata: Object.freeze({ ...metadata }),
  })
}

export function coerceSubmitResponse(v: unknown): SubmitCommandResult | null {
  if (!isPlainObject(v)) return null
  if (typeof v.packageId !== 'string' || !UUID_RE.test(v.packageId)) return null
  if (typeof v.matterId !== 'string') return null
  if (v.packageStatus !== 'awaiting_broker_approval') return null
  if (v.approvalStatus !== 'pending') return null
  if (typeof v.submittedAt !== 'string') return null
  if (typeof v.matterOpened !== 'boolean') return null
  const previousPackageId =
    typeof v.previousPackageId === 'string' && UUID_RE.test(v.previousPackageId)
      ? v.previousPackageId
      : null
  const cached = v.cached === true
  return Object.freeze({
    packageId: v.packageId,
    matterId: v.matterId,
    matterOpened: v.matterOpened,
    packageStatus: 'awaiting_broker_approval' as const,
    approvalStatus: 'pending' as const,
    submittedAt: v.submittedAt,
    previousPackageId,
    cached,
  })
}

export function coerceDocumentsResponse(v: unknown): readonly TransactionDocumentCard[] | null {
  if (!isPlainObject(v)) return null
  const list = v.documents
  if (!Array.isArray(list)) return null
  const out: TransactionDocumentCard[] = []
  for (const raw of list) {
    if (!isPlainObject(raw)) return null
    if (
      typeof raw.form_instance_id !== 'string' ||
      typeof raw.form_id !== 'string' ||
      typeof raw.form_name !== 'string' ||
      typeof raw.category !== 'string' ||
      typeof raw.disposition !== 'string' ||
      typeof raw.status_label !== 'string' ||
      typeof raw.downloadable !== 'boolean' ||
      typeof raw.last_updated !== 'string'
    ) return null
    out.push(Object.freeze({
      form_instance_id: raw.form_instance_id,
      form_id: raw.form_id,
      form_name: raw.form_name,
      category: raw.category,
      disposition: raw.disposition,
      status_label: raw.status_label,
      downloadable: raw.downloadable,
      last_updated: raw.last_updated,
    }))
  }
  return Object.freeze(out)
}

// ─── Shared status-code → discriminated result mapper ─────────────────────

async function mapErrorResponse(res: Response): Promise<VaultCallResult<never>> {
  if (res.status === 401) return { ok: false, kind: 'unauthorized', httpStatus: 401 }
  if (res.status === 403) return { ok: false, kind: 'forbidden', httpStatus: 403 }
  if (res.status === 404) return { ok: false, kind: 'not_found', httpStatus: 404 }
  if (res.status === 409) return { ok: false, kind: 'idempotency_conflict', httpStatus: 409 }
  if (res.status === 400) {
    // Try to read the Vault error body for plan_version_not_enabled etc.
    let body: unknown = null
    try { body = await res.json() } catch { body = null }
    if (isPlainObject(body)) {
      if (body.reason === 'plan_version_not_enabled') {
        return { ok: false, kind: 'plan_version_not_enabled', httpStatus: 400 }
      }
      return {
        ok: false,
        kind: 'validation_error',
        httpStatus: 400,
        ...(typeof body.reason === 'string' ? { reason: body.reason } : {}),
        ...(typeof body.field === 'string' ? { field: body.field } : {}),
      }
    }
    return { ok: false, kind: 'validation_error', httpStatus: 400 }
  }
  return { ok: false, kind: 'unexpected_status', httpStatus: res.status }
}

/** Wrap fetch with the standard AP client conventions: same-origin
 *  credentials, no-store cache, JSON body if given, AbortSignal
 *  passthrough. Errors are classified — this helper never throws for
 *  ordinary HTTP or network failures. */
async function callAp<TOk>(opts: {
  readonly url: string
  readonly method: 'GET' | 'POST'
  readonly body?: unknown
  readonly signal?: AbortSignal
  readonly coerce: (raw: unknown) => TOk | null
  readonly acceptStatus: readonly number[]
  readonly fetchImpl?: typeof fetch
}): Promise<VaultCallResult<TOk>> {
  const fetchImpl = opts.fetchImpl ?? fetch
  let res: Response
  try {
    res = await fetchImpl(opts.url, {
      method: opts.method,
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: opts.signal,
    })
  } catch (err: unknown) {
    if (
      err instanceof DOMException && err.name === 'AbortError'
      || (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError')
    ) {
      return { ok: false, kind: 'aborted' }
    }
    return { ok: false, kind: 'network', httpStatus: 0 }
  }
  if (!opts.acceptStatus.includes(res.status)) return mapErrorResponse(res)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, kind: 'invalid_response', httpStatus: res.status }
  }
  const value = opts.coerce(body)
  if (!value) return { ok: false, kind: 'invalid_response', httpStatus: res.status }
  return { ok: true, value }
}

// ─── Public API ───────────────────────────────────────────────────────────

/** List agent-visible documents for a transaction. Same-origin call to the
 *  AP proxy which forwards to Vault paperwork/agents/... */
export function fetchTransactionDocuments(
  transactionId: string,
  opts: { readonly signal?: AbortSignal; readonly fetchImpl?: typeof fetch } = {},
): Promise<VaultCallResult<readonly TransactionDocumentCard[]>> {
  return callAp({
    url: `/api/signing/transactions/${encodeURIComponent(transactionId)}/documents`,
    method: 'GET',
    signal: opts.signal,
    fetchImpl: opts.fetchImpl,
    coerce: coerceDocumentsResponse,
    acceptStatus: [200],
  })
}

/** Request a compose preview. Vault gates SIGNING_PLAN_V2_ENABLED — when
 *  OFF, the response is 400 { reason: 'plan_version_not_enabled' } and
 *  this call returns { ok: false, kind: 'plan_version_not_enabled' }. */
export function requestComposePreview(
  transactionId: string,
  req: ComposePreviewRequest,
  opts: { readonly signal?: AbortSignal; readonly fetchImpl?: typeof fetch } = {},
): Promise<VaultCallResult<ComposePreviewResponse>> {
  // Body is exactly what Vault accepts — plan_version constant, no client
  // additions, no missing required fields.
  const body: Record<string, unknown> = {
    plan_version: 'v2',
    document_ids: req.document_ids,
    routing_order: req.routing_order,
  }
  if (req.authority_selection_map) body.authority_selection_map = req.authority_selection_map
  if (req.broker_added_recipients) body.broker_added_recipients = req.broker_added_recipients
  return callAp({
    url: `/api/signing/transactions/${encodeURIComponent(transactionId)}/packages/compose-preview`,
    method: 'POST',
    body,
    signal: opts.signal,
    fetchImpl: opts.fetchImpl,
    coerce: coerceComposePreviewResponse,
    acceptStatus: [200],
  })
}

/**
 * Build the exact V2 submit request body from a preview response + AP
 * workflow state. This is the ONLY permitted transformation between the
 * two contracts:
 *   preview.recipient_plan  →  submit.recipients
 * Every recipient entry passes through UNMODIFIED — no fields added,
 * removed, or renamed. `provider_recipient_id` is never invented; if
 * present in the preview (unexpected before provider integration) it
 * flows through, otherwise it stays omitted.
 */
export function buildSubmitBody(input: {
  readonly preview: ComposePreviewResponse
  readonly document_ids: readonly string[]
  readonly routing_order: 'sequential' | 'parallel'
  readonly command_idempotency_key: string
  readonly submission_note?: string
  readonly previous_package_id?: string
}): {
  readonly plan_version: 'v2'
  readonly document_ids: readonly string[]
  readonly recipients: readonly RecipientPlanEntryV2[]
  readonly routing_order: 'sequential' | 'parallel'
  readonly command_idempotency_key: string
  readonly submission_note?: string
  readonly previous_package_id?: string
} {
  return Object.freeze({
    plan_version: 'v2' as const,
    document_ids: input.document_ids,
    // Passthrough: same array, same element references, no map/spread.
    recipients: input.preview.recipient_plan,
    routing_order: input.routing_order,
    command_idempotency_key: input.command_idempotency_key,
    ...(input.submission_note !== undefined ? { submission_note: input.submission_note } : {}),
    ...(input.previous_package_id !== undefined
      ? { previous_package_id: input.previous_package_id }
      : {}),
  })
}

/** Submit the V2 package. Returns SubmitCommandResult on 200 or 201. */
export function submitPackage(
  transactionId: string,
  body: ReturnType<typeof buildSubmitBody>,
  opts: { readonly signal?: AbortSignal; readonly fetchImpl?: typeof fetch } = {},
): Promise<VaultCallResult<SubmitCommandResult>> {
  return callAp({
    url: `/api/signing/transactions/${encodeURIComponent(transactionId)}/packages`,
    method: 'POST',
    body,
    signal: opts.signal,
    fetchImpl: opts.fetchImpl,
    coerce: coerceSubmitResponse,
    // 200 = cached idempotent replay, 201 = fresh
    acceptStatus: [200, 201],
  })
}
