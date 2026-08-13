'use client'

// ============================================================================
// Commission Payouts — dashboard readiness prompt
// ============================================================================
// A small dismissible card below the greeting nudging an agent to finish Stripe
// payout setup so they're ready to receive electronic commission payments. It
// mirrors MarketingCardPrompt: loads AFTER the shell renders, never blocks,
// fails silently, and hides itself when there is nothing to do.
//
// It adds NO backend. It reads the server-owned readiness from the EXISTING
// Vault GET /api/stripe/connect (canonical cached-bearer authFetch). The browser
// NEVER computes readiness — it only renders the server `readiness`.
//
// Visibility: shown ONLY when there is an actionable, connectable next step
// (readiness ∈ not_started | incomplete | pending_verification). It hides on
// `ready` (done), on `not_configured` (payouts not enabled on the brokerage),
// and on any error/loading — so a payout-ready agent is never nagged.
//
// Dismissal: a session-scoped snooze (sessionStorage), client-only.
// ============================================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { authFetch } from '@/lib/supabase'

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? 'https://vault.hartfeltrealestate.com/api'
).replace(/\/$/, '')

const SNOOZE_KEY = 'hf_payout_readiness_prompt_dismissed'

/** Readiness states that warrant a prompt (an actionable next step exists). */
const ACTIONABLE = new Set(['not_started', 'incomplete', 'pending_verification'])

function isSnoozed(): boolean {
  try {
    return sessionStorage.getItem(SNOOZE_KEY) === '1'
  } catch {
    return false
  }
}

type Phase = 'loading' | 'hidden' | 'prompt'

export default function PayoutReadinessPrompt() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [readiness, setReadiness] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch(`${VAULT_API_URL}/stripe/connect`, { method: 'GET' })
        if (cancelled) return
        if (!res.ok) {
          setPhase('hidden')
          return
        }
        const data = (await res.json()) as { readiness?: string }
        const r = data.readiness ?? ''
        // ready / not_configured / unknown → nothing to prompt.
        if (!ACTIONABLE.has(r) || isSnoozed()) {
          setPhase('hidden')
          return
        }
        setReadiness(r)
        setPhase('prompt')
      } catch {
        if (!cancelled) setPhase('hidden')
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
      /* non-fatal */
    }
    setPhase('hidden')
  }

  if (phase === 'loading' || phase === 'hidden') return null

  const heading =
    readiness === 'pending_verification'
      ? 'Stripe Verification In Progress'
      : 'Finish Your Commission Payout Setup'
  const body =
    readiness === 'pending_verification'
      ? 'Stripe is verifying your payout account. You can check the status in Settings.'
      : "Connect with Stripe so you're ready to receive eligible electronic commission payments."

  return (
    <section
      aria-label="Finish your commission payout setup"
      className="mb-6 rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5"
    >
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-[#C9A84C]" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-wide text-[#F1F1F3]">{heading}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">{body}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/settings"
          className="rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#0a0a0f] transition hover:bg-[#d8ba61] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
        >
          {readiness === 'pending_verification' ? 'Check Status' : 'Set Up Payouts'}
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
