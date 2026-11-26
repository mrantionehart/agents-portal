'use client'

// ============================================================================
// CTM — Broker Agent View preview (BoR, 2026-11-25)
// ============================================================================
// The Broker of Record opens CTM in the Agent Portal and sees every lesson,
// simulation, module quiz and the final exam the way an agent does, without a
// CTM assignment. Vault is the boundary: its CTM gate lets the role `broker`
// READ (catalog, progress, lesson content, learner-safe quiz) and refuses every
// WRITE without a live assignment, so a preview cannot create an assignment,
// consume an attempt, record a completion or issue a credential.
//
// This module only shapes the UI to match: sequential locks are lifted for the
// broker (so every lesson can be opened), and the write controls are replaced
// by a notice instead of a button that Vault would refuse.
// ============================================================================

import { useAuth } from '@/app/providers'

export const CTM_PREVIEW_CERTIFICATION_ID = 'hartfelt-real-estate-ctm-fl'

export function isCtmBrokerPreview(certificationId: string | null | undefined, role: string | null | undefined): boolean {
  return certificationId === CTM_PREVIEW_CERTIFICATION_ID && role === 'broker'
}

export function useCtmBrokerPreview(certificationId: string | null | undefined): boolean {
  const { role } = useAuth()
  return isCtmBrokerPreview(certificationId, role)
}

export function CtmBrokerPreviewNotice({ what }: { what: string }) {
  return (
    <div
      data-testid="ctm-broker-preview-notice"
      className="rounded border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-3 py-2 text-xs text-[#F1F1F3]"
    >
      Broker preview: {what} Nothing is recorded, no attempt is used and no assignment is created.
    </div>
  )
}
