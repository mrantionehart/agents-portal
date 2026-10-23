'use client'

// ============================================================================
// P4H-13 — the automatic compliance review, as the agent reads it
// ============================================================================
// It runs automatically: on mount (after generation, which is when the drawer
// shows a generated document) and whenever `refreshKey` changes, which the
// submit-for-approval action bumps. There is no "run review" button, because a
// review an agent has to remember to run is a review that does not happen.
//
// WHAT IT CALLS IT MATTERS. Every finding shown here is DETERMINISTIC — field
// coverage from Vault's existing requirements engine plus explicit cross-field
// checks. None of it is a model's opinion, so none of it is labelled as one.
// If Vault ever attaches its optional semantic advisor, those findings arrive
// as `kind: 'judgment'` and are shown under their own heading as advisory.
// Calling rule output "AI review" would misrepresent what an agent is reading
// and what it is worth.
//
// The verdict is Vault's. This renders it and never recomputes it: a second
// opinion computed in the browser is a second opinion that can disagree with
// the one the broker sees.
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2 } from 'lucide-react'

import { authFetch } from '@/lib/supabase'

type Verdict = 'pass' | 'needs_correction' | 'manual_review'
type FindingKind = 'blocking' | 'advisory' | 'judgment'

interface Finding {
  code: string
  kind: FindingKind
  label: string
  detail: string
  path?: string
}

interface Review {
  verdict: Verdict
  findings: Finding[]
  submittable: boolean
  disclaimer: string
}

interface Props {
  transactionId: string
  formInstanceId: string | null
  /** The form under review. The panel renders nothing for a form Vault will
   *  not review, rather than showing an empty result that reads as a pass. */
  formId: string | null
  /** Bumped by the caller after a save or a submit, to re-run the review. */
  refreshKey?: number
  /** Told the parent whether submission is allowed, so the Submit control and
   *  this panel cannot disagree about it. */
  onSubmittableChange?: (submittable: boolean) => void
}

const REVIEWABLE_FORM_IDS = ['ERL-14']

const VERDICT_COPY: Record<Verdict, { title: string; tone: string; Icon: typeof CheckCircle2 }> = {
  pass: {
    title: 'Checks passed',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    Icon: CheckCircle2,
  },
  needs_correction: {
    title: 'Needs correction before you can submit',
    tone: 'border-red-500/40 bg-red-500/10 text-red-200',
    Icon: AlertTriangle,
  },
  manual_review: {
    title: 'Ready to submit — your broker will need to look at something',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    Icon: HelpCircle,
  },
}

const KIND_HEADING: Record<FindingKind, string> = {
  blocking: 'Must be fixed',
  advisory: 'Worth checking',
  judgment: "For your broker's judgment",
}

export default function ComplianceReviewPanel({
  transactionId,
  formInstanceId,
  formId,
  refreshKey = 0,
  onSubmittableChange,
}: Props) {
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reviewable = !!formId && REVIEWABLE_FORM_IDS.includes(formId)

  const load = useCallback(async () => {
    if (!formInstanceId || !reviewable) return
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(
        `/api/paperwork/compliance-review/${transactionId}/${formInstanceId}`,
        {},
        20000,
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'Could not run the checks.')
        setReview(null)
        // A review that could not run must not read as permission to submit.
        onSubmittableChange?.(false)
        return
      }
      setReview(body.review as Review)
      onSubmittableChange?.(!!body.review?.submittable)
    } catch {
      setError('Could not run the checks.')
      setReview(null)
      onSubmittableChange?.(false)
    } finally {
      setLoading(false)
    }
  }, [transactionId, formInstanceId, reviewable, onSubmittableChange])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  if (!reviewable || !formInstanceId) return null

  if (loading && !review) {
    return (
      <section
        data-testid="compliance-review"
        className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4"
      >
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Running checks…
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <section
        data-testid="compliance-review"
        className="rounded-lg border border-red-500/40 bg-red-500/10 p-4"
      >
        <p className="text-sm text-red-200">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 rounded border border-red-500/50 px-2 py-1 text-xs text-red-100"
        >
          Try again
        </button>
      </section>
    )
  }

  if (!review) return null

  const copy = VERDICT_COPY[review.verdict]
  const groups: FindingKind[] = ['blocking', 'judgment', 'advisory']

  return (
    <section data-testid="compliance-review" className="space-y-3">
      <div className={`flex items-start gap-2 rounded-lg border p-3 ${copy.tone}`}>
        <copy.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <h4 className="text-sm font-semibold" data-testid="review-verdict">
            {copy.title}
          </h4>
          {/* Vault's wording, rendered verbatim so the Portal and Vault cannot
              describe the same result differently. */}
          <p className="mt-1 text-xs opacity-90" data-testid="review-disclaimer">
            {review.disclaimer}
          </p>
        </div>
      </div>

      {groups.map((kind) => {
        const items = review.findings.filter((f) => f.kind === kind)
        if (items.length === 0) return null
        return (
          <div key={kind} data-testid={`review-group-${kind}`}>
            <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {KIND_HEADING[kind]}
            </h5>
            <ul className="space-y-1">
              {items.map((f) => (
                <li
                  key={f.code}
                  data-testid="review-finding"
                  className="rounded border border-zinc-700 bg-zinc-900/40 p-2 text-xs"
                >
                  <span className="font-medium text-zinc-100">{f.label}</span>
                  <span className="block text-zinc-400">{f.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
