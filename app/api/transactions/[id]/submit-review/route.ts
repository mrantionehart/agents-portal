// ============================================================================
// TRANSACTION OS 3.3E — Agent Portal → Vault submit-review forward
// ============================================================================
// Thin proxy: submit a transaction for broker review (Vault submit-review).
// Authenticated; no broker-review logic here — Vault owns the workflow and the
// broker_review_status transition.
// ============================================================================

import { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  const { id } = await params
  return proxyToVault(
    request,
    'POST',
    `/paperwork/transactions/${id}/submit-review`,
    {}
  )
}
