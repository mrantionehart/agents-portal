'use client'

// ============================================================================
// Agent Birthdays — profile Birthday section
// ============================================================================
// An editable Birthday block on the Agent Portal profile page. Month + day and
// the birthday-email preference only — NEVER a birth year, never an age. Saves
// through the Vault-proxied API (the system of record), independent of the
// legacy direct-Supabase save used by the rest of the profile form. Hides
// itself if Vault reports the caller ineligible.
// ============================================================================

import { useEffect, useState } from 'react'
import { Cake, Loader2, Save, CheckCircle } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

interface BirthdayState {
  hasBirthday: boolean
  birthMonth: number | null
  birthDay: number | null
  birthdayEmailEnabled: boolean
}

export default function ProfileBirthdaySection() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<BirthdayState | null>(null)
  const [month, setMonth] = useState<number | ''>('')
  const [day, setDay] = useState<number | ''>('')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/profile/birthday', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setLoading(false) // ineligible → stay hidden
          return
        }
        const data = (await res.json()) as BirthdayState
        if (cancelled) return
        setState(data)
        setMonth(data.birthMonth ?? '')
        setDay(data.birthDay ?? '')
        setEmailEnabled(data.birthdayEmailEnabled)
        setVisible(true)
      } catch {
        /* fail silently */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
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
        body: JSON.stringify({ birthMonth: month, birthDay: day, birthdayEmailEnabled: emailEnabled }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Could not save your birthday. Please try again.')
      }
      setState({ hasBirthday: true, birthMonth: month, birthDay: day, birthdayEmailEnabled: emailEnabled })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your birthday. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !visible) return null

  const dayCount = month === '' ? 31 : MAX_DAY[month - 1]
  const display =
    state?.hasBirthday && state.birthMonth
      ? `${MONTHS[state.birthMonth - 1]} ${state.birthDay}`
      : 'Not set'

  return (
    <div className="p-5 rounded-xl bg-[#0a0a1a] border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <Cake className="w-4 h-4 text-[#C9A84C]" />
        <h2 className="text-sm font-semibold text-white">Birthday</h2>
      </div>

      {!editing ? (
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-300">
            <p>
              Birthday: <span className="text-white">{display}</span>
            </p>
            <p className="mt-1">
              Birthday email:{' '}
              <span className="text-white">{state?.birthdayEmailEnabled ? 'On' : 'Off'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-[#C9A84C] hover:bg-white/5 transition"
          >
            {saved ? (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            ) : state?.hasBirthday ? (
              'Edit'
            ) : (
              'Add'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Month and day only — your age is never shown.</p>
          <div className="flex gap-3">
            <select
              aria-label="Birthday month"
              value={month}
              onChange={(e) => {
                const m = e.target.value === '' ? '' : Number(e.target.value)
                setMonth(m)
                if (m !== '' && day !== '' && day > MAX_DAY[m - 1]) setDay('')
              }}
              className="flex-1 rounded-lg border border-white/10 bg-[#0a0a0f]/5 px-3 py-2 text-white focus:outline-none focus:border-[#C9A84C]/50"
            >
              <option value="">Month</option>
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Birthday day"
              value={day}
              onChange={(e) => setDay(e.target.value === '' ? '' : Number(e.target.value))}
              className="flex-1 rounded-lg border border-white/10 bg-[#0a0a0f]/5 px-3 py-2 text-white focus:outline-none focus:border-[#C9A84C]/50"
            >
              <option value="">Day</option>
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 accent-[#C9A84C]"
            />
            Send me a birthday email from HartFelt
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#050507] hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setError('')
                setMonth(state?.birthMonth ?? '')
                setDay(state?.birthDay ?? '')
                setEmailEnabled(state?.birthdayEmailEnabled ?? true)
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
