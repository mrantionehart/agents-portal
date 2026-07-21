'use client'

// PILOT-FEEDBACK-001 — Pilot cohort feedback form (client component)
//
// Clean, minimal, non-leading. Every question is optional. The submit
// button is only enabled once at least one answer or a rating is
// present, and it disables during network I/O so double-taps don't
// produce duplicate rows.

import { useMemo, useState } from 'react'

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

export function FeedbackFormClient() {
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')
  const [q4, setQ4] = useState('')
  const [q5, setQ5] = useState<number | null>(null)
  const [q6, setQ6] = useState('')
  const [state, setState] = useState<SubmitState>({ kind: 'idle' })

  const hasAnyAnswer = useMemo(
    () =>
      q1.trim().length > 0 ||
      q2.trim().length > 0 ||
      q3.trim().length > 0 ||
      q4.trim().length > 0 ||
      q6.trim().length > 0 ||
      q5 != null,
    [q1, q2, q3, q4, q5, q6],
  )

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!hasAnyAnswer) return
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/api/pilot-feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          q1_first_action: q1 || null,
          q2_confusing: q2 || null,
          q3_stuck: q3 || null,
          q4_improve: q4 || null,
          q5_experience_rating: q5,
          q6_anything_else: q6 || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setState({
          kind: 'error',
          message: (body && typeof body.error === 'string' ? body.error : null) ??
            'Something went wrong. Please try again.',
        })
        return
      }
      setState({ kind: 'success' })
    } catch {
      setState({ kind: 'error', message: 'Network error. Please try again.' })
    }
  }

  if (state.kind === 'success') {
    return (
      <div className="rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/5 p-6">
        <p className="text-[15px] text-[#F1F1F3]">
          Thanks for the feedback — every note helps.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" data-testid="pilot-feedback-form">
      <Field label="Without any help, what did you think you were supposed to do first?">
        <textarea
          value={q1}
          onChange={(e) => setQ1(e.target.value)}
          rows={3}
          className={textareaCls}
          data-testid="q1_first_action"
        />
      </Field>

      <Field label="Was anything confusing or unclear?">
        <textarea
          value={q2}
          onChange={(e) => setQ2(e.target.value)}
          rows={3}
          className={textareaCls}
          data-testid="q2_confusing"
        />
      </Field>

      <Field label="Did you get stuck anywhere? If yes, where?">
        <textarea
          value={q3}
          onChange={(e) => setQ3(e.target.value)}
          rows={3}
          className={textareaCls}
          data-testid="q3_stuck"
        />
      </Field>

      <Field label="If you could improve one thing, what would it be?">
        <textarea
          value={q4}
          onChange={(e) => setQ4(e.target.value)}
          rows={3}
          className={textareaCls}
          data-testid="q4_improve"
        />
      </Field>

      <Field label="Overall onboarding experience (1–10)">
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={q5 === n}
              onClick={() => setQ5(q5 === n ? null : n)}
              data-testid={`q5_rating_${n}`}
              className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
                q5 === n
                  ? 'bg-[#C9A84C] text-black border-[#C9A84C]'
                  : 'border-[#2a2a3a] text-[#A1A1AA] hover:border-[#C9A84C]/60 hover:text-[#F1F1F3]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Anything else you'd like us to know?">
        <textarea
          value={q6}
          onChange={(e) => setQ6(e.target.value)}
          rows={4}
          className={textareaCls}
          data-testid="q6_anything_else"
        />
      </Field>

      {state.kind === 'error' && (
        <p className="text-sm text-red-400" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!hasAnyAnswer || state.kind === 'submitting'}
          className={`
            inline-flex items-center rounded-md bg-[#C9A84C] px-5 py-2.5
            text-sm sm:text-[15px] font-semibold text-black hover:brightness-95
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
          data-testid="pilot-feedback-submit"
        >
          {state.kind === 'submitting' ? 'Submitting…' : 'Submit feedback'}
        </button>
        <p className="text-xs text-[#71717A]">Every question is optional.</p>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#F1F1F3]">{label}</span>
      {children}
    </label>
  )
}

const textareaCls =
  'mt-2 w-full rounded-md border border-[#2a2a3a] bg-[#0e0e13] px-3 py-2 text-sm text-[#F1F1F3] placeholder-[#555] focus:border-[#C9A84C]/60 focus:outline-none'
