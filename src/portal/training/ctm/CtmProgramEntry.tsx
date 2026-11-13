'use client'

// ============================================================================
// CTM-1 — Closing & Transaction Management entry on the Agent Portal Training hub.
// ============================================================================
// Reuses, does not rebuild:
//   * AUTH — the existing authenticated Vault client (`fetchProgress` in
//     certified/api.ts, the learner's own session). No new credentials.
//   * PROGRAM — Vault's platform-certification progress endpoint, whose learner
//     gate (`authorizeCertificationLearner`) is the only authority on whether
//     this learner may see the program. Draft program, unassigned learner or
//     denied role → the gate refuses → this card renders NOTHING.
//   * CONTENT — lessons, quizzes and the final are taken HERE, in the Agent
//     Portal's existing certified-track pages (/training/certified/...?program=).
//     Never Vault /learning: agents have no interactive Vault access.
//   * DOWNLOADS — the existing Contract Training library (/contract-training),
//     where RLS decides what each user may read.
// Brokers see a DRAFT preview pointer to Vault's broker-only Training Preview.
// ============================================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'

import { fetchProgress } from '@/src/portal/training/certified/api'
import type { CertifiedProgress } from '@/src/portal/training/certified/types'
import { VAULT_BASE_URL } from '@/lib/vault-client'
import { lessonHref, trackHref } from '@/src/portal/training/certified/program'

export const CTM_CERTIFICATION_ID = 'hartfelt-real-estate-ctm-fl'
export const CTM_FIRST_TRACK_ID = 'ctm-m01'
export const CTM_VAULT_BROKER_PREVIEW_URL = `${VAULT_BASE_URL}/broker-training-preview`
export const CTM_DOWNLOADS_HREF = '/contract-training'

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'learner'; progress: CertifiedProgress }

/** Agent Portal route for "Continue training": the next lesson Vault names, else Module 1. */
export function continueHref(p: CertifiedProgress): string {
  const next = p.next_lesson
  if (next && next.lesson_id) return lessonHref(CTM_CERTIFICATION_ID, next.track_id || next.module_id, next.lesson_id)
  return trackHref(CTM_CERTIFICATION_ID, CTM_FIRST_TRACK_ID)
}

function summary(p: CertifiedProgress): string {
  if (p.issuance && !p.issuance.revoked_at) return 'Certified by your Broker of Record.'
  if (p.status === 'completed') return 'Final exam passed — awaiting Broker of Record approval.'
  const total = p.tracks.length
  const done = p.tracks.filter((t) => t.status === 'completed' || t.status === 'certified').length
  return `${done} of ${total} modules complete.`
}

export function CtmProgramEntry({ role }: { role: string | null }) {
  const isBroker = role === 'broker'
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (isBroker) return
    let live = true
    void (async () => {
      try {
        const progress = await fetchProgress(CTM_CERTIFICATION_ID)
        if (live) setState({ kind: 'learner', progress })
      } catch {
        if (live) setState({ kind: 'hidden' }) // gate refused, or Vault unreachable: fail closed
      }
    })()
    return () => {
      live = false
    }
  }, [isBroker])

  if (isBroker) {
    return (
      <div
        data-testid="ctm-entry-broker-preview"
        className="mb-6 rounded-lg border border-[#2A2A31] bg-[#17171B] px-4 py-3 flex items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <ClipboardCheck className="h-5 w-5 text-[#C9A84C] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#F1F1F3]">Closing &amp; Transaction Management</p>
            <p className="text-sm text-[#A1A1AA]">
              DRAFT — PENDING BROKER APPROVAL. Hidden from agents until you approve and activate it.
            </p>
          </div>
        </div>
        <a
          href={CTM_VAULT_BROKER_PREVIEW_URL}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold border border-[#C9A84C] text-[#C9A84C]"
        >
          Review in Vault
        </a>
      </div>
    )
  }

  if (state.kind !== 'learner') return null

  return (
    <div
      data-testid="ctm-entry"
      className="mb-6 rounded-lg border border-[#2A2A31] bg-[#17171B] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3">
        <ClipboardCheck className="h-5 w-5 text-[#C9A84C] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-[#F1F1F3]">Closing &amp; Transaction Management</p>
          <p className="text-sm text-[#A1A1AA]" data-testid="ctm-entry-summary">{summary(state.progress)}</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link
          href={CTM_DOWNLOADS_HREF}
          data-testid="ctm-entry-downloads"
          className="rounded-md px-3 py-1.5 text-sm border border-[#2A2A31] text-[#A1A1AA]"
        >
          Checklists &amp; downloads
        </Link>
        <Link
          href={continueHref(state.progress)}
          data-testid="ctm-entry-open"
          className="rounded-md px-3 py-1.5 text-sm font-semibold bg-[#C9A84C] text-black"
        >
          Continue training
        </Link>
      </div>
    </div>
  )
}

export default CtmProgramEntry
