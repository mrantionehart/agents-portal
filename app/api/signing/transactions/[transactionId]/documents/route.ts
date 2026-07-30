// ============================================================================
// Slice 2 Phase 3B-4 · Transaction documents proxy (composer workflow)
// ============================================================================
// GET /api/signing/transactions/[transactionId]/documents
//
// Thin proxy to Vault's agent-safe transaction documents list at
//   GET /api/paperwork/agents/transactions/[id]/documents
//
// Read-only. Server-gated by AP_SIGNING_COMPOSER_ENABLED so direct callers
// cannot exercise the compose surface while the flag is OFF. Vault-side
// role/tenant/ownership gates remain the ultimate enforcement layer.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'
import { isSigningComposerEnabled } from '@/lib/signing/composer-flag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  // Server-gated: even authenticated callers see 404 while the flag is
  // OFF, matching the "no leak" contract for the composer workflow.
  if (!isSigningComposerEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { transactionId } = await params
  return proxyToVault(
    request,
    'GET',
    `/paperwork/agents/transactions/${encodeURIComponent(transactionId)}/documents`,
  )
}
