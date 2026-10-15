'use client'

// ============================================================================
// Your Compensation — the agent's own terms (HFOS-P1)
// ============================================================================
// Purely presentational. Every figure here is rendered VERBATIM from Vault's
// /api/agents/me/compensation, which derives them from the same resolutions
// /api/commissions/calculate uses. This component performs no arithmetic on
// money — not a split, not a cap remainder, not a percentage — because a
// second calculation is a second answer, and the Portal already shipped one
// bug of exactly that shape (agent_amount computed with a third formula and
// no transaction fee). If a number is missing, it says so rather than
// substituting a default.
// ============================================================================

export interface CompensationPlan {
  tier: string
  tierLabel: string
  agentSplitPct: number
  brokerageSplitPct: number
  transactionFee: number
  annualCap: number
  /** HFOF-P1 — 'override' when a broker-authorized custom split is in force.
   *  agentSplitPct/brokerageSplitPct above are ALWAYS the effective figures. */
  splitSource?: 'tier' | 'override'
  /** Set when a percentage sits on the profile but did NOT apply. */
  splitOverrideRefusal?: string | null
  splitRequestedPct?: number | null
  waiver: {
    monthsTotal: number | null
    lastWaivedMonth: string | null
    source: string
    activeThisMonth: boolean
    billingStartsMonth: string | null
  }
}

export interface CapProgress {
  cap_year: number
  annual_cap: number
  total_contributed: number
  remaining_to_cap: number
  cap_reached: boolean
  progress_pct: number | null
  source: string
}

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

function Field({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className="text-xl font-semibold text-white">{value}</dd>
      {note && <p className="text-xs text-zinc-500 mt-0.5">{note}</p>}
    </div>
  )
}

export default function CompensationTerms({
  plan,
  capProgress,
  error,
}: {
  plan: CompensationPlan | null
  capProgress: CapProgress | null
  error?: string | null
}) {
  if (error) {
    return (
      <div className="bg-[#0a0a0f] border border-zinc-800 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-1">Your Compensation</h3>
        <p className="text-sm text-yellow-400">{error}</p>
      </div>
    )
  }
  if (!plan) return null

  const isFounding = plan.tier === 'founding'
  const waiver = plan.waiver

  return (
    <section
      aria-label="Your compensation terms"
      className="bg-[#0a0a0f] border border-zinc-800 rounded-lg p-6 mb-8"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-white">Your Compensation</h3>
        {plan.splitSource === 'override' && (
          <span
            data-testid="override-badge"
            className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30"
          >
            Custom split
          </span>
        )}
        <span
          data-testid="tier-badge"
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isFounding
              ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
              : 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
          }`}
        >
          {plan.tierLabel}
        </span>
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field
          label="Your split"
          value={`${plan.agentSplitPct}% / ${plan.brokerageSplitPct}%`}
          note={
            plan.splitSource === 'override'
              ? 'you / brokerage · custom split'
              : 'you / brokerage'
          }
        />
        <Field label="Transaction fee" value={usd(plan.transactionFee)} note="per closing" />
        <Field
          label="Annual cap"
          value={usd(plan.annualCap)}
          note={capProgress ? `${capProgress.cap_year} plan year` : undefined}
        />
        <Field
          label="Monthly fee waiver"
          value={waiver.activeThisMonth ? 'Active' : waiver.lastWaivedMonth ? 'Ended' : 'None'}
          note={
            waiver.activeThisMonth
              ? waiver.lastWaivedMonth
                ? `through ${waiver.lastWaivedMonth}`
                : undefined
              : waiver.billingStartsMonth
                ? `billing began ${waiver.billingStartsMonth}`
                : undefined
          }
        />
      </dl>

      {capProgress && (
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-zinc-400">
              Cap progress — {usd(capProgress.total_contributed)} contributed
            </span>
            <span className="text-zinc-400">
              {capProgress.cap_reached
                ? 'Cap met'
                : `${usd(capProgress.remaining_to_cap)} to cap`}
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              data-testid="cap-bar"
              className={capProgress.cap_reached ? 'h-2 bg-green-500' : 'h-2 bg-blue-500'}
              // progress_pct is Vault's figure. null means uncapped, which is
              // an empty bar, not 100%.
              style={{ width: `${Math.max(0, Math.min(100, capProgress.progress_pct ?? 0))}%` }}
            />
          </div>
        </div>
      )}

      {plan.splitOverrideRefusal === 'not_authorized' && plan.splitRequestedPct != null && (
        <p data-testid="override-pending" className="text-xs text-amber-400 mt-4">
          A custom split of {plan.splitRequestedPct}% is on file but has not been
          authorized by your broker, so your {plan.tierLabel} rate applies.
        </p>
      )}

      <p className="text-xs text-zinc-500 mt-4">
        These are the terms your brokerage has on file. Figures come from
        HartFelt Vault and are the same ones used to calculate your commissions.
      </p>
    </section>
  )
}
