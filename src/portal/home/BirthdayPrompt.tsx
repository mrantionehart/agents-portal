'use client'

// ============================================================================
// Agent Birthdays — dashboard self-entry prompt
// ============================================================================
// A small dismissible card below the greeting inviting the agent to add their
// birthday (month + day only — never a year, never an age). It:
//   • loads state AFTER the dashboard shell renders (never blocks the page)
//   • fails silently if state can't be fetched
//   • never opens the modal automatically
//   • hides when a birthday exists, while snoozed, or when Vault says the caller
//     is ineligible (GET 403)
// Eligibility is enforced by Vault (GET /api/profile/birthday); the hiding here
// is convenience only. All writes go through the Vault-proxied API.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
// Calendar-only max day per month (Feb = 29 so Feb 29 is always selectable).
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

type Phase = 'loading' | 'hidden' | 'prompt' | 'modal' | 'saved'

interface BirthdayState {
  hasBirthday: boolean
  promptDismissedUntil: string | null
}

export default function BirthdayPrompt() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [month, setMonth] = useState<number | ''>('')
  const [day, setDay] = useState<number | ''>('')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  // Load state after mount. Any failure → hide (fail silently).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/profile/birthday', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setPhase('hidden')
          return
        }
        const data = (await res.json()) as BirthdayState
        if (cancelled) return
        if (data.hasBirthday) {
          setPhase('hidden')
          return
        }
        if (data.promptDismissedUntil && new Date(data.promptDismissedUntil).getTime() > Date.now()) {
          setPhase('hidden')
          return
        }
        setPhase('prompt')
      } catch {
        if (!cancelled) setPhase('hidden')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Focus the first field when the modal opens.
  useEffect(() => {
    if (phase === 'modal') firstFieldRef.current?.focus()
  }, [phase])

  const closeModal = useCallback(() => {
    setError('')
    setPhase('prompt')
  }, [])

  // Escape closes the modal.
  useEffect(() => {
    if (phase !== 'modal') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, closeModal])

  const handleDismiss = async () => {
    setPhase('hidden') // optimistic — the snooze is a best-effort convenience
    try {
      await fetch('/api/profile/birthday/dismiss', { method: 'POST' })
    } catch {
      /* non-fatal: the card is already hidden for this session */
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (month === '' || day === '') {
      setError('Please choose your birthday month and day.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/profile/birthday', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthMonth: month,
          birthDay: day,
          birthdayEmailEnabled: emailEnabled,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Could not save your birthday. Please try again.')
      }
      setPhase('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your birthday. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'loading' || phase === 'hidden') return null

  if (phase === 'saved') {
    return (
      <section
        aria-label="Birthday saved"
        className="mb-6 rounded-lg border border-[#C9A84C]/40 bg-[#11111a] p-5"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true">🎂</span>
          <h2 className="text-sm font-semibold tracking-wide text-[#F1F1F3]">
            Thanks — we&rsquo;ve saved your birthday!
          </h2>
        </div>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          HartFelt will celebrate your special day. You can update it anytime from your profile.
        </p>
      </section>
    )
  }

  const dayCount = month === '' ? 31 : MAX_DAY[month - 1]

  return (
    <>
      {/* ── The prompt card ─────────────────────────────────────────── */}
      <section
        aria-label="Add your birthday"
        className="mb-6 rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true">🎂</span>
          <h2 className="text-sm font-semibold tracking-wide text-[#F1F1F3]">Help us celebrate you</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
          Add your birthday so HartFelt can recognize your special day. We only need the month and day.
          Your age will never be displayed.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setPhase('modal')}
            className="rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#0a0a0f] transition hover:bg-[#d8ba61] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
          >
            Add Birthday
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#A1A1AA] transition hover:text-[#F1F1F3] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20"
          >
            Maybe Later
          </button>
        </div>
      </section>

      {/* ── The modal ───────────────────────────────────────────────── */}
      {phase === 'modal' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="birthday-modal-title"
            className="w-full max-w-md rounded-lg bg-[#0a0a0f] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1a1a2e] p-5">
              <h2 id="birthday-modal-title" className="text-lg font-bold text-white">
                Add your birthday
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-200" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-5">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="birth-month" className="mb-1 block text-sm font-medium text-gray-200">
                    Month
                  </label>
                  <select
                    id="birth-month"
                    ref={firstFieldRef}
                    value={month}
                    onChange={(e) => {
                      const m = e.target.value === '' ? '' : Number(e.target.value)
                      setMonth(m)
                      // Clamp the day if it no longer fits the chosen month.
                      if (m !== '' && day !== '' && day > MAX_DAY[m - 1]) setDay('')
                    }}
                    required
                    className="w-full rounded-lg border border-[#1a1a2e] bg-[#11111a] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((name, i) => (
                      <option key={name} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="birth-day" className="mb-1 block text-sm font-medium text-gray-200">
                    Day
                  </label>
                  <select
                    id="birth-day"
                    value={day}
                    onChange={(e) => setDay(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                    className="w-full rounded-lg border border-[#1a1a2e] bg-[#11111a] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  >
                    <option value="">Day</option>
                    {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-[#1a1a2e] accent-[#C9A84C]"
                />
                Send me a birthday email from HartFelt
              </label>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[#A1A1AA] hover:text-[#F1F1F3]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#0a0a0f] transition hover:bg-[#d8ba61] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Birthday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
