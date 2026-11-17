'use client'

// ============================================================================
// MDC-1 — MY MEMBERSHIPS & MLS (agent profile section)
// ============================================================================
// The agent's own REALTOR® association and MLS records — the SAME Vault
// records Vault staff and EASE use. Declarations land as "Submitted by you —
// awaiting review" and never overwrite what staff verified. Nonmembership is a
// valid election: nothing here blocks, warns of termination, or mentions
// deductions. Brokerage assessments, exposure and internal notes are never in
// the response this section reads.
//
// Dark behind NEXT_PUBLIC_MEMBERSHIP_COMPLIANCE_ENABLED: while off it renders
// nothing and makes no request. It also hides itself if Vault refuses the
// caller (birthday-section pattern).
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Loader2, Upload } from 'lucide-react'
import { membershipSectionEnabled } from './membership-flag'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>
interface View {
  memberships: Row[]
  mls_subscriptions: Row[]
  documentation_requests: Row[]
  disclosures: Row[]
  policies: Array<{ key: string; title: string; summary: string }>
}

const STATE_LABEL: Record<string, string> = {
  agent_submitted: 'Submitted by you — awaiting review',
  staff_reviewed: 'Reviewed by staff',
  verified: 'Verified',
  disputed: 'Disputed',
  broker_approved: 'Broker approved',
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'
const BTN = 'inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50'

function money(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return 'amount not yet known'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function MembershipsSection() {
  const enabled = membershipSectionEnabled()
  const [visible, setVisible] = useState(false)
  const [view, setView] = useState<View | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isMember, setIsMember] = useState(true)
  const [m, setM] = useState({ association_name: '', is_primary: true, membership_number: '', declared_renewal_date: '' })
  const [mls, setMls] = useState({ mls_provider: '', declared_renewal_date: '' })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/memberships', { cache: 'no-store' })
      if (!res.ok) {
        setVisible(false)
        return
      }
      setView(await res.json())
      setVisible(true)
    } catch {
      setVisible(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, load])

  if (!enabled || !visible || !view) return null

  const act = async (fn: () => Promise<Response>, ok: string) => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fn()
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'Something went wrong.')
      setMsg({ ok: true, text: ok })
      await load()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' })
    } finally {
      setBusy(false)
    }
  }

  const post = (body: unknown) => () =>
    fetch('/api/profile/memberships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const declare = () => {
    if (isMember && !m.association_name.trim()) return setMsg({ ok: false, text: 'Enter the association you belong to.' })
    if (m.declared_renewal_date && !DATE_RE.test(m.declared_renewal_date)) return setMsg({ ok: false, text: 'Use a full renewal date, or leave it blank.' })
    act(
      post(
        isMember
          ? { kind: 'membership', declared_status: 'active', association_name: m.association_name.trim(), is_primary: m.is_primary, membership_number: m.membership_number.trim() || null, declared_renewal_date: m.declared_renewal_date || null }
          : { kind: 'membership', declared_status: 'nonmember', association_name: m.association_name.trim() || null },
      ),
      'Declaration submitted for review.',
    )
  }

  const upload = (kind: string, target: Record<string, string>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    for (const [k, v] of Object.entries(target)) fd.append(k, v)
    act(() => fetch('/api/profile/memberships/evidence', { method: 'POST', body: fd }), 'Document uploaded for review.')
    e.target.value = ''
  }

  return (
    <section id="memberships" aria-label="My Memberships & MLS" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
        <BadgeCheck className="h-5 w-5" /> MY MEMBERSHIPS &amp; MLS
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        REALTOR® association membership is optional at Hartfelt. You can stay affiliated as a nonmember where the rules allow it.
      </p>
      {msg ? <p role={msg.ok ? 'status' : 'alert'} className={`mb-3 text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p> : null}

      <div className="space-y-3">
        {view.memberships.length === 0 ? <p className="text-sm text-gray-500">No membership declared yet.</p> : null}
        {view.memberships.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm" data-testid={`ap-membership-${r.id}`}>
            <div className="font-medium">{r.association_name || 'Not an association member'}</div>
            <div className="text-gray-600">
              You declared: {r.declared_status}
              {r.is_primary === false ? ' · secondary' : r.association_name ? ' · primary' : ''} · Verified: {r.verified_status ?? 'not yet'}
            </div>
            <div className="text-gray-600">
              Renewal: {r.renewal_date ?? r.declared_renewal_date ?? 'unknown'}
              {r.renewal_date_verified ? ' (verified)' : r.declared_renewal_date ? ' (your entry, not verified)' : ''}
            </div>
            <div className="text-gray-500">{STATE_LABEL[r.record_state] ?? r.record_state}</div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1 text-sm text-gray-900 underline">
              <Upload className="h-4 w-4" /> Upload confirmation or receipt
              <input type="file" className="sr-only" aria-label={`Upload evidence for ${r.association_name || 'membership'}`} accept="application/pdf,image/*" disabled={busy} onChange={upload('membership_confirmation', { membership_id: r.id })} />
            </label>
          </div>
        ))}
      </div>

      <fieldset aria-label="Declare or report a change" className="mt-4 space-y-2 rounded-lg border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium">Declare or report a change</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="mdc-member" checked={isMember} onChange={() => setIsMember(true)} /> I am a REALTOR® association member
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="mdc-member" checked={!isMember} onChange={() => setIsMember(false)} /> I am not currently a REALTOR® association member.
        </label>
        <input aria-label="Association" placeholder={isMember ? 'Association' : 'Association (optional)'} className={INPUT} value={m.association_name} onChange={(e) => setM({ ...m, association_name: e.target.value })} />
        {isMember ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" aria-label="Primary association" checked={m.is_primary} onChange={(e) => setM({ ...m, is_primary: e.target.checked })} /> This is my primary association
            </label>
            <input aria-label="Membership number" placeholder="Membership number (optional)" className={INPUT} value={m.membership_number} onChange={(e) => setM({ ...m, membership_number: e.target.value })} />
            <input aria-label="Renewal date" type="date" className={INPUT} value={m.declared_renewal_date} onChange={(e) => setM({ ...m, declared_renewal_date: e.target.value })} />
          </>
        ) : null}
        <button type="button" className={BTN} disabled={busy} onClick={declare}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit declaration
        </button>
      </fieldset>

      <h3 className="mt-5 text-sm font-semibold text-gray-900">MLS subscriptions</h3>
      {view.mls_subscriptions.length === 0 ? <p className="text-sm text-gray-500">No MLS subscription on file.</p> : null}
      {view.mls_subscriptions.map((s) => (
        <div key={s.id} className="mt-2 rounded-lg border border-gray-200 p-3 text-sm">
          <div className="font-medium">{s.mls_provider}</div>
          <div className="text-gray-600">You declared: {s.declared_status} · Verified: {s.verified_status ?? 'not yet'} · Renewal: {s.renewal_date ?? s.declared_renewal_date ?? 'unknown'}</div>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1 underline">
            <Upload className="h-4 w-4" /> Upload MLS confirmation
            <input type="file" className="sr-only" aria-label={`Upload evidence for ${s.mls_provider}`} accept="application/pdf,image/*" disabled={busy} onChange={upload('mls_confirmation', { mls_subscription_id: s.id })} />
          </label>
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        <input aria-label="MLS" placeholder="MLS name" className={`${INPUT} flex-1`} value={mls.mls_provider} onChange={(e) => setMls({ ...mls, mls_provider: e.target.value })} />
        <input aria-label="MLS renewal date" type="date" className={`${INPUT} w-auto`} value={mls.declared_renewal_date} onChange={(e) => setMls({ ...mls, declared_renewal_date: e.target.value })} />
        <button
          type="button"
          className={BTN}
          disabled={busy || !mls.mls_provider.trim()}
          onClick={() => act(post({ kind: 'mls', mls_provider: mls.mls_provider.trim(), declared_status: 'active', declared_renewal_date: mls.declared_renewal_date || null }), 'MLS subscription submitted for review.')}
        >
          Add MLS subscription
        </button>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-gray-900">Documentation requests</h3>
      {view.documentation_requests.length === 0 ? <p className="text-sm text-gray-500">Nothing requested from you.</p> : null}
      {view.documentation_requests.map((r) => (
        <div key={r.id} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <div>{r.description}{r.due_date ? ` — due ${r.due_date}` : ''}</div>
          <label className="mt-1 inline-flex cursor-pointer items-center gap-1 underline">
            <Upload className="h-4 w-4" /> Upload document
            <input type="file" className="sr-only" aria-label={`Upload for request: ${r.description}`} accept="application/pdf,image/*" disabled={busy} onChange={upload('other', { request_id: r.id })} />
          </label>
        </div>
      ))}

      {view.disclosures.length ? <h3 className="mt-5 text-sm font-semibold text-gray-900">Written disclosures</h3> : null}
      {view.disclosures.map((d) => (
        <div key={d.id} className="mt-2 rounded-lg border border-gray-200 p-3 text-sm" data-testid={`ap-disclosure-${d.id}`}>
          <p className="whitespace-pre-wrap">{d.disclosure_text}</p>
          {d.outcome === 'known_assessment_disclosed' || d.outcome === 'amount_pending_verification' ? <p className="text-gray-600">Amount: {money(d.amount_cents)}</p> : null}
          {d.agent_acknowledged_at ? (
            <p className="text-green-700">Acknowledged {String(d.agent_acknowledged_at).slice(0, 10)}</p>
          ) : (
            <button type="button" className={`${BTN} mt-2`} disabled={busy} onClick={() => act(() => fetch(`/api/profile/memberships/disclosures/${d.id}/acknowledge`, { method: 'POST' }), 'Disclosure acknowledged.')}>
              I acknowledge this disclosure
            </button>
          )}
        </div>
      ))}

      <h3 className="mt-5 text-sm font-semibold text-gray-900">Brokerage policies</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {view.policies.map((p) => (
          <li key={p.key}><span className="font-medium">{p.title}.</span> <span className="text-gray-600">{p.summary}</span></li>
        ))}
      </ul>
    </section>
  )
}
