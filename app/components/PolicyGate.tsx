'use client'

// ============================================================================
// A4 — Policy acknowledgment gate (Agent Portal)
// ============================================================================
// Replaces the legacy `/dashboard`-only modal, which failed open in four
// places: a failed insert still counted as accepted; a localStorage flag was
// treated as proof; only role `agent` was asked; and it sat on `/dashboard`
// while login lands on `/home`.
//
// 🔒 The server is the only proof. An item leaves the list only after Vault
//    answers 201/200 `{ok:true}` to the accept POST, and the list is then
//    re-read from Vault. No client storage is read or written.
// 🔒 Fail closed. If `required` cannot be read (503, network, garbage) the
//    user sees "We couldn't verify your policy acknowledgments" with Retry —
//    never "nothing required".
// 🔑 Every role. Whatever Vault returns is shown; the client never filters.
// 🔑 Mounted once, in the root layout, for every authenticated path
//    (`PolicyGateMount`), so `/home`, `/workspace/*`, `/transactions/new` and
//    the legacy routes are all covered.
// 🛑 Enforcement is OFF (`POLICY_ACK_ENFORCEMENT`): the prompt can be
//    dismissed for the session and blocks nothing.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

import { useAuth } from '../providers'
import {
  acceptPolicy,
  fetchRequiredPolicies,
  safeDocumentUrl,
  shortHash,
  type RequiredPolicy,
} from '@/lib/policies/client'
import { POLICY_ACK_ENFORCEMENT } from '@/lib/policies/enforcement'

type GateState =
  | { status: 'loading' }
  | { status: 'hidden' }
  | { status: 'error' }
  | { status: 'loaded'; required: RequiredPolicy[] }

function refusalMessage(status: number, refusal: string | null): string {
  if (status === 409 && refusal === 'stale_document') {
    return 'This policy document was updated after it was shown to you. Please review the current version and acknowledge again.'
  }
  if (status === 409 && refusal === 'not_effective') {
    return 'This policy version is not in effect yet. The list has been refreshed.'
  }
  if (status === 403 && refusal === 'not_in_audience') {
    return 'This policy does not apply to your role. The list has been refreshed.'
  }
  if (status === 404) {
    return 'This policy version could not be found. The list has been refreshed.'
  }
  if (status === 401) {
    return 'Your session may have expired. Please sign in again, then acknowledge.'
  }
  return "Your acknowledgment was not recorded. Nothing was saved — please try again."
}

/** Refusals after which the server's list is the only truth worth showing. */
function shouldRefetch(status: number, refusal: string | null): boolean {
  return status === 409 || status === 404 || (status === 403 && refusal === 'not_in_audience')
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function PolicyItem({
  policy,
  error,
  onAccepted,
  onRefused,
}: {
  policy: RequiredPolicy
  error: string | null
  onAccepted: (policy: RequiredPolicy) => void
  onRefused: (policy: RequiredPolicy, status: number, refusal: string | null) => void
}) {
  const [affirmed, setAffirmed] = useState(false)
  const [checkedSections, setCheckedSections] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)

  // A new version (new id / new hash) starts unchecked: an affirmation is
  // for the exact document shown, not for the policy in general.
  useEffect(() => {
    setAffirmed(false)
    setCheckedSections({})
  }, [policy.id, policy.document_sha256])

  const docUrl = safeDocumentUrl(policy.document_url)
  const allSectionsChecked = policy.sections.every((s) => checkedSections[s.key])
  const canSubmit = affirmed && allSectionsChecked && docUrl !== null && !submitting
  const effective = formatDate(policy.effective_at)
  const ackBy = formatDate(policy.acknowledge_by)
  const headingId = `policy-${policy.id}-title`

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    const result = await acceptPolicy(
      policy,
      policy.sections.filter((s) => checkedSections[s.key]).map((s) => s.key),
    )
    setSubmitting(false)
    if (result.ok) {
      onAccepted(policy)
      return
    }
    if (result.status === 409 && result.refusal === 'stale_document') {
      // The text changed under them: the affirmation no longer applies.
      setAffirmed(false)
      setCheckedSections({})
    }
    onRefused(policy, result.status, result.refusal)
  }

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`policy-item-${policy.policy_key}`}
      className="border border-[#1a1a2e] rounded-lg p-4 bg-[#050507]"
    >
      <h3 id={headingId} className="text-base font-semibold text-white">
        {policy.title}
      </h3>
      <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs text-[#A1A1AA]">
        <dt>Version</dt>
        <dd data-testid="policy-version" className="text-white">{policy.version}</dd>
        <dt>Document hash</dt>
        <dd className="min-w-0">
          <details>
            <summary className="cursor-pointer">
              <code data-testid="policy-short-hash" className="text-white">{shortHash(policy.document_sha256)}</code>
            </summary>
            <code className="block break-all text-[11px]">{policy.document_sha256}</code>
          </details>
        </dd>
        {effective && (
          <>
            <dt>Effective</dt>
            <dd>{effective}</dd>
          </>
        )}
        {ackBy && (
          <>
            <dt>Acknowledge by</dt>
            <dd>{ackBy}</dd>
          </>
        )}
      </dl>

      {policy.material_change && (
        <p className="mt-2 text-xs text-amber-300">This version changes material terms.</p>
      )}

      <div className="mt-3">
        {docUrl ? (
          <a
            href={docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-red-400 underline"
          >
            Read the full document ({policy.title}, version {policy.version})
          </a>
        ) : (
          <p className="text-sm text-amber-300">
            The document for this policy is not available, so it cannot be acknowledged yet.
          </p>
        )}
      </div>

      {policy.sections.length > 0 && (
        <fieldset className="mt-3 space-y-1">
          <legend className="text-xs text-[#A1A1AA]">Sections</legend>
          {policy.sections.map((s) => (
            <label key={s.key} className="flex items-start gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={!!checkedSections[s.key]}
                onChange={(e) => setCheckedSections((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                disabled={submitting}
              />
              <span>I have read the section “{s.title}”</span>
            </label>
          ))}
        </fieldset>
      )}

      <label className="mt-3 flex items-start gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={affirmed}
          onChange={(e) => setAffirmed(e.target.checked)}
          disabled={submitting}
        />
        <span>
          I have read and acknowledge {policy.title}, version {policy.version}.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-3 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? 'Recording…' : 'Acknowledge'}
      </button>
    </section>
  )
}

export default function PolicyGate() {
  const [state, setState] = useState<GateState>({ status: 'loading' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dismissed, setDismissed] = useState(false)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const mine = ++seq.current
    setState((s) => (s.status === 'loaded' ? s : { status: 'loading' }))
    const result = await fetchRequiredPolicies()
    if (mine !== seq.current) return
    if (result.kind === 'loaded') setState({ status: 'loaded', required: result.required })
    else if (result.kind === 'error') setState({ status: 'error' })
    else setState({ status: 'hidden' })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onAccepted = useCallback(
    (policy: RequiredPolicy) => {
      // Vault recorded it (201/200 ok). Drop it, then re-read the list —
      // the server, not this component, says what is still owed.
      setErrors((e) => {
        const next = { ...e }
        delete next[policy.policy_key]
        return next
      })
      setState((s) =>
        s.status === 'loaded' ? { status: 'loaded', required: s.required.filter((p) => p.id !== policy.id) } : s,
      )
      void load()
    },
    [load],
  )

  const onRefused = useCallback(
    (policy: RequiredPolicy, status: number, refusal: string | null) => {
      setErrors((e) => ({ ...e, [policy.policy_key]: refusalMessage(status, refusal) }))
      if (shouldRefetch(status, refusal)) void load()
    },
    [load],
  )

  const dismissible = !POLICY_ACK_ENFORCEMENT

  if (state.status === 'loading' || state.status === 'hidden') return null

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        data-testid="policy-gate-error"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md z-[60] rounded-lg border border-amber-500/40 bg-[#0a0a0f] p-4 text-sm text-white shadow-2xl"
      >
        <p className="font-semibold">We couldn&apos;t verify your policy acknowledgments.</p>
        <p className="mt-1 text-[#A1A1AA]">
          Your acknowledgments may still be owed. Please retry; if this continues, contact the office.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-md bg-red-600 text-white"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const owed = state.required
  if (owed.length === 0) return null

  if (dismissed && dismissible) {
    return (
      <div
        role="status"
        data-testid="policy-gate-banner"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md z-[60] rounded-lg border border-red-500/40 bg-[#0a0a0f] p-3 text-sm text-white shadow-2xl flex items-center justify-between gap-3"
      >
        <span>
          {owed.length === 1
            ? '1 policy acknowledgment is pending.'
            : `${owed.length} policy acknowledgments are pending.`}
        </span>
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="px-3 py-1.5 rounded-md bg-red-600 text-white shrink-0"
        >
          Review now
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-gate-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-[#0a0a0f] border border-[#1a1a2e] p-5 shadow-2xl"
      >
        <h2 id="policy-gate-title" className="text-lg font-bold text-white">
          Policy acknowledgment required
        </h2>
        <p className="mt-1 text-sm text-[#A1A1AA]">
          Please review each document below and acknowledge it. Your acknowledgment is recorded only
          when you press Acknowledge.
        </p>
        <div className="mt-4 space-y-4">
          {owed.map((p) => (
            <PolicyItem
              key={p.id}
              policy={p}
              error={errors[p.policy_key] ?? null}
              onAccepted={onAccepted}
              onRefused={onRefused}
            />
          ))}
        </div>
        {dismissible && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 rounded-md border border-[#1a1a2e] text-sm text-[#A1A1AA]"
            >
              Remind me later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Mirrors middleware.ts STEP 1, plus /pending-activation (inactive accounts are
// owned by the standing gate, and Vault would 403 them anyway).
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/logout', '/pending-activation']
const PUBLIC_PREFIXES = ['/card/', '/client/', '/portal/']

export function isPolicyGatedPath(pathname: string | null): boolean {
  if (!pathname) return false
  if (PUBLIC_PATHS.includes(pathname)) return false
  return !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

/**
 * Mounted once in the root layout. Renders the gate for any signed-in user on
 * any authenticated path. Role is deliberately not consulted.
 */
export function PolicyGateMount() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  if (loading || !user || !isPolicyGatedPath(pathname)) return null
  // Keyed by user so a sign-out/sign-in as someone else never shows the
  // previous user's state.
  return <PolicyGate key={user.id} />
}
