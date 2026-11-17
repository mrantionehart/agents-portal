'use client'

// ============================================================================
// Association Membership & MLS Access — the agent's own record (Agent Portal)
// ============================================================================
// Shows three SEPARATE statuses (brokerage affiliation, association
// membership, MLS access), lets the agent record or change their own election
// (each change is kept as history in Vault), says plainly whether the
// Association Membership & Financial Responsibility Addendum has been
// executed (nothing applies until it has), and lists any reimbursement notice
// with the deadline and a way to object in writing. Vault is the system of
// record and decides everything; this view never computes an obligation.
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/supabase'

/**
 * Release gate (runbook R7). The Vault records behind this section exist only
 * after the R7 migration is applied, so the section is not shown before then —
 * otherwise every agent's profile would show a load error. Turning it on is a
 * reviewed one-line change made with the Vault release.
 */
export const ASSOCIATION_SECTION_ENABLED = false

type Statuses = { brokerage_affiliation: string; association_membership: string; mls_access: string }
interface ElectionsResponse {
  statuses: Statuses
  current: { association_name: string | null; association_member_id: string | null; assessment_disclosure: string; disclosed_estimated_amount: number | null } | null
  history: { recorded_at: string; membership_status: string; mls_access_status: string }[]
  addendum: { released: boolean; executed: boolean; template: { title: string } }
}
interface Case {
  id: string; association_name: string; period_covered: string; proposed_amount: number; calculation: string; rule_basis: string
  status: string; objection_deadline: string | null; objection_text: string | null
  determination: string | null; determined_amount: number | null; payment_due_at: string | null
}

const MEMBERSHIP: Record<string, string> = {
  member: 'I currently maintain qualifying REALTOR® membership',
  intends_to_join: 'I intend to obtain or maintain qualifying REALTOR® membership',
  declined: 'I elect not to maintain REALTOR® membership at this time',
  verification_needed: 'My membership status requires further verification',
}
const MLS: Record<string, string> = { active: 'Active', pending: 'Pending', none: 'No MLS access', unknown: 'Not sure' }
const LABEL: Record<string, string> = {
  affiliated: 'Affiliated', not_active: 'Not active', not_recorded: 'Not recorded',
  member: 'Member', intends_to_join: 'Intends to join', declined: 'Declined', verification_needed: 'Needs verification',
  active: 'Active', pending: 'Pending', none: 'None', unknown: 'Unknown',
}
const DISCLOSURE: Record<string, string> = {
  none_identified: 'No association assessment has been identified after reasonable review.',
  identified: 'A potential association assessment has been identified.',
  undeterminable: 'Any potential assessment cannot presently be determined; the brokerage will disclose it in writing.',
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const money = (n: number) => `$${Number(n).toFixed(2)}`

export default function AssociationMembershipSection() {
  const [data, setData] = useState<ElectionsResponse | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [loadError, setLoadError] = useState(false)
  const [form, setForm] = useState({ membership_status: '', association_name: '', association_member_id: '', mls_access_status: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [objection, setObjection] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([authFetch('/api/association/elections'), authFetch('/api/association/assessments')])
      if (!e.ok) { setLoadError(true); return }
      setData(await e.json())
      setCases(c.ok ? ((await c.json()).cases ?? []) : [])
      setLoadError(false)
    } catch { setLoadError(true) }
  }, [])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true); setMessage(null)
    try {
      const res = await authFetch('/api/association/elections', {
        method: 'POST',
        body: JSON.stringify({
          membership_status: form.membership_status,
          association_name: form.association_name || null,
          association_member_id: form.association_member_id || null,
          mls_access_status: form.mls_access_status,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setMessage({ kind: 'error', text: b?.error === 'association_name_required' ? 'Please enter your association name.' : 'Your election could not be saved. Please try again.' })
        return
      }
      setMessage({ kind: 'ok', text: 'Your election has been recorded.' })
      setForm({ membership_status: '', association_name: '', association_member_id: '', mls_access_status: '' })
      await load()
    } finally { setSaving(false) }
  }

  async function object(id: string) {
    const res = await authFetch(`/api/association/assessments/${id}`, { method: 'POST', body: JSON.stringify({ action: 'object', objection: objection[id] }) })
    setMessage(res.ok
      ? { kind: 'ok', text: 'Your objection was submitted. The Broker of Record will review it before any decision.' }
      : { kind: 'error', text: 'Your objection could not be submitted. Please try again.' })
    if (res.ok) await load()
  }

  if (loadError) return <section aria-label="Association membership" className="rounded-xl border border-[#1a1a2e] p-4"><p role="alert" className="text-sm text-red-400">Association membership details could not be loaded.</p></section>
  if (!data) return null
  const canSave = !!form.membership_status && !!form.mls_access_status && !saving

  return (
    <section aria-label="Association membership" className="rounded-xl border border-[#1a1a2e] bg-[#0a0a0f] p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Association Membership &amp; MLS Access</h2>
        <p className="text-sm text-gray-400">REALTOR® membership is not required for every agent. Membership, MLS access and your affiliation with HartFelt are separate.</p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {([['Brokerage affiliation', data.statuses.brokerage_affiliation], ['Association membership', data.statuses.association_membership], ['MLS access', data.statuses.mls_access]] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-[#050507] p-3">
            <dt className="text-xs text-gray-400">{k}</dt>
            <dd className="text-sm font-medium text-white">{LABEL[v] ?? v}</dd>
          </div>
        ))}
      </dl>

      <p data-testid="addendum-status" className="text-sm text-gray-300">
        {data.addendum.executed
          ? `${data.addendum.template.title}: executed.`
          : `${data.addendum.template.title}: not executed. It applies only after you and the Broker of Record sign it.`}
      </p>
      {data.current && (
        <p className="text-sm text-gray-300">
          Brokerage disclosure: {DISCLOSURE[data.current.assessment_disclosure] ?? ''}
          {data.current.disclosed_estimated_amount !== null ? ` Estimated amount: ${money(data.current.disclosed_estimated_amount)}.` : ''}
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-white">Record your election</legend>
        {Object.entries(MEMBERSHIP).map(([v, label]) => (
          <label key={v} className="flex items-start gap-2 text-sm text-gray-200">
            <input type="radio" name="membership_status" value={v} checked={form.membership_status === v} onChange={() => setForm({ ...form, membership_status: v })} />
            <span>{label}</span>
          </label>
        ))}
        {form.membership_status === 'member' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input aria-label="Association name" placeholder="Association name" value={form.association_name} onChange={(e) => setForm({ ...form, association_name: e.target.value })} className="rounded-md bg-[#050507] border border-[#1a1a2e] p-2 text-sm text-white" />
            <input aria-label="Membership / NRDS / M1 number" placeholder="Membership / NRDS / M1 number" value={form.association_member_id} onChange={(e) => setForm({ ...form, association_member_id: e.target.value })} className="rounded-md bg-[#050507] border border-[#1a1a2e] p-2 text-sm text-white" />
          </div>
        )}
        <label className="block text-sm text-gray-200">
          MLS access
          <select aria-label="MLS access" value={form.mls_access_status} onChange={(e) => setForm({ ...form, mls_access_status: e.target.value })} className="mt-1 block w-full sm:w-64 rounded-md bg-[#050507] border border-[#1a1a2e] p-2 text-sm text-white">
            <option value="">Choose…</option>
            {Object.entries(MLS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="button" onClick={save} disabled={!canSave} className="w-full sm:w-auto rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {saving ? 'Saving…' : 'Save election'}
        </button>
      </fieldset>

      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-red-400' : 'text-sm text-green-400'}>{message.text}</p>}

      {cases.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Reimbursement notices</h3>
          {cases.map((c) => (
            <div key={c.id} data-testid={`case-${c.id}`} className="rounded-lg border border-[#1a1a2e] p-3 space-y-1 text-sm text-gray-200">
              <p>{c.association_name} · {c.period_covered} · proposed {money(c.proposed_amount)}</p>
              <p className="text-gray-400">Basis: {c.rule_basis}. Calculation: {c.calculation}.</p>
              {c.status === 'noticed' && c.objection_deadline && (
                <>
                  <p>You may object in writing until {fmtDate(c.objection_deadline)} (New York time).</p>
                  <textarea aria-label="Your objection" value={objection[c.id] ?? ''} onChange={(e) => setObjection({ ...objection, [c.id]: e.target.value })} rows={3} className="w-full rounded-md bg-[#050507] border border-[#1a1a2e] p-2" />
                  <button type="button" onClick={() => object(c.id)} disabled={(objection[c.id] ?? '').trim().length < 10} className="rounded-lg border border-[#C9A84C] px-3 py-1.5 text-[#C9A84C] disabled:opacity-50">Submit objection</button>
                </>
              )}
              {c.status === 'objected' && <p>Objection submitted — awaiting the Broker of Record&apos;s review.</p>}
              {c.status === 'determined' && (
                <p>Broker of Record determination: {c.determination === 'not_owed' ? 'not owed' : `${money(c.determined_amount ?? 0)} payable by ${fmtDate(c.payment_due_at as string)}`}. No amount is deducted from your commission.</p>
              )}
              {c.status === 'withdrawn' && <p>Withdrawn by the brokerage.</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
