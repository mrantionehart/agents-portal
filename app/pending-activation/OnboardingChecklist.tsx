// The joining agent's own onboarding steps, as Vault projects them
// (GET /api/onboarding/my-status). Presentational only — Vault decides every
// state and every word of detail; this renders them.

export type StepState = 'done' | 'in_progress' | 'waiting'
export interface OnboardingStep {
  key: string
  label: string
  state: StepState
  detail: string
}

const MARK: Record<StepState, { glyph: string; cls: string; sr: string }> = {
  done: { glyph: '✓', cls: 'bg-emerald-500/20 text-emerald-300', sr: 'Done' },
  in_progress: { glyph: '•', cls: 'bg-amber-500/20 text-amber-300', sr: 'In progress' },
  waiting: { glyph: '○', cls: 'bg-zinc-700/40 text-zinc-400', sr: 'Not started' },
}

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const next = steps.find((s) => s.state !== 'done')
  return (
    <section aria-label="Your onboarding steps" className="mt-6 text-left">
      {next && (
        <p className="text-sm text-white mb-3" data-testid="onboarding-next">
          <span className="text-zinc-400">Next: </span>
          {next.detail}
        </p>
      )}
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="flex gap-3 items-start" data-testid={`step-${s.key}`} data-state={s.state}>
            <span aria-hidden className={`inline-flex w-6 h-6 shrink-0 items-center justify-center rounded-full text-xs ${MARK[s.state].cls}`}>
              {MARK[s.state].glyph}
            </span>
            <div>
              <p className="text-sm text-white">
                {s.label} <span className="sr-only">({MARK[s.state].sr})</span>
              </p>
              <p className="text-xs text-zinc-400">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
