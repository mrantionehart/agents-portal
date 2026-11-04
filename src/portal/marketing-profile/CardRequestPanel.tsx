'use client'

// ============================================================================
// Brokerage Business Card requests — the agent's own panel.
// ============================================================================
// The card is HartFelt Real Estate's, not the agent's: the brokerage owns the
// design, generates it, approves it and publishes it. Nothing here lets an
// agent influence any of that, and there is nothing to lock down — the
// generator's whole input surface is the agent's name, title, brokerage email,
// public phone, licence number and headshot. Logo, layout, colours and
// template are constants in the renderer, with no parameter to pass.
//
// Three states, drawn as a strip: Requested → Being Made → Ready. The state and
// whether asking is available are SERVER-owned (Vault computes both from the
// request row and the approved card); this component renders them and computes
// nothing. Hides itself when the Vault route is absent, so an undeployed
// backend leaves the rest of My Card working — the same partial-rollout rule the
// sibling MarketingProfileSection follows.
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Clock, Loader2, Send, AlertCircle, Hammer } from 'lucide-react'
import { getCardRequest, raiseCardRequest } from './card-request-api'
import { MarketingProfileError, NETWORK_ERROR_CODE, NON_CONTRACT_CODE } from './api'
import type { CardRequestReason, CardRequestState } from './types'

const REASON_LABEL: Record<CardRequestReason, string> = {
  first_card: 'I need my first business card',
  new_headshot: 'I have a new headshot',
  details_changed: 'My details changed',
  reprint: 'I need more printed',
}
const REASON_ORDER: CardRequestReason[] = ['first_card', 'new_headshot', 'details_changed', 'reprint']
const MAX_NOTE = 500

/** The strip. `Ready` is reported from the APPROVED CARD, never from a fulfilled
 *  request — a request whose card was later superseded is not Ready, and a card
 *  made before requests existed has no request at all. */
const STEPS: Array<{ key: 'requested' | 'being_made' | 'ready'; label: string }> = [
  { key: 'requested', label: 'Requested' },
  { key: 'being_made', label: 'Being made' },
  { key: 'ready', label: 'Ready' },
]

function friendlyError(code: string, status: number): string {
  if (code === NETWORK_ERROR_CODE) return 'Unable to reach the brokerage right now. Please try again.'
  if (code === NON_CONTRACT_CODE) return 'This is temporarily unavailable. Please try again.'
  switch (code) {
    case 'REQUEST_ALREADY_OPEN': return 'You already have a business card request waiting.'
    case 'REASON_INVALID': return 'Choose why you need a business card.'
    case 'NOTE_TOO_LONG': return 'That note is too long (500 characters max).'
    case 'NO_TENANT': return 'Your account is not fully configured yet.'
    case 'RATE_LIMITED': return 'Too many attempts. Please try again shortly.'
    case 'FIELD_NOT_ALLOWED': return 'This request only ever applies to your own business card.'
    case 'UNAUTHENTICATED': return 'Your session expired. Please sign in again.'
    case 'CARD_REQUEST_UNAVAILABLE': return 'This is temporarily unavailable. Please try again.'
    default:
      if (status === 429) return 'Too many attempts. Please try again shortly.'
      if (status >= 500) return 'This is temporarily unavailable. Please try again.'
      return 'Something went wrong. Please try again.'
  }
}

export default function CardRequestPanel() {
  const [state, setState] = useState<CardRequestState | null>(null)
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<CardRequestReason>('first_card')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getCardRequest()
      setState(data)
      setReason(data.suggestedReason)
    } catch (e) {
      const err = e as MarketingProfileError
      // An UNDEPLOYED route (a non-JSON platform 404) hides this additive panel
      // quietly. A STRUCTURED Vault error — including a JSON 404 with a stable
      // code — is a real condition and gets a bounded, retryable message.
      if (err.contract === false && err.status === 404) { setHidden(true); return }
      if (err.code === 'CARD_REQUESTS_DISABLED') { setHidden(true); return }
      setLoadError(friendlyError(err.code, err.status))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function onSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const next = await raiseCardRequest(reason, note)
      setState(next)
      setOpen(false)
      setNote('')
    } catch (e) {
      const err = e as MarketingProfileError
      // A 409 means a request of theirs is already waiting — which is what they
      // were trying to achieve. Reload rather than scold.
      if (err.code === 'REQUEST_ALREADY_OPEN') {
        setOpen(false)
        setNote('')
        await load()
        return
      }
      setSubmitError(friendlyError(err.code, err.status))
    } finally {
      setSubmitting(false)
    }
  }

  if (hidden) return null

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0a0a0f] p-5 mb-6" aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking your card request…
        </div>
      </div>
    )
  }

  if (loadError || !state) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0a0a0f] p-5 mb-6">
        <p className="text-sm text-gray-300 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-amber-400" /> {loadError ?? 'This is temporarily unavailable.'}
        </p>
        <button onClick={load} className="mt-2 text-sm text-[#C9A84C] hover:underline">Try again</button>
      </div>
    )
  }

  // Which strip steps are reached. `ready` lights the whole strip; a live
  // request lights up to its own step.
  const reachedIndex =
    state.state === 'ready' ? 2
    : state.state === 'being_made' ? 1
    : state.state === 'requested' ? 0
    : -1

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0f] p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-semibold">Brokerage Business Card</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            HartFelt Real Estate designs and produces your official business card. Request one whenever you need it.
          </p>
        </div>
        {state.canRequest && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#C9A84C] text-black font-medium shrink-0"
          >
            <Send className="w-4 h-4" /> Request Brokerage Business Card
          </button>
        )}
      </div>

      {reachedIndex >= 0 && (
        <ol className="mt-4 flex items-center gap-2" aria-label="Card request progress">
          {STEPS.map((s, i) => {
            const reached = i <= reachedIndex
            const current = i === reachedIndex
            return (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  aria-current={current ? 'step' : undefined}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                    reached ? 'border-[#C9A84C]/60 text-[#C9A84C] bg-[#C9A84C]/10' : 'border-white/10 text-gray-500'
                  }`}
                >
                  {s.key === 'requested' && <Clock className="w-3.5 h-3.5" />}
                  {s.key === 'being_made' && <Hammer className="w-3.5 h-3.5" />}
                  {s.key === 'ready' && <CheckCircle className="w-3.5 h-3.5" />}
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className={`h-px w-5 ${reached ? 'bg-[#C9A84C]/50' : 'bg-white/10'}`} />}
              </li>
            )
          })}
        </ol>
      )}

      {state.state === 'none' && (
        <p className="mt-3 text-sm text-gray-400">You have not requested a brokerage business card yet.</p>
      )}
      {state.state === 'declined' && state.request && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm text-amber-200">Your last business card request was not completed.</p>
          {state.request.resolutionNote && (
            <p className="text-xs text-gray-300 mt-1">{state.request.resolutionNote}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">You can ask again once it is sorted.</p>
        </div>
      )}
      {state.state === 'requested' && (
        <p className="mt-3 text-sm text-gray-400">The brokerage has your request. You will be told when your business card is ready.</p>
      )}
      {state.state === 'being_made' && (
        <p className="mt-3 text-sm text-gray-400">Your business card is being made now.</p>
      )}
      {state.state === 'ready' && (
        <p className="mt-3 text-sm text-gray-400">Your business card is approved and live.</p>
      )}

      {open && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <fieldset>
            <legend className="text-sm text-gray-300 mb-2">Why do you need a business card?</legend>
            <div className="flex flex-col gap-1.5">
              {REASON_ORDER.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="radio"
                    name="card-request-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {REASON_LABEL[r]}
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor="card-request-note" className="block text-sm text-gray-300 mt-3 mb-1">
            Anything the brokerage should know? (optional)
          </label>
          <textarea
            id="card-request-note"
            value={note}
            maxLength={MAX_NOTE}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-[#050507] border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="e.g. I would like 50 printed"
          />
          <p className="text-xs text-gray-500 mt-1">{note.length}/{MAX_NOTE}</p>

          {submitError && (
            <p className="mt-2 text-sm text-red-300 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {submitError}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#C9A84C] text-black font-medium disabled:opacity-60"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send request</>}
            </button>
            <button onClick={() => { setOpen(false); setSubmitError(null) }} disabled={submitting} className="text-sm text-gray-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
