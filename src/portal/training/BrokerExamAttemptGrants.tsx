'use client'

// ============================================================================
// HARTFELT-EXAM-GOVERNANCE-1 — "Authorize Additional Exam Attempt" (broker)
// ============================================================================
// Broker-only. The server is the authority: Vault refuses anyone who is not
// role-exact broker, refuses a self-grant, refuses a cross-tenant agent, and
// refuses a second outstanding grant via a database constraint. This component
// renders only for a broker so the control is not dangled at people who cannot
// use it — but hiding it is presentation, not protection.
//
// It also will not OFFER a grant to an agent who does not need one. Eligibility
// comes from Vault's attempt counts, not from the broker's recollection: an
// agent with attempts left, an agent who already passed, and an agent already
// holding an unused grant are each shown as such and cannot be selected.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, History } from 'lucide-react'

interface Agent {
  id: string
  full_name: string | null
  email: string | null
  attempts_used: number
  passed: boolean
  has_unused_grant: boolean
  eligible_for_grant: boolean
}

interface Grant {
  id: string
  profile_id: string
  quiz_version: string
  granted_by: string
  granted_at: string
  reason: string
  consumed_at: string | null
  consumed_attempt_num: number | null
  revoked_at: string | null
}

interface Payload {
  grants: Grant[]
  agents: Agent[]
  base_attempt_cap: number
  reason_min_length: number
}

export function BrokerExamAttemptGrants({ role }: { role: string | null }) {
  const [data, setData] = useState<Payload | null>(null)
  const [agentId, setAgentId] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/training/final-exam/grants', { cache: 'no-store' })
      if (!res.ok) return
      setData((await res.json()) as Payload)
    } catch {
      /* the hub still works without this section */
    }
  }, [])

  useEffect(() => {
    if (role === 'broker') void load()
  }, [role, load])

  // Only the Broker of Record sees this. Vault enforces it regardless.
  if (role !== 'broker' || !data) return null

  const nameFor = (id: string) => {
    const a = data.agents.find((x) => x.id === id)
    return a?.full_name || a?.email || id
  }
  const selected = data.agents.find((a) => a.id === agentId) ?? null
  const reasonOk = reason.trim().length >= data.reason_min_length
  const canSubmit = Boolean(selected?.eligible_for_grant) && reasonOk && !busy

  const submit = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/training/final-exam/grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, reason: reason.trim() }),
      })
      const body = await res.json()
      if (!res.ok) {
        setNotice({ tone: 'error', text: body?.error || 'That authorization was not accepted.' })
        return
      }
      setNotice({
        tone: 'ok',
        text: `One additional attempt authorized for ${nameFor(agentId)}. It is single-use.`,
      })
      setAgentId('')
      setReason('')
      await load()
    } catch {
      setNotice({ tone: 'error', text: 'Could not submit. Nothing was authorized.' })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-[#2A2A31] bg-[#17171B] p-4">
      <header className="flex items-start gap-2 mb-3">
        <KeyRound className="h-5 w-5 text-[#C9A84C] mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-[#F1F1F3]">Authorize Additional Exam Attempt</h2>
          <p className="text-sm text-[#A1A1AA]">
            Agents get {data.base_attempt_cap} attempts at the HartFelt Ready final. You can
            authorize <strong>one</strong> additional attempt for one agent. Each authorization is
            single-use and recorded below.
          </p>
        </div>
      </header>

      {notice && (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-200'
              : 'border-rose-700/40 bg-rose-900/20 text-rose-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-start">
        <label className="text-sm">
          <span className="block text-[#A1A1AA] mb-1">Agent</span>
          <select
            value={agentId}
            onChange={(e) => { setAgentId(e.target.value); setConfirming(false) }}
            className="w-full rounded-md border border-[#2A2A31] bg-[#0E0E11] px-2 py-1.5 text-[#F1F1F3]"
          >
            <option value="">Select an agent…</option>
            {data.agents.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.eligible_for_grant}>
                {(a.full_name || a.email || a.id)}
                {a.passed
                  ? ' — already passed'
                  : a.has_unused_grant
                  ? ' — already authorized'
                  : a.attempts_used < data.base_attempt_cap
                  ? ` — ${a.attempts_used} of ${data.base_attempt_cap} used`
                  : ' — out of attempts'}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-[#A1A1AA] mb-1">
            Reason (at least {data.reason_min_length} characters — this is the audit record)
          </span>
          <input
            value={reason}
            onChange={(e) => { setReason(e.target.value); setConfirming(false) }}
            placeholder="e.g. documented connectivity failure mid-exam"
            className="w-full rounded-md border border-[#2A2A31] bg-[#0E0E11] px-2 py-1.5 text-[#F1F1F3]"
          />
        </label>

        <div className="sm:pt-6">
          {!confirming ? (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => setConfirming(true)}
              className="rounded-md bg-[#C9A84C] px-3 py-1.5 text-sm font-semibold text-[#15151A] disabled:opacity-40"
            >
              Authorize…
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="rounded-md bg-[#C9A84C] px-3 py-1.5 text-sm font-semibold text-[#15151A] disabled:opacity-40"
              >
                {busy ? 'Authorizing…' : `Confirm for ${nameFor(agentId)}`}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-sm text-[#A1A1AA] underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#A1A1AA] mb-2">
          <History className="h-3.5 w-3.5" /> Authorization history
        </h3>
        {data.grants.length === 0 ? (
          <p className="text-sm text-[#A1A1AA]">No additional attempts have been authorized.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#A1A1AA]">
                  <th className="py-1 pr-3 font-medium">Agent</th>
                  <th className="py-1 pr-3 font-medium">Authorized</th>
                  <th className="py-1 pr-3 font-medium">Reason</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-[#D4D4D8]">
                {data.grants.map((g) => (
                  <tr key={g.id} className="border-t border-[#2A2A31]">
                    <td className="py-1.5 pr-3">{nameFor(g.profile_id)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {new Date(g.granted_at).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 pr-3">{g.reason}</td>
                    <td className="py-1.5">
                      {g.revoked_at
                        ? 'Withdrawn'
                        : g.consumed_at
                        ? `Used on attempt ${g.consumed_attempt_num}`
                        : 'Unused'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
