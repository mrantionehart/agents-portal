// ============================================================================
// Slice 2 Phase 3B-4 · ComposerShell — client-side workflow shell + 4 steps
// ============================================================================
// One shell renders four steps. Steps live in a single file to keep this
// slice's file count manageable and to make the state → UI flow visible in
// one place. Every step:
//   * receives the ComposerState + dispatch + hook API
//   * moves focus to its heading on activation
//   * uses semantic headings, labels, fieldset/legend where applicable
//   * announces loading/error states via aria-live regions
//   * disables continue/submit while preconditions are unmet
//
// Read-only: the composer never patches recipients or diagnostics locally.
// Any input change flows through the reducer, which then bumps the input
// fingerprint. Preview re-runs are explicit (triggered on step entry).
// ============================================================================

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useComposeWorkflow } from '@/hooks/useComposeWorkflow'
import {
  groupRecipientsByRole,
  hasBlockingConditions,
  isPreviewCurrent,
  pendingAnyOneSelections,
  submitIneligibleReason,
  type ComposerState,
  type ComposerStep,
} from '@/lib/signing/composer-state'
import {
  fetchTransactionDocuments,
  type Diagnostic,
  type TransactionDocumentCard,
  type VaultCallResult,
} from '@/lib/signing/vault-client'

interface ComposerShellProps {
  readonly transactionId: string
  readonly previousPackageId?: string
}

const STEP_ORDER: readonly ComposerStep[] = [
  'select_documents',
  'review_recipients',
  'resolve_actions',
  'confirm',
]

const STEP_LABELS: Readonly<Record<ComposerStep, string>> = {
  select_documents: 'Select documents',
  review_recipients: 'Review recipients',
  resolve_actions: 'Needs your attention',
  confirm: 'Ready to submit',
}

export function ComposerShell({ transactionId, previousPackageId }: ComposerShellProps) {
  const router = useRouter()
  const { state, dispatch, triggerPreview, submit } = useComposeWorkflow({
    transactionId,
    previousPackageId,
  })
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    // Move focus to the step heading on step change (a11y).
    headingRef.current?.focus()
  }, [state.step])

  // Trigger preview on entry to review_recipients (fresh input, or after a
  // fingerprint change from the user changing selections).
  useEffect(() => {
    if (state.step === 'review_recipients' && !isPreviewCurrent(state) && !state.previewLoading) {
      triggerPreview()
    }
  }, [state.step, state.inputFingerprint, state.preview, state.previewLoading, triggerPreview, state])

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <nav style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/transactions">Transactions</Link>
        <span aria-hidden> &rsaquo; </span>
        <Link href={`/transactions/${encodeURIComponent(transactionId)}`}>Transaction</Link>
        <span aria-hidden> &rsaquo; Prepare for signing</span>
      </nav>

      <h1 tabIndex={-1} ref={headingRef} style={{ margin: 0 }}>
        {STEP_LABELS[state.step]}
      </h1>
      <StepIndicator step={state.step} />

      {state.step === 'select_documents' ? (
        <SelectDocumentsStep
          transactionId={transactionId}
          selected={state.selectedDocumentIds}
          onToggle={(id) => dispatch({ type: 'toggle_document', documentId: id })}
          onContinue={() => dispatch({ type: 'goto_step', step: 'review_recipients' })}
        />
      ) : null}

      {state.step === 'review_recipients' ? (
        <ReviewRecipientsStep
          state={state}
          onBack={() => dispatch({ type: 'goto_step', step: 'select_documents' })}
          onContinue={() => {
            if (state.preview && state.preview.diagnostics.user_actions_required.length > 0) {
              dispatch({ type: 'goto_step', step: 'resolve_actions' })
            } else {
              dispatch({ type: 'goto_step', step: 'confirm' })
            }
          }}
          onRetry={triggerPreview}
        />
      ) : null}

      {state.step === 'resolve_actions' ? (
        <ResolveActionsStep
          state={state}
          onSelectRepresentative={(partyId, grantId) => {
            dispatch({ type: 'set_authority_selection', partyId, grantId })
            // Rerun preview after selection change.
            triggerPreview()
          }}
          onBack={() => dispatch({ type: 'goto_step', step: 'review_recipients' })}
          onContinue={() => dispatch({ type: 'goto_step', step: 'confirm' })}
        />
      ) : null}

      {state.step === 'confirm' ? (
        <ConfirmationStep
          state={state}
          onBack={() => dispatch({ type: 'goto_step', step: 'review_recipients' })}
          onSubmit={async () => {
            const result = await submit()
            if (result) {
              router.push(`/signing/packages/${encodeURIComponent(result.packageId)}`)
            }
          }}
          onSubmissionNoteChange={(note) =>
            dispatch({ type: 'set_submission_note', note: note.length > 0 ? note : undefined })
          }
        />
      ) : null}
    </main>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────

function StepIndicator({ step }: { readonly step: ComposerStep }) {
  const idx = STEP_ORDER.indexOf(step)
  return (
    <ol
      aria-label="Workflow progress"
      style={{
        display: 'flex',
        gap: 8,
        listStyle: 'none',
        padding: 0,
        margin: '12px 0 20px',
        fontSize: 13,
        color: '#666',
      }}
    >
      {STEP_ORDER.map((s, i) => (
        <li key={s}>
          <span
            aria-current={i === idx ? 'step' : undefined}
            style={{
              fontWeight: i === idx ? 600 : 400,
              color: i <= idx ? '#111' : '#999',
            }}
          >
            {i + 1}. {STEP_LABELS[s]}
          </span>
          {i < STEP_ORDER.length - 1 ? <span aria-hidden> · </span> : null}
        </li>
      ))}
    </ol>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 1 — Select documents
// ═══════════════════════════════════════════════════════════════════════════

function SelectDocumentsStep({
  transactionId,
  selected,
  onToggle,
  onContinue,
}: {
  readonly transactionId: string
  readonly selected: readonly string[]
  readonly onToggle: (id: string) => void
  readonly onContinue: () => void
}) {
  const [docs, setDocs] = useState<readonly TransactionDocumentCard[] | null>(null)
  const [error, setError] = useState<VaultCallResult<unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    void fetchTransactionDocuments(transactionId).then((r) => {
      if (r.ok) setDocs(r.value)
      else setError(r)
      setLoading(false)
    })
  }
  useEffect(load, [transactionId])

  if (loading && !docs) {
    return (
      <section aria-busy="true" aria-live="polite">
        <p>Loading documents…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section aria-live="polite">
        <p>Unable to load documents right now.</p>
        <button type="button" onClick={load}>Retry</button>
      </section>
    )
  }

  if (docs && docs.length === 0) {
    return (
      <section aria-live="polite">
        <p>No documents are available for this transaction yet.</p>
      </section>
    )
  }

  return (
    <section aria-label="Select documents">
      <p style={{ marginTop: 0 }}>
        Choose the documents to include in this signing package.
      </p>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Documents</legend>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {(docs ?? []).map((doc) => {
            const checked = selected.includes(doc.form_instance_id)
            return (
              <li key={doc.form_instance_id} style={{ marginBottom: 8 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(doc.form_instance_id)}
                  />
                  <span>
                    <strong>{doc.form_name}</strong>
                    <br />
                    <small style={{ color: '#666' }}>
                      {doc.category} · {doc.status_label}
                    </small>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={onContinue}
        >
          Continue to recipients
        </button>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 2 — Review recipients
// ═══════════════════════════════════════════════════════════════════════════

function ReviewRecipientsStep({
  state,
  onBack,
  onContinue,
  onRetry,
}: {
  readonly state: ComposerState
  readonly onBack: () => void
  readonly onContinue: () => void
  readonly onRetry: () => void
}) {
  if (state.previewError?.kind === 'plan_version_not_enabled') {
    return (
      <section aria-live="polite">
        <p>Signing setup is temporarily unavailable.</p>
        <button type="button" onClick={onBack}>Back</button>
      </section>
    )
  }

  if (state.previewLoading && !state.preview) {
    return (
      <section aria-busy="true" aria-live="polite">
        <p>Reviewing recipients…</p>
      </section>
    )
  }

  if (state.previewError) {
    return (
      <section aria-live="polite">
        <p>Unable to load recipients right now.</p>
        <button type="button" onClick={onRetry}>Retry</button>
        <button type="button" onClick={onBack} style={{ marginLeft: 8 }}>Back</button>
      </section>
    )
  }

  if (!state.preview) {
    return (
      <section aria-busy="true" aria-live="polite">
        <p>Reviewing recipients…</p>
      </section>
    )
  }

  const groups = groupRecipientsByRole(state.preview)
  const isStale = !isPreviewCurrent(state)
  const blocked = hasBlockingConditions(state)

  return (
    <section aria-label="Review derived recipients">
      {isStale ? (
        <p role="status" style={{ background: '#fff3cd', padding: 8 }}>
          Inputs changed since the last preview. Refresh to reload recipients.{' '}
          <button type="button" onClick={onRetry}>Refresh</button>
        </p>
      ) : null}

      <RecipientGroup title="Signers" recipients={groups.signers} />
      <RecipientGroup title="Witnesses and notaries" recipients={groups.witnessesNotaries} />
      <RecipientGroup title="Observers and copy recipients" recipients={groups.observersCc} />

      <DiagnosticsSection preview={state.preview} />

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={onBack}>Back</button>
        <button
          type="button"
          onClick={onContinue}
          disabled={blocked || isStale || state.previewLoading}
          style={{ marginLeft: 8 }}
        >
          Continue
        </button>
      </div>
    </section>
  )
}

function RecipientGroup({
  title,
  recipients,
}: {
  readonly title: string
  readonly recipients: readonly {
    readonly recipient_instance_id: string
    readonly role: string
    readonly name: string
    readonly email: string
    readonly capacity_kind: string
    readonly routing_order: number
    readonly signature_required: boolean
  }[]
}) {
  if (recipients.length === 0) return null
  return (
    <section aria-label={title} style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {recipients.map((r) => (
          <li
            key={r.recipient_instance_id}
            style={{
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ color: '#666', fontSize: 13 }}>
              <span>Signing as: <strong>{roleLabel(r.role)}</strong></span>{' '}
              · <span>Capacity: {capacityLabel(r.capacity_kind)}</span>{' '}
              · <span>Routing order: {r.routing_order}</span>
            </div>
            <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{r.email}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Human-readable role/capacity labels — never expose raw enum values as
// primary display content (spec §10).
const ROLE_LABELS: Readonly<Record<string, string>> = {
  buyer: 'Buyer',
  seller: 'Seller',
  landlord: 'Landlord',
  tenant: 'Tenant',
  broker: 'Broker',
  cooperating_agent: 'Cooperating agent',
  escrow: 'Escrow',
  cc_only: 'CC',
  witness: 'Witness',
  notary: 'Notary',
  guarantor: 'Guarantor',
  lender: 'Lender',
  agent: 'Agent',
  attorney: 'Attorney',
  title_company: 'Title company',
  observer: 'Observer',
}
function roleLabel(v: string): string { return ROLE_LABELS[v] ?? v }

const CAPACITY_LABELS: Readonly<Record<string, string>> = {
  signer: 'Signer',
  observer: 'Observer',
  cc: 'Copy',
  witness: 'Witness',
  notary: 'Notary',
}
function capacityLabel(v: string): string { return CAPACITY_LABELS[v] ?? v }

// ─── Diagnostics rendering (independent per severity) ────────────────────

function DiagnosticsSection({
  preview,
}: {
  readonly preview: {
    readonly diagnostics: {
      readonly blocking: readonly Diagnostic[]
      readonly warnings: readonly Diagnostic[]
      readonly informational: readonly Diagnostic[]
      readonly user_actions_required: readonly Diagnostic[]
    }
  }
}) {
  const { blocking, warnings, informational, user_actions_required } = preview.diagnostics
  const focusBlockingRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (blocking.length > 0) focusBlockingRef.current?.focus()
  }, [blocking.length])
  return (
    <section aria-label="Diagnostics" style={{ marginTop: 20 }}>
      {blocking.length > 0 ? (
        <div
          role="alert"
          tabIndex={-1}
          ref={focusBlockingRef}
          style={{ background: '#fdecec', padding: 12, borderRadius: 4, marginBottom: 8 }}
        >
          <strong>Issues to resolve</strong>
          <ul>
            {blocking.map((d, i) => (
              <li key={`${d.code}-${i}`}>{d.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {user_actions_required.length > 0 ? (
        <div
          role="status"
          style={{ background: '#fff8e1', padding: 12, borderRadius: 4, marginBottom: 8 }}
        >
          <strong>Needs your attention</strong>
          <ul>
            {user_actions_required.map((d, i) => (
              <li key={`${d.code}-${i}`}>{d.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div style={{ background: '#fffbea', padding: 12, borderRadius: 4, marginBottom: 8 }}>
          <strong>Warnings</strong>
          <ul>
            {warnings.map((d, i) => (
              <li key={`${d.code}-${i}`}>{d.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {informational.length > 0 ? (
        <div style={{ background: '#eef4ff', padding: 12, borderRadius: 4, marginBottom: 8 }}>
          <strong>Informational</strong>
          <ul>
            {informational.map((d, i) => (
              <li key={`${d.code}-${i}`}>{d.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 3 — Resolve required actions (any_one selection)
// ═══════════════════════════════════════════════════════════════════════════

function ResolveActionsStep({
  state,
  onSelectRepresentative,
  onBack,
  onContinue,
}: {
  readonly state: ComposerState
  readonly onSelectRepresentative: (partyId: string, grantId: string) => void
  readonly onBack: () => void
  readonly onContinue: () => void
}) {
  if (!state.preview) {
    return (
      <section aria-live="polite">
        <p>Loading required actions…</p>
      </section>
    )
  }
  const pendingParties = pendingAnyOneSelections(state.preview)
  if (pendingParties.length === 0) {
    return (
      <section aria-live="polite">
        <p>All required actions are resolved.</p>
        <button type="button" onClick={onBack}>Back</button>
        <button type="button" onClick={onContinue} style={{ marginLeft: 8 }}>Continue</button>
      </section>
    )
  }
  return (
    <section aria-label="Required actions">
      <p>
        The following authority policies require you to pick one authorized
        representative before you can submit.
      </p>
      <p style={{ color: '#666', fontSize: 13 }}>
        The composer does not choose for you — please select the correct
        representative for each entity.
      </p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {pendingParties.map((partyId) => (
          <PartySelector
            key={partyId}
            partyId={partyId}
            currentSelection={state.authoritySelectionMap[partyId]}
            onSelect={(grantId) => onSelectRepresentative(partyId, grantId)}
          />
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={onBack}>Back</button>
        <button
          type="button"
          onClick={onContinue}
          disabled={pendingParties.length > 0 || state.previewLoading}
          style={{ marginLeft: 8 }}
        >
          Continue
        </button>
      </div>
    </section>
  )
}

/**
 * Placeholder party selector. This slice cannot render representative
 * OPTIONS from the current compose-preview response because the response
 * does not include the enumerated grants — it only signals "you need to
 * select" via user_actions_required. If future work needs to render the
 * options here directly, that would require either a Vault contract
 * extension OR a separate list of grants fetched via a dedicated route.
 *
 * For this dormant slice, the selector accepts a free-form UUID input
 * as a low-fidelity placeholder — this UI is not exercised at flag-OFF
 * runtime (the whole route is server-gated). The important guarantee is
 * that user-selected grantIds flow into authoritySelectionMap unchanged
 * and NOTHING is auto-selected.
 */
function PartySelector({
  partyId,
  currentSelection,
  onSelect,
}: {
  readonly partyId: string
  readonly currentSelection: string | undefined
  readonly onSelect: (grantId: string) => void
}) {
  const [pending, setPending] = useState('')
  return (
    <li
      style={{
        padding: 12,
        border: '1px solid #ddd',
        borderRadius: 4,
        marginBottom: 8,
      }}
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Authorized representative for entity party {partyId.slice(0, 8)}…</legend>
        <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
          {currentSelection
            ? `Selected: ${currentSelection.slice(0, 8)}…`
            : 'No representative selected yet.'}
        </p>
        <label>
          Grant ID (UUID):{' '}
          <input
            type="text"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            style={{ minWidth: 320 }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (pending) onSelect(pending)
            setPending('')
          }}
          style={{ marginLeft: 8 }}
        >
          Set representative
        </button>
      </fieldset>
    </li>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 4 — Confirmation
// ═══════════════════════════════════════════════════════════════════════════

function ConfirmationStep({
  state,
  onBack,
  onSubmit,
  onSubmissionNoteChange,
}: {
  readonly state: ComposerState
  readonly onBack: () => void
  readonly onSubmit: () => void | Promise<void>
  readonly onSubmissionNoteChange: (note: string) => void
}) {
  const reason = submitIneligibleReason(state)
  const disabled = reason !== null
  return (
    <section aria-label="Confirm submission">
      <p style={{ marginTop: 0 }}>
        Review the package below. When you're ready, submit for broker
        review. No envelope will be created and no signers will be notified
        until the broker approves.
      </p>

      <section aria-label="Documents" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>Documents</h2>
        <p>{state.selectedDocumentIds.length} selected</p>
      </section>

      {state.preview ? (
        <>
          <RecipientGroup title="Signers" recipients={groupRecipientsByRole(state.preview).signers} />
          <RecipientGroup title="Witnesses and notaries" recipients={groupRecipientsByRole(state.preview).witnessesNotaries} />
          <RecipientGroup title="Observers and copy recipients" recipients={groupRecipientsByRole(state.preview).observersCc} />
          <DiagnosticsSection preview={state.preview} />
        </>
      ) : null}

      {state.previousPackageId ? (
        <section aria-label="Previous package" style={{ marginTop: 20 }}>
          <p style={{ color: '#666', fontSize: 13 }}>
            This submission revises previous package{' '}
            {state.previousPackageId.slice(0, 8)}….
          </p>
        </section>
      ) : null}

      <section aria-label="Submission note" style={{ marginTop: 20 }}>
        <label htmlFor="submission-note">Optional note to the broker</label>
        <textarea
          id="submission-note"
          rows={3}
          value={state.submissionNote ?? ''}
          onChange={(e) => onSubmissionNoteChange(e.target.value)}
          style={{ width: '100%', marginTop: 4 }}
        />
      </section>

      {disabled ? (
        <p role="status" style={{ color: '#a33', marginTop: 12 }}>
          {ineligibilityMessage(reason)}
        </p>
      ) : null}

      {state.submitError ? (
        <p role="alert" style={{ color: '#a33', marginTop: 12 }}>
          {submitErrorMessage(state.submitError.kind)}
        </p>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={onBack}>Back</button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          style={{ marginLeft: 8 }}
        >
          Submit for broker review
        </button>
      </div>
    </section>
  )
}

function ineligibilityMessage(reason: NonNullable<ReturnType<typeof submitIneligibleReason>>): string {
  switch (reason) {
    case 'no_documents_selected': return 'Please select at least one document.'
    case 'preview_missing': return 'Please review recipients first.'
    case 'preview_stale': return 'Please refresh recipients before submitting.'
    case 'preview_in_flight': return 'Please wait for the preview to finish.'
    case 'submit_in_flight': return 'Submitting…'
    case 'blocking_diagnostic': return 'Please resolve the blocking issues above.'
    case 'unresolved_user_action': return 'Please resolve the required actions above.'
    case 'empty_recipient_plan': return 'No recipients were derived — please review your selections.'
  }
}

function submitErrorMessage(kind: string): string {
  switch (kind) {
    case 'plan_version_not_enabled': return 'Signing setup is temporarily unavailable.'
    case 'unauthorized': return 'Your session has expired. Please sign in again.'
    case 'forbidden': return 'You are not authorized to submit this package.'
    case 'not_found': return 'The transaction could not be found.'
    case 'idempotency_conflict': return 'A concurrent submission is in progress. Please refresh.'
    case 'validation_error': return 'The submission was rejected. Please review and try again.'
    case 'invalid_response': return 'The server returned an unexpected response. Please try again.'
    case 'network': return 'A network error prevented submission. Please try again.'
    default: return 'Submission failed. Please try again.'
  }
}
