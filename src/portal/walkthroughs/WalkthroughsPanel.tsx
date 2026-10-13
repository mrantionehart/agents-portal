'use client'

// ============================================================================
// LEASE-WALKTHROUGH-1 — Agent Portal walkthrough panel
// ============================================================================
// Lists the transaction's walkthroughs and, once one is open, renders the full
// checklist inline: ratings, notes, agent-added rooms, signer selection, Save
// draft / Generate / Send, and the signing state afterwards.
//
// Renders NOTHING off a lease. A walkthrough is a lease artifact.
//
// All logic is in ./model (pure, jest-tested). The checklist itself arrives as
// `catalogue` from the API, so Vault is the single place an item is defined —
// that is what keeps this client and EASE from drifting apart item by item.
// Photos are capture-on-mobile by design and are listed here, not uploaded:
// a desktop is not where someone photographs a scuffed floor.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Camera, ChevronDown, ChevronUp, FileText, Plus, Trash2 } from 'lucide-react'
import { authFetch } from '@/lib/supabase'

import {
  type Catalogue,
  type Draft,
  type SignerCandidate,
  addAdditional,
  addDamageRow,
  addKeyRow,
  addMeterRow,
  clearUtility,
  removeRow,
  setAttendees,
  setUtility,
  updateRow,
  progressOf,
  removeAdditional,
  sectionProgress,
  sendBlockers,
  setItemNote,
  setScalar,
  shouldOfferWalkthroughs,
  startableModes,
  toggleRating,
  toggleSigner,
} from './model'

interface WalkthroughCard {
  form_instance_id: string
  form_id: string
  mode: 'move_in' | 'move_out'
  status: string
  editable: boolean
  progress: { rated: number; total: number; damaged: number; complete: boolean } | null
  photo_count: number
  updated_at: string
}

interface Props {
  transactionId: string
  transactionType: string | null | undefined
}

const RATING_CLASS: Record<string, string> = {
  good: 'bg-emerald-600 text-white border-emerald-600',
  fair: 'bg-amber-600 text-white border-amber-600',
  damaged: 'bg-rose-600 text-white border-rose-600',
  na: 'bg-zinc-600 text-white border-zinc-600',
}

const modeLabel = (m: string) => (m === 'move_in' ? 'Move-In' : 'Move-Out')

export default function WalkthroughsPanel({ transactionId, transactionType }: Props) {
  const [rows, setRows] = useState<WalkthroughCard[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [candidates, setCandidates] = useState<SignerCandidate[]>([])
  const [signers, setSigners] = useState<{ name: string; role_label: string }[]>([])
  const [status, setStatus] = useState('in_progress')
  const [generated, setGenerated] = useState(false)
  const [editable, setEditable] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  // Inline confirmations, NOT window.confirm. A native dialog blocks the
  // renderer, and this repo has already lost a verification run to exactly
  // that: the dialog froze the page and the click that opened it timed out.
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmNewMode, setConfirmNewMode] = useState<'move_in' | 'move_out' | null>(null)
  const [newRoom, setNewRoom] = useState<Record<string, string>>({})

  const offered = shouldOfferWalkthroughs(transactionType)

  const loadList = useCallback(async () => {
    try {
      const res = await authFetch(
        `/api/paperwork/walkthroughs?transaction_id=${encodeURIComponent(transactionId)}`,
        { cache: 'no-store' },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'Could not load walkthroughs.')
        return
      }
      setRows(body.walkthroughs ?? [])
      setError(null)
    } catch {
      setError('Could not load walkthroughs.')
    }
  }, [transactionId])

  useEffect(() => {
    if (offered) void loadList()
  }, [offered, loadList])

  const loadOne = useCallback(async (id: string) => {
    setBusy('Loading…')
    try {
      const res = await authFetch(`/api/paperwork/walkthroughs/${id}`, { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'Could not open this walkthrough.')
        return
      }
      setOpenId(id)
      setDraft(body.walkthrough.answers as Draft)
      setCatalogue(body.catalogue as Catalogue)
      setCandidates(
        (body.signer_candidates ?? []).map((c: Record<string, unknown>) => ({
          party_id: (c.party_id as string) ?? null,
          role: c.role as string,
          role_label: c.role_label as string,
          name: (c.name as string) ?? '',
          email: (c.email as string) ?? '',
          selected: !!c.selected,
          blocked: (c.blocked as string) ?? null,
        })),
      )
      setSigners(body.signers ?? [])
      setStatus(body.walkthrough.status)
      setGenerated(!!body.walkthrough.generated)
      setEditable(!!body.walkthrough.editable)
      setDirty(false)
      setError(null)
    } finally {
      setBusy(null)
    }
  }, [])

  const edit = useCallback((fn: (d: Draft) => Draft) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      if (next !== prev) setDirty(true)
      return next
    })
  }, [])

  const save = useCallback(
    async (markReady = false): Promise<boolean> => {
      if (!draft || !openId) return false
      setBusy(markReady ? 'Marking complete…' : 'Saving…')
      try {
        const res = await authFetch(`/api/paperwork/walkthroughs/${openId}`, {
          method: 'PATCH',
          body: JSON.stringify({ answers: draft, mark_ready: markReady }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(body.error || 'Could not save.')
          return false
        }
        setDirty(false)
        await loadOne(openId)
        await loadList()
        return true
      } finally {
        setBusy(null)
      }
    },
    [draft, openId, loadOne, loadList],
  )

  const generate = useCallback(async () => {
    if (!openId) return
    // Generate renders what is STORED, so an unsaved draft would produce a PDF
    // of observations the agent has already replaced.
    if (dirty && !(await save(false))) return
    setBusy('Generating…')
    try {
      // Generation runs a render + an upload; the default authFetch timeout is
      // too tight for it, as the DocuSign send button already found.
      const res = await authFetch(
        `/api/paperwork/walkthroughs/${openId}/generate`,
        { method: 'POST' },
        30000,
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setError(body.error || 'Could not generate the PDF.')
      else await loadOne(openId)
    } finally {
      setBusy(null)
    }
  }, [openId, dirty, save, loadOne])

  const send = useCallback(async () => {
    if (!openId) return
    setConfirmSend(false)
    setBusy('Sending…')
    try {
      const res = await authFetch(
        `/api/paperwork/walkthroughs/${openId}/send`,
        { method: 'POST' },
        30000,
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setError(body.error || 'Could not send.')
      else {
        await loadOne(openId)
        await loadList()
      }
    } finally {
      setBusy(null)
    }
  }, [openId, loadOne, loadList])

  const start = useCallback(
    async (mode: 'move_in' | 'move_out', confirmNew = false) => {
      setBusy('Starting…')
      try {
        const res = await authFetch('/api/paperwork/walkthroughs', {
          method: 'POST',
          body: JSON.stringify({ transaction_id: transactionId, mode, confirm_new: confirmNew }),
        })
        const body = await res.json().catch(() => ({}))
        if (res.status === 409 && body.requires_confirmation) {
          // The server refuses a second walkthrough of a completed mode until
          // asked twice. Surface it inline and let the agent decide.
          setConfirmNewMode(mode)
          return
        }
        if (!res.ok) {
          setError(body.error || 'Could not start a walkthrough.')
          return
        }
        await loadList()
        if (body.walkthrough) await loadOne(body.walkthrough.form_instance_id)
      } finally {
        setBusy(null)
      }
    },
    [transactionId, loadList, loadOne],
  )

  const progress = useMemo(
    () => (draft && catalogue ? progressOf(draft, catalogue) : null),
    [draft, catalogue],
  )
  const blockers = useMemo(
    () =>
      draft && catalogue
        ? sendBlockers({ draft, catalogue, candidates, generated, status })
        : ['Loading…'],
    [draft, catalogue, candidates, generated, status],
  )

  if (!offered) return null

  const startable = startableModes(rows ?? [])

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <FileText className="h-4 w-4 text-amber-400" />
          Lease walkthroughs
        </h3>
        {busy && <span className="text-xs text-zinc-400">{busy}</span>}
      </div>

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Existing walkthroughs */}
      <div className="divide-y divide-zinc-800">
        {rows?.map((w) => (
          <button
            key={w.form_instance_id}
            type="button"
            onClick={() => void loadOne(w.form_instance_id)}
            className={`flex w-full items-center justify-between py-2 text-left hover:bg-zinc-800/40 ${
              openId === w.form_instance_id ? 'bg-zinc-800/40' : ''
            }`}
          >
            <span className="text-sm text-zinc-200">{modeLabel(w.mode)} walkthrough</span>
            <span className="flex items-center gap-2 text-xs text-zinc-400">
              {w.progress && (
                <span>
                  {w.progress.rated}/{w.progress.total}
                </span>
              )}
              {w.progress && w.progress.damaged > 0 && (
                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {w.progress.damaged}
                </span>
              )}
              {w.photo_count > 0 && (
                <span className="flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  {w.photo_count}
                </span>
              )}
              <span className="rounded border border-zinc-700 px-1.5 py-0.5 uppercase">
                {w.status.replace(/_/g, ' ')}
              </span>
            </span>
          </button>
        ))}
        {rows?.length === 0 && (
          <p className="py-2 text-xs text-zinc-500">No walkthrough recorded yet.</p>
        )}
      </div>

      {confirmNewMode && (
        <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
          A completed {modeLabel(confirmNewMode)} walkthrough already exists. Record an additional
          one?
          <span className="ml-2 inline-flex gap-2">
            <button
              type="button"
              onClick={() => {
                const m = confirmNewMode
                setConfirmNewMode(null)
                void start(m, true)
              }}
              className="rounded bg-amber-600 px-2 py-0.5 font-semibold text-white hover:bg-amber-500"
            >
              Record another
            </button>
            <button
              type="button"
              onClick={() => setConfirmNewMode(null)}
              className="rounded border border-amber-500/50 px-2 py-0.5"
            >
              Cancel
            </button>
          </span>
        </div>
      )}

      {startable.length > 0 && (
        <div className="mt-3 flex gap-2">
          {startable.map((m) => (
            <button
              key={m}
              type="button"
              disabled={!!busy}
              onClick={() => void start(m)}
              className="flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Start {modeLabel(m)}
            </button>
          ))}
        </div>
      )}

      {/* Open walkthrough */}
      {openId && draft && catalogue && (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          {!editable && (
            <p className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
              This walkthrough is {status.replace(/_/g, ' ')} and can no longer be edited.
            </p>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="text-xs text-zinc-400">
              Date
              <input
                type="date"
                disabled={!editable}
                value={draft.walkthrough_on ?? ''}
                onChange={(e) => edit((d) => setScalar(d, { walkthrough_on: e.target.value || null }))}
                className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Represents
              <select
                disabled={!editable}
                value={draft.representation}
                onChange={(e) => edit((d) => setScalar(d, { representation: e.target.value }))}
                className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              >
                {catalogue.representations.map((r) => (
                  <option key={r} value={r}>
                    {r === 'both' ? 'Both parties' : r === 'tenant' ? 'Tenant' : 'Landlord'}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Present
              <input
                type="text"
                disabled={!editable}
                placeholder="Names, comma separated"
                value={draft.attendees.join(', ')}
                onChange={(e) => edit((d) => setAttendees(d, e.target.value))}
                className="ml-2 w-56 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              />
            </label>
            {progress && (
              <span className="text-xs text-zinc-400">
                {progress.rated} of {progress.total} recorded
                {progress.damaged > 0 ? ` · ${progress.damaged} damaged` : ''}
              </span>
            )}
            {dirty && <span className="text-xs font-semibold text-amber-400">Unsaved</span>}
          </div>

          {/* Sections */}
          {catalogue.sections.map((section) => {
            const sp = sectionProgress(draft, section)
            const isOpen = !!openSections[section.key]
            return (
              <div key={section.key} className="mb-2 rounded border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOpenSections((o) => ({ ...o, [section.key]: !o[section.key] }))}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-zinc-800/40"
                >
                  <span className="text-sm text-zinc-100">{section.label}</span>
                  <span className="flex items-center gap-2 text-xs text-zinc-400">
                    {sp.damaged > 0 && (
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {sp.damaged}
                      </span>
                    )}
                    {sp.rated}/{sp.total}
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>

                {isOpen && (
                  <div className="divide-y divide-zinc-800 border-t border-zinc-800">
                    {section.items.map((item) => {
                      const obs = draft.sections[section.key]?.items?.[item.key]
                      return (
                        <div key={item.key} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-zinc-300">{item.label}</span>
                            <div className="flex gap-1">
                              {catalogue.ratings.map((r) => (
                                <button
                                  key={r.value}
                                  type="button"
                                  disabled={!editable}
                                  onClick={() => edit((d) => toggleRating(d, section.key, item.key, r.value))}
                                  className={`rounded border px-2 py-0.5 text-[11px] ${
                                    obs?.rating === r.value
                                      ? RATING_CLASS[r.value]
                                      : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                                  } disabled:opacity-50`}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="text"
                            disabled={!editable}
                            placeholder="Note"
                            value={obs?.notes ?? ''}
                            onChange={(e) => edit((d) => setItemNote(d, section.key, item.key, e.target.value))}
                            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600"
                          />
                        </div>
                      )
                    })}

                    {(draft.sections[section.key]?.additional ?? []).map((extra, i) => (
                      <div key={`x-${i}`} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-zinc-300">{extra.label} (added)</span>
                        <div className="flex items-center gap-1">
                          {catalogue.ratings.map((r) => (
                            <button
                              key={r.value}
                              type="button"
                              disabled={!editable}
                              onClick={() =>
                                edit((d) => {
                                  const list = [...(d.sections[section.key]?.additional ?? [])]
                                  list[i] = { ...list[i]!, rating: r.value }
                                  return {
                                    ...d,
                                    sections: {
                                      ...d.sections,
                                      [section.key]: { ...d.sections[section.key]!, additional: list },
                                    },
                                  }
                                })
                              }
                              className={`rounded border px-2 py-0.5 text-[11px] ${
                                extra.rating === r.value
                                  ? RATING_CLASS[r.value]
                                  : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                              } disabled:opacity-50`}
                            >
                              {r.label}
                            </button>
                          ))}
                          {editable && (
                            <button
                              type="button"
                              onClick={() => edit((d) => removeAdditional(d, section.key, i))}
                              className="ml-1 text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {editable && (
                      <div className="flex gap-2 px-3 py-2">
                        <input
                          type="text"
                          placeholder="Add a room or item"
                          value={newRoom[section.key] ?? ''}
                          onChange={(e) => setNewRoom((n) => ({ ...n, [section.key]: e.target.value }))}
                          className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            edit((d) => addAdditional(d, section.key, newRoom[section.key] ?? ''))
                            setNewRoom((n) => ({ ...n, [section.key]: '' }))
                          }}
                          className="rounded border border-zinc-700 px-2 text-[11px] text-zinc-200 hover:bg-zinc-800"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Keys / utilities / meters / damage — requirement-6 fields. The PDF
              renders all of them, so a client that cannot enter them leaves a
              section of the signed record permanently blank. */}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {/* Keys */}
            <div className="rounded border border-zinc-800 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-400">
                Keys &amp; access devices
              </h4>
              {draft.keys.map((k, i) => (
                <div key={`k-${i}`} className="mb-1 flex items-center gap-1">
                  <input
                    type="text"
                    disabled={!editable}
                    placeholder="Key or device"
                    value={k.label}
                    onChange={(e) => edit((d) => updateRow(d, 'keys', i, { label: e.target.value }))}
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
                  />
                  <input
                    type="number"
                    min={0}
                    disabled={!editable}
                    title="Issued"
                    value={k.issued}
                    onChange={(e) =>
                      edit((d) => updateRow(d, 'keys', i, { issued: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    className="w-14 rounded border border-zinc-800 bg-zinc-900 px-1 py-1 text-[11px] text-zinc-200"
                  />
                  <input
                    type="number"
                    min={0}
                    disabled={!editable}
                    title="Returned"
                    value={k.returned}
                    onChange={(e) =>
                      edit((d) => updateRow(d, 'keys', i, { returned: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    className="w-14 rounded border border-zinc-800 bg-zinc-900 px-1 py-1 text-[11px] text-zinc-200"
                  />
                  {editable && (
                    <button type="button" onClick={() => edit((d) => removeRow(d, 'keys', i))} className="text-rose-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {editable && (
                <button
                  type="button"
                  onClick={() => edit((d) => addKeyRow(d))}
                  className="mt-1 text-[11px] text-amber-400 hover:text-amber-300"
                >
                  + Add a key
                </button>
              )}
              <p className="mt-1 text-[10px] text-zinc-600">Issued / returned counts.</p>
            </div>

            {/* Utilities */}
            <div className="rounded border border-zinc-800 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-400">Utilities</h4>
              {catalogue.utilities.map((u) => {
                const current = draft.utilities[u.value]
                return (
                  <div key={u.value} className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-300">{u.label}</span>
                    <div className="flex gap-1">
                      {catalogue.utility_statuses.map((st) => {
                        const active = current?.status === st.value
                        return (
                          <button
                            key={st.value}
                            type="button"
                            disabled={!editable}
                            onClick={() =>
                              edit((d) =>
                                active
                                  ? clearUtility(d, u.value)
                                  : setUtility(d, u.value, { status: st.value }),
                              )
                            }
                            className={`rounded border px-1.5 py-0.5 text-[10px] ${
                              active
                                ? 'border-zinc-500 bg-zinc-700 text-white'
                                : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                            } disabled:opacity-50`}
                          >
                            {st.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Meters */}
            <div className="rounded border border-zinc-800 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-400">Meter readings</h4>
              {draft.meters.map((m, i) => (
                <div key={`m-${i}`} className="mb-1 flex items-center gap-1">
                  <input
                    type="text"
                    disabled={!editable}
                    placeholder="Meter"
                    value={m.label}
                    onChange={(e) => edit((d) => updateRow(d, 'meters', i, { label: e.target.value }))}
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
                  />
                  <input
                    type="text"
                    disabled={!editable}
                    placeholder="Reading"
                    value={m.reading}
                    onChange={(e) => edit((d) => updateRow(d, 'meters', i, { reading: e.target.value }))}
                    className="w-24 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
                  />
                  {editable && (
                    <button type="button" onClick={() => edit((d) => removeRow(d, 'meters', i))} className="text-rose-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {editable && (
                <button
                  type="button"
                  onClick={() => edit((d) => addMeterRow(d))}
                  className="mt-1 text-[11px] text-amber-400 hover:text-amber-300"
                >
                  + Add a reading
                </button>
              )}
            </div>

            {/* Existing damage */}
            <div className="rounded border border-zinc-800 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-400">Existing damage</h4>
              <p className="mb-1 text-[10px] text-zinc-600">
                Already present — recorded separately so it is not read as new.
              </p>
              {draft.existing_damage.map((dm, i) => (
                <div key={`dm-${i}`} className="mb-1 flex items-center gap-1">
                  <input
                    type="text"
                    disabled={!editable}
                    placeholder="Location"
                    value={dm.location}
                    onChange={(e) =>
                      edit((d) => updateRow(d, 'existing_damage', i, { location: e.target.value }))
                    }
                    className="w-28 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
                  />
                  <input
                    type="text"
                    disabled={!editable}
                    placeholder="What is damaged"
                    value={dm.description}
                    onChange={(e) =>
                      edit((d) => updateRow(d, 'existing_damage', i, { description: e.target.value }))
                    }
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
                  />
                  {editable && (
                    <button
                      type="button"
                      onClick={() => edit((d) => removeRow(d, 'existing_damage', i))}
                      className="text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {editable && (
                <button
                  type="button"
                  onClick={() => edit((d) => addDamageRow(d))}
                  className="mt-1 text-[11px] text-amber-400 hover:text-amber-300"
                >
                  + Add damage
                </button>
              )}
            </div>
          </div>

          {/* Signers */}
          <div className="mt-4 rounded border border-zinc-800 p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase text-zinc-400">Who signs</h4>
            <p className="mb-2 text-[11px] text-zinc-500">
              {draft.signer_party_ids.length === 0
                ? 'Nobody chosen — everyone marked as a required signer will be asked.'
                : `${draft.signer_party_ids.length} chosen.`}
            </p>
            {candidates.length === 0 && (
              <p className="text-[11px] text-zinc-500">No tenants or landlords on this transaction yet.</p>
            )}
            {candidates.map((c) => {
              const chosen = c.party_id != null && draft.signer_party_ids.includes(c.party_id)
              const disabled = !editable || !!c.blocked || c.party_id == null
              return (
                <label
                  key={c.party_id ?? c.email}
                  className={`flex items-center gap-2 py-1 text-xs ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={chosen}
                    onChange={() => c.party_id && edit((d) => toggleSigner(d, c.party_id!))}
                  />
                  <span className="text-zinc-200">{c.name || '(no name)'}</span>
                  <span className="text-zinc-500">
                    {c.role_label}
                    {c.email ? ` · ${c.email}` : ''}
                  </span>
                  {c.blocked && <span className="text-rose-400">Cannot sign: {c.blocked}</span>}
                </label>
              )
            })}
          </div>

          {/* Comments */}
          <div className="mt-3">
            <h4 className="mb-1 text-xs font-semibold uppercase text-zinc-400">Comments</h4>
            <textarea
              disabled={!editable}
              rows={3}
              value={draft.comments}
              onChange={(e) => edit((d) => setScalar(d, { comments: e.target.value }))}
              placeholder="Anything either party wants recorded"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
          </div>

          {/* Photos — listed, not uploaded. A desktop is not where someone
              photographs a scuffed floor; EASE captures them on the phone. */}
          <p className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
            <Camera className="h-3.5 w-3.5" />
            {draft.photo_document_ids.length} photo
            {draft.photo_document_ids.length === 1 ? '' : 's'} attached · captured in EASE, stored
            with the transaction documents
          </p>

          {/* Signing state */}
          {(status === 'sent' || status === 'signed') && (
            <div className="mt-3 rounded border border-indigo-500/40 bg-indigo-500/10 p-2 text-xs text-indigo-200">
              {status === 'signed'
                ? 'Signed. The completed document is in the transaction documents.'
                : 'Out for signature.'}
              {signers.length > 0 && (
                <span className="ml-1 text-indigo-300">
                  {signers.map((s) => `${s.name} (${s.role_label})`).join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          {editable && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void save(false)}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void generate()}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {generated ? 'Re-generate PDF' : 'Generate PDF'}
              </button>
              {confirmSend ? (
                <span className="inline-flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                  Email {signers.length || 'no'} signer{signers.length === 1 ? '' : 's'}
                  {signers.length > 0 && (
                    <span className="text-amber-300">
                      ({signers.map((s) => `${s.name} (${s.role_label})`).join(', ')})
                    </span>
                  )}
                  ?
                  <button
                    type="button"
                    onClick={() => void send()}
                    className="rounded bg-amber-600 px-2 py-0.5 font-semibold text-white hover:bg-amber-500"
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSend(false)}
                    className="rounded border border-amber-500/50 px-2 py-0.5"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!!busy || blockers.length > 0}
                  onClick={() => setConfirmSend(true)}
                  className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
                >
                  Send for signatures
                </button>
              )}
              {blockers.length > 0 && (
                <ul className="w-full list-disc pl-5 text-[11px] text-zinc-500">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
