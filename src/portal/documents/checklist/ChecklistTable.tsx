'use client'

// ============================================================================
// AGENT.SIGN.1C — Vault-powered transaction document checklist
// ============================================================================
// Columns: SELECT · STATUS · REQUIREMENT · DOCUMENT · TYPE · E-SIGN · UPLOAD ·
// actions (Download / Generate / View). Data is the agent-safe Vault System A
// projection from /api/paperwork/checklist (ensure-forms). All status /
// requirement / selection logic is delegated to the pure checklist-logic module.
// No envelope generation here (deferred to the package phase).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import { authFetch } from '@/lib/supabase'
import { VAULT_API_URL } from '@/lib/vault-client'
import AgentDocumentDownloadButton from '@/src/portal/documents/AgentDocumentDownloadButton'
import CoachStrip from '@/src/portal/workspace/components/CoachStrip'
import type { CoachRecommendation } from '@/src/portal/workspace/types'
import GenerateFormButton from './GenerateFormButton'
import {
  buildChecklistRows,
  deriveActionBar,
  type ChecklistRow,
  type ChecklistStatusLabel,
  type RequirementLabel,
  type VaultDocumentCard,
  type VaultRequirementCard,
} from './checklist-logic'

interface Props {
  transactionId: string
  coachRecommendation?: CoachRecommendation | null
}

const STATUS_CLASS: Record<ChecklistStatusLabel, string> = {
  Blocked: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
  Required: 'bg-sky-500/10 text-sky-300 border-sky-500/40',
  Preparing: 'bg-zinc-600/30 text-zinc-300 border-zinc-600',
  Ready: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  Sent: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/40',
  Approved: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50',
  Hidden: 'hidden',
}

const REQUIREMENT_CLASS: Record<RequirementLabel, string> = {
  Required: 'bg-rose-500/10 text-rose-300 border-rose-500/40',
  Conditional: 'bg-orange-500/10 text-orange-300 border-orange-500/40',
  Optional: 'bg-zinc-600/30 text-zinc-400 border-zinc-600',
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  )
}

async function viewDocument(transactionId: string, formInstanceId: string) {
  try {
    const res = await authFetch(
      `${VAULT_API_URL}/paperwork/agents/transactions/${transactionId}/documents/${formInstanceId}/download`
    )
    if (!res.ok) return
    const body = await res.json().catch(() => null)
    if (body?.signed_url) window.open(body.signed_url, '_blank', 'noopener')
  } catch {
    /* no-op — Download remains the reliable path */
  }
}

export default function ChecklistTable({ transactionId, coachRecommendation }: Props) {
  const [rows, setRows] = useState<ChecklistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/paperwork/checklist?transaction_id=${encodeURIComponent(transactionId)}`,
        { cache: 'no-store' }
      )
      if (!res.ok) {
        setError(res.status === 404 ? 'Transaction not found.' : 'Could not load the checklist.')
        setRows([])
        return
      }
      const body = (await res.json()) as {
        requirements: VaultRequirementCard[]
        documents: VaultDocumentCard[]
        supported: boolean
      }
      setRows(buildChecklistRows(body.requirements ?? [], body.documents ?? []))
    } catch {
      setError('Could not load the checklist.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [transactionId])

  useEffect(() => {
    void load()
  }, [load])

  const bar = useMemo(() => deriveActionBar(rows, selected), [rows, selected])

  function toggle(formId: string, selectable: boolean) {
    if (!selectable) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(formId)) next.delete(formId)
      else next.add(formId)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function generateSelected() {
    const targets = rows.filter(
      (r) => selected.has(r.form_id) && r.generatable && r.form_instance_id
    )
    for (const r of targets) {
      try {
        await authFetch(
          `${VAULT_API_URL}/paperwork/agents/transactions/${transactionId}/documents/${r.form_instance_id}/generate`,
          { method: 'POST' }
        )
      } catch {
        /* continue; per-row buttons surface individual errors */
      }
    }
    await load()
  }

  async function downloadSelected() {
    const targets = rows.filter(
      (r) => selected.has(r.form_id) && r.downloadable && r.form_instance_id
    )
    for (const r of targets) {
      await viewDocument(transactionId, r.form_instance_id as string) // opens each in a tab
    }
  }

  return (
    <div className="space-y-3">
      {coachRecommendation && (
        <CoachStrip recommendation={coachRecommendation} />
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#F1F1F3]">Required documents</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA] hover:text-[#F1F1F3]"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {loading && <p className="text-xs text-[#71717A]">Loading checklist…</p>}
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="text-xs text-[#71717A]">
          No Vault-derived required documents for this transaction type.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#1a1a2e]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0b10] text-[10px] uppercase tracking-wide text-[#71717A]">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Requirement</th>
                <th className="px-2 py-2">Document</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">E-Sign</th>
                <th className="px-2 py-2">Upload</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.form_id}
                  className="border-t border-[#1a1a2e] align-top text-[#D4D4D8]"
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.form_id)}
                      disabled={!r.selectable}
                      title={r.selectable ? 'Select' : r.selectDisabledReason}
                      onChange={() => toggle(r.form_id, r.selectable)}
                      className="h-4 w-4 accent-[#C9A84C] disabled:opacity-40"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Badge className={STATUS_CLASS[r.statusLabel]}>{r.statusLabel}</Badge>
                  </td>
                  <td className="px-2 py-2">
                    <Badge className={REQUIREMENT_CLASS[r.requirementLabel]}>
                      {r.requirementLabel}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium text-[#F1F1F3]">{r.form_name}</div>
                    <div className="text-[10px] text-[#71717A]">
                      {r.form_id}
                      {r.form_revision ? ` · ${r.form_revision}` : ''}
                    </div>
                  </td>
                  <td className="px-2 py-2 capitalize text-[#A1A1AA]">
                    {r.category.replace('_', ' ')}
                  </td>
                  <td className="px-2 py-2">
                    {r.manual_only ? (
                      <Badge className="bg-zinc-600/30 text-zinc-300 border-zinc-600">
                        Manual
                      </Badge>
                    ) : r.e_sign ? (
                      <Badge className="bg-teal-500/15 text-teal-300 border-teal-500/40">
                        DS
                      </Badge>
                    ) : (
                      <span className="text-[#52525B]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {r.has_upload ? (
                      <span className="text-emerald-300">Uploaded</span>
                    ) : (
                      <span className="text-[#52525B]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.downloadable && r.form_instance_id && (
                        <AgentDocumentDownloadButton
                          transactionId={transactionId}
                          formInstanceId={r.form_instance_id}
                          formId={r.form_id}
                        />
                      )}
                      {r.downloadable && r.form_instance_id && (
                        <button
                          type="button"
                          title="View"
                          onClick={() =>
                            void viewDocument(transactionId, r.form_instance_id as string)
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#11111a] px-2 py-1 text-[11px] text-[#A1A1AA] hover:text-[#F1F1F3]"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      )}
                      {r.generatable && !r.manual_only && r.form_instance_id && (
                        <GenerateFormButton
                          transactionId={transactionId}
                          formInstanceId={r.form_instance_id}
                          formId={r.form_id}
                          onGenerated={() => void load()}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bar.count > 0 && (
        <div className="sticky bottom-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#252538] bg-[#11111a] px-3 py-2 text-xs">
          <span className="font-medium text-[#F1F1F3]">{bar.count} selected</span>
          <button
            type="button"
            onClick={() => void generateSelected()}
            disabled={!bar.canGenerate}
            className="rounded-md border border-[#252538] px-2 py-1 text-[#C9A84C] hover:border-[#C9A84C] disabled:opacity-40"
          >
            Generate Selected
          </button>
          <button
            type="button"
            onClick={() => void downloadSelected()}
            disabled={!bar.canDownload}
            className="rounded-md border border-[#252538] px-2 py-1 text-[#A1A1AA] hover:text-[#F1F1F3] disabled:opacity-40"
          >
            Download Selected
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-md border border-[#252538] px-2 py-1 text-[#71717A] hover:text-[#F1F1F3]"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  )
}
