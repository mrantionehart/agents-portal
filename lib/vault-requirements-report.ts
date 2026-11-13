// DOC-ELIG-1 — Vault is the authority for document compliance.
//
// Broker of Record policy (2026-11-12): a document counts toward compliance
// only when the Broker of Record approved it (verified, no open deficiency,
// signatures verified where required). Vault holds that ONE rule; the portal
// reads its verdict from GET /api/transactions/:id/requirements-report and
// never re-derives it. Unreachable Vault ⇒ nothing is shown as approved and
// compliance is never reported complete (fail closed).
import type { NextRequest } from 'next/server'
import { resolveAccessToken } from './vault-forward'
import { VAULT_API_URL } from './vault-client'

export interface VaultDocumentReview {
  document_id: string
  name: string | null
  counts: boolean
  reason: string
  reason_text: string
}

export interface VaultRequirementsReport {
  catalogue: 'present' | 'no_catalogue'
  wouldBlock: boolean
  missing: Array<{ doc_label: string }>
  underReview: Array<{ doc_label: string; reason?: string; reason_text?: string }>
  signatureNotEvidenced: Array<{ doc_label: string }>
  checklistIncomplete: Array<{ item_name: string }>
}

export type VaultReportResult =
  | { ok: true; report: VaultRequirementsReport; reviews: Map<string, VaultDocumentReview> }
  | { ok: false }

export async function fetchVaultRequirementsReport(
  request: NextRequest,
  transactionId: string
): Promise<VaultReportResult> {
  const token = await resolveAccessToken(request)
  if (!token) return { ok: false }
  try {
    const res = await fetch(`${VAULT_API_URL}/transactions/${encodeURIComponent(transactionId)}/requirements-report`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false }
    const body = await res.json().catch(() => null)
    if (!body?.report || !Array.isArray(body.document_review)) return { ok: false }
    const reviews = new Map<string, VaultDocumentReview>()
    for (const r of body.document_review as VaultDocumentReview[]) {
      if (r?.document_id) reviews.set(r.document_id, r)
    }
    return { ok: true, report: body.report as VaultRequirementsReport, reviews }
  } catch {
    return { ok: false }
  }
}

/** Vault's verdict: complete only with a catalogue present and nothing outstanding. */
export function complianceCompleteFromReport(r: VaultReportResult): {
  complete: boolean
  missing: number
  unapproved: number
  missingSignatures: number
} {
  if (!r.ok) return { complete: false, missing: 0, unapproved: 0, missingSignatures: 0 }
  const rep = r.report
  return {
    complete: rep.catalogue === 'present' && rep.wouldBlock === false,
    missing: rep.missing?.length ?? 0,
    unapproved: rep.underReview?.length ?? 0,
    missingSignatures: rep.signatureNotEvidenced?.length ?? 0,
  }
}

export const REVIEW_UNAVAILABLE_TEXT = 'Approval status unavailable — not counted'

/**
 * The checklist status of an UPLOADED document, from Vault's review verdict.
 * 'approved' only when Vault says it counts; never from the raw row status.
 */
export function uploadedDocStatus(
  rawStatus: string | null | undefined,
  review: VaultDocumentReview | null | undefined
): 'approved' | 'uploaded' | 'rejected' {
  if (rawStatus === 'rejected') return 'rejected'
  if (review?.counts === true) return 'approved'
  return 'uploaded'
}
