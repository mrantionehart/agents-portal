'use client'

// ============================================================================
// HARTFELT-READY-FINAL-1 — the comprehensive final exam (Agent Portal)
// ============================================================================
// Thin client over Vault's exam route. It renders what Vault says and nothing
// it decides itself: the lock state, the paper, and the graded result. There
// is no answer key here to leak — Vault projects stems and options only, and
// grades on the server.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

interface Option { id: string; label: string }
interface Question { id: string; prompt: string; options: Option[] }
interface MissingModule { volume: number; moduleNum: number; title: string | null }

interface Eligibility {
  baseCap: number
  extraGranted: number
  effectiveCap: number
  attemptsUsed: number
  attemptsRemaining: number
  mayAttempt: boolean
  passed: boolean
  needsBrokerGrant: boolean
}

interface ExamState {
  eligibility: Eligibility
  quiz_id: string
  quiz_version: string
  pass_score: number
  unlocked: boolean
  lock_reason: string | null
  required_modules: number
  passed_modules: number
  missing_modules: MissingModule[]
  final_exam: { attempted: boolean; bestScore: number | null; passed: boolean; attemptCount: number }
  hartfelt_ready_complete: boolean
  summary: string
  quiz: { title: string; instructions: string | null; questions: Question[] } | null
}

interface AttemptResult {
  kind: 'graded' | 'already_passed'
  pass_score: number
  result: Record<string, unknown>
}

export default function FinalExamPage() {
  const [state, setState] = useState<ExamState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<AttemptResult | null>(null)
  // One key per sitting, so a double-click or a flaky connection cannot
  // record two attempts for one paper.
  const [idempotencyKey] = useState(() =>
    `hrf-final-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/training/final-exam', { cache: 'no-store' })
      if (!res.ok) {
        setLoadError(res.status === 401 ? 'Please sign in again.' : 'Could not load the exam.')
        return
      }
      setState((await res.json()) as ExamState)
    } catch {
      setLoadError('Could not load the exam.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const questions = state?.quiz?.questions ?? []
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]).length,
    [questions, answers]
  )
  const allAnswered = questions.length > 0 && answeredCount === questions.length

  const submit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/training/final-exam', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers, idempotency_key: idempotencyKey }),
      })
      const body = await res.json()
      if (!res.ok) {
        setSubmitError(
          body?.error === 'attempt_cap_reached'
            ? `You have used all ${body.attempt_cap} attempts. Speak to your broker.`
            : body?.error === 'exam_locked'
            ? 'The exam locked before this was submitted. Reload to see what is outstanding.'
            : 'That submission was not accepted. Make sure every question is answered.'
        )
        return
      }
      setOutcome(body as AttemptResult)
      await load()
    } catch {
      setSubmitError('Could not submit. Your attempt was not recorded — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) return <Shell><Note tone="error">{loadError}</Note></Shell>
  if (!state) return <Shell><Note>Loading…</Note></Shell>

  if (outcome) {
    const r = outcome.result as { scorePercent?: number; passed?: boolean }
    const score = r.scorePercent ?? 0
    const passed = r.passed === true
    return (
      <Shell>
        <Note tone={passed ? 'ok' : 'error'}>
          <strong>{passed ? 'Passed' : 'Not passed'} — {score}%.</strong>{' '}
          {passed
            ? 'Your HartFelt Ready final assessment is on file. Your broker completes the certification.'
            : `You need ${outcome.pass_score}% to pass. Review the material and take it again.`}
        </Note>
        <p className="text-sm text-[#A1A1AA]">{state.summary}</p>
        <Link href="/training" className="text-sm text-[#C9A84C] underline">Back to Training</Link>
      </Shell>
    )
  }

  if (!state.unlocked) {
    return (
      <Shell>
        <Note>
          <strong>Locked.</strong> The comprehensive final opens once every required module quiz is
          passed — {state.passed_modules} of {state.required_modules} so far.
        </Note>
        {state.missing_modules.length > 0 && (
          <div className="text-sm text-[#A1A1AA]">
            <p className="mb-1">Still outstanding:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {state.missing_modules.map((m) => (
                <li key={`${m.volume}:${m.moduleNum}`}>
                  Volume {m.volume}, Module {m.moduleNum}{m.title ? ` — ${m.title}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link href="/training" className="text-sm text-[#C9A84C] underline">Back to Training</Link>
      </Shell>
    )
  }

  if (!state.eligibility.mayAttempt && !state.eligibility.passed) {
    // Out of attempts. The agent is told to speak to their broker — never
    // shown a broker control, and never told how to obtain one themselves.
    return (
      <Shell>
        <Note tone="error">
          <strong>No attempts remaining.</strong> You have used all{' '}
          {state.eligibility.effectiveCap} attempts at the final exam. Speak to your Broker of
          Record, who can authorize one additional attempt.
        </Note>
        <p className="text-sm text-[#A1A1AA]">
          Best score so far: {state.final_exam.bestScore ?? 0}%.
        </p>
        <Link href="/training" className="text-sm text-[#C9A84C] underline">Back to Training</Link>
      </Shell>
    )
  }

  if (state.final_exam.passed) {
    return (
      <Shell>
        <Note tone="ok">
          <strong>Already passed</strong> at {state.final_exam.bestScore}%. Nothing further to do —
          your broker completes the certification.
        </Note>
        <Link href="/training" className="text-sm text-[#C9A84C] underline">Back to Training</Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <Note>
        {state.quiz?.instructions}
        {state.final_exam.attempted && (
          <>
            {' '}Previous best: {state.final_exam.bestScore}% over {state.final_exam.attemptCount}{' '}
            attempt{state.final_exam.attemptCount === 1 ? '' : 's'}.
          </>
        )}
        {' '}You have {state.eligibility.attemptsRemaining} of {state.eligibility.effectiveCap}{' '}
        attempt{state.eligibility.attemptsRemaining === 1 ? '' : 's'} left.
        {state.eligibility.extraGranted > 0 && (
          <> This includes one additional attempt authorized by your broker.</>
        )}
      </Note>

      <ol className="space-y-5">
        {questions.map((q, idx) => (
          <li key={q.id} className="rounded-lg border border-[#2A2A31] bg-[#17171B] p-4">
            <p className="text-sm font-medium text-[#F1F1F3] mb-3">
              {idx + 1}. {q.prompt}
            </p>
            <div className="space-y-2">
              {q.options.map((o) => (
                <label key={o.id} className="flex items-start gap-2 text-sm text-[#D4D4D8] cursor-pointer">
                  <input
                    type="radio"
                    name={q.id}
                    value={o.id}
                    checked={answers[q.id] === o.id}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    className="mt-1"
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {submitError && <Note tone="error">{submitError}</Note>}

      <div className="flex items-center gap-3 sticky bottom-0 bg-[#0E0E11] py-3">
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered || submitting}
          className="rounded-md bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#15151A] disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Submit final exam'}
        </button>
        <span className="text-sm text-[#A1A1AA]">
          {answeredCount} of {questions.length} answered · {state.pass_score}% to pass
        </span>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold text-[#F1F1F3]">
          HartFelt Ready™ — Comprehensive Final Exam
        </h1>
      </header>
      {children}
    </div>
  )
}

function Note({ children, tone }: { children: React.ReactNode; tone?: 'ok' | 'error' }) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-200'
      : tone === 'error'
      ? 'border-rose-700/40 bg-rose-900/20 text-rose-200'
      : 'border-[#2A2A31] bg-[#17171B] text-[#D4D4D8]'
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>
}
