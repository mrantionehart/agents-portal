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

/**
 * HARTFELT-CAP-DASHBOARD-FINAL-1 — Vault's authoritative cap block, served by
 * /api/agents/me/compensation. Every figure is Vault's; this component does no
 * cap arithmetic, so the Portal cannot disagree with the Vault card or the
 * statement.
 *
 * `actual_unavailable` means the receipt read FAILED. The verified figures are
 * then null and we show an error — we never substitute the projected balance,
 * because a forecast in the earned slot is the defect this replaces.
 */
export interface CapBlock {
  cap_year: number
  annual_cap: number
  verified_contributions: number | null
  remaining_annual_cap: number | null
  projected_contributions: number
  projected_not_yet_credited: number | null
  cap_reached_actual: boolean | null
  awaiting_verification_count: number
  awaiting_verification_amount: number
  last_verified_at: string | null
  actual_unavailable: boolean
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

/**
 * Bar width, rounded to one decimal. An unrounded ratio renders as
 * `7.199999999999999%` in the DOM, which is noise in a style attribute.
 */
const pctWidth = (part: number, whole: number) =>
  whole > 0 ? Math.round(Math.max(0, Math.min(100, (part / whole) * 100)) * 10) / 10 : 0

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
  cap,
  error,
}: {
  plan: CompensationPlan | null
  capProgress: CapProgress | null
  /** Vault's authoritative projected-vs-actual block. Preferred when present. */
  cap?: CapBlock | null
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

      {cap ? (
        <div className="mt-6 space-y-3" data-testid="cap-block">
          {/* Verified Cap Contributions — the only earned figure. */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-zinc-300">
                Verified Cap Contributions —{' '}
                <span data-testid="cap-verified" className="font-semibold">
                  {cap.verified_contributions != null
                    ? usd(cap.verified_contributions)
                    : '—'}
                </span>
              </span>
              <span className="text-zinc-400">
                Remaining Annual Cap{' '}
                <span data-testid="cap-remaining" className="font-semibold">
                  {cap.remaining_annual_cap != null
                    ? usd(cap.remaining_annual_cap)
                    : '—'}
                </span>
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                data-testid="cap-bar"
                className={cap.cap_reached_actual ? 'h-2 bg-green-500' : 'h-2 bg-blue-500'}
                // Tracks VERIFIED money only. An unreadable or absent figure is
                // an empty bar, never a full one.
                style={{
                  width:
                    cap.verified_contributions != null && cap.annual_cap > 0
                      ? `${pctWidth(cap.verified_contributions, cap.annual_cap)}%`
                      : '0%',
                }}
              />
            </div>
            {cap.last_verified_at && (
              <p className="text-xs text-zinc-500 mt-1">
                Last verified {new Date(cap.last_verified_at).toLocaleDateString()}.
              </p>
            )}
          </div>

          {cap.actual_unavailable && (
            <p data-testid="cap-unavailable" className="text-xs text-amber-400">
              We couldn&apos;t read your verified contributions, so none are
              shown. The projected figure below is a forecast and is not a
              substitute for it.
            </p>
          )}

          {/* Projected — Not Yet Credited, and what is waiting on the broker. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <p className="text-xs text-zinc-500">Projected — Not Yet Credited</p>
              <p data-testid="cap-projected" className="text-sm font-semibold text-zinc-200">
                {usd(cap.projected_not_yet_credited ?? cap.projected_contributions)}
              </p>
              <p className="text-xs text-zinc-500">
                Forecast only — does not count toward your cap.
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <p className="text-xs text-zinc-500">Awaiting Receipt Verification</p>
              <p data-testid="cap-awaiting" className="text-sm font-semibold text-zinc-200">
                {usd(cap.awaiting_verification_amount)}
              </p>
              <p className="text-xs text-zinc-500">
                {cap.awaiting_verification_count} receipt
                {cap.awaiting_verification_count === 1 ? '' : 's'} with your broker.
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Only commission receipts your broker has verified count toward the{' '}
            {cap.cap_year} cap.
          </p>
        </div>
      ) : capProgress ? (
        // No `cap` block from Vault (an older response). Show the projected
        // figure LABELLED as projected rather than as "contributed" — the
        // previous wording presented a forecast as earned money.
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-zinc-400">
              Projected cap progress — {usd(capProgress.total_contributed)} projected
            </span>
            <span className="text-zinc-400">
              {usd(capProgress.remaining_to_cap)} to cap (forecast)
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              data-testid="cap-bar"
              className="h-2 bg-zinc-600"
              style={{ width: `${Math.max(0, Math.min(100, capProgress.progress_pct ?? 0))}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Forecast only — verified contributions were not available.
          </p>
        </div>
      ) : null}

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
