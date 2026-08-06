'use client'

// ============================================================================
// Marketing Card — dashboard readiness prompt
// ============================================================================
// A small dismissible card below the greeting that nudges an agent to finish
// the info their broker needs before a marketing card can be generated. It
// mirrors BirthdayPrompt: loads AFTER the shell renders, never blocks the page,
// fails silently, and hides itself when there is nothing left to do.
//
// It adds NO backend. It reuses the existing companion contract
// getMarketingProfile() (GET /api/agent/marketing-profile via the canonical
// cached-bearer authFetch). The browser NEVER computes readiness — it only
// renders the server-owned `missingRequirements`.
//
// Visibility: shown ONLY when there are outstanding setup requirements
// (`missingRequirements.length > 0`). That is a strict subset of
// "readiness != ready_to_generate": it hides on ready_to_generate AND on cards
// that are already generated/approved/needs_regeneration (empty requirements) —
// so an agent whose card is already done is never nagged.
//
// Dismissal: a session-scoped snooze (sessionStorage) — no dismiss endpoint
// exists and none may be added in this slice, so the snooze is client-only.
// Dismissing hides it until the next browser session; it also disappears the
// moment readiness is complete, regardless of snooze.
// ============================================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IdCard } from 'lucide-react'
import { getMarketingProfile } from '@/src/portal/marketing-profile/api'

const SNOOZE_KEY = 'hf_marketing_card_prompt_dismissed'

/** Server-owned requirement keys → short, friendly agent-facing labels. */
const REQUIREMENT_LABELS: Record<string, string> = {
  headshot: 'Add a headshot',
  preferred_public_phone: 'Add your public phone',
  license_number: 'Add your license',
  brokerage_email: 'Add your brokerage email',
  name: 'Add your name',
  onboarding: 'Complete onboarding',
}

function labelFor(requirement: string): string {
  return REQUIREMENT_LABELS[requirement] ?? 'Complete your profile'
}

function isSnoozed(): boolean {
  try {
    return sessionStorage.getItem(SNOOZE_KEY) === '1'
  } catch {
    return false // storage blocked → treat as not snoozed
  }
}

type Phase = 'loading' | 'hidden' | 'prompt'

export default function MarketingCardPrompt() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [missing, setMissing] = useState<string[]>([])

  // Load state after mount. Any failure → hide (fail silently, never block).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const state = await getMarketingProfile()
        if (cancelled) return
        const requirements = state.marketingCard?.missingRequirements ?? []
        // Nothing outstanding (ready_to_generate / generated / approved) → hide.
        if (requirements.length === 0) {
          setPhase('hidden')
          return
        }
        if (isSnoozed()) {
          setPhase('hidden')
          return
        }
        setMissing(requirements)
        setPhase('prompt')
      } catch {
        if (!cancelled) setPhase('hidden') // ineligible / network / non-contract
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(SNOOZE_KEY, '1')
    } catch {
      /* non-fatal: still hide for this render */
    }
    setPhase('hidden')
  }

  if (phase === 'loading' || phase === 'hidden') return null

  // De-duplicate while preserving order (defensive against repeated keys).
  const items = Array.from(new Set(missing))

  return (
    <section
      aria-label="Complete your marketing card"
      className="mb-6 rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5"
    >
      <div className="flex items-center gap-2">
        <IdCard className="h-4 w-4 text-[#C9A84C]" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-wide text-[#F1F1F3]">Complete Your Marketing Card</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
        Finish your profile so your broker can generate your marketing card.
      </p>

      <ul className="mt-3 space-y-1.5">
        {items.map((requirement) => (
          <li key={requirement} className="flex items-center gap-2 text-sm text-[#F1F1F3]">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
            {labelFor(requirement)}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/profile"
          className="rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#0a0a0f] transition hover:bg-[#d8ba61] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
        >
          Complete Now
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-4 py-2 text-sm font-medium text-[#A1A1AA] transition hover:text-[#F1F1F3] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20"
        >
          Maybe Later
        </button>
      </div>
    </section>
  )
}
