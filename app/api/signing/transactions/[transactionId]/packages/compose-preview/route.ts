// ============================================================================
// Slice 2 Phase 3B-4 · Compose-preview proxy
// ============================================================================
// POST /api/signing/transactions/[transactionId]/packages/compose-preview
//
// Thin proxy to Vault's compose-preview at the same path. Read-only —
// composer is pure and Vault side never writes on this call. Server-gated
// by AP_SIGNING_COMPOSER_ENABLED; when OFF, direct callers see 404 (no
// leak of the composer surface).
//
// Vault side additionally gates SIGNING_PLAN_V2_ENABLED. When that flag
// is OFF, Vault returns 400 { reason: 'plan_version_not_enabled' } and
// this proxy forwards that response byte-identically.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'
import { isSigningComposerEnabled } from '@/lib/signing/composer-flag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  if (!isSigningComposerEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', reason: 'invalid_json' },
      { status: 400 },
    )
  }

  const { transactionId } = await params
  return proxyToVault(
    request,
    'POST',
    `/signing/transactions/${encodeURIComponent(transactionId)}/packages/compose-preview`,
    body,
  )
}
