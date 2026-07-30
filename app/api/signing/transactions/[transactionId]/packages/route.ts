// ============================================================================
// Slice 2 Phase 3B-4 · V2 package submission proxy
// ============================================================================
// POST /api/signing/transactions/[transactionId]/packages
//
// Thin proxy to Vault's V2 submit at the same path. WRITE endpoint —
// unlike the read-only composer flow, this one persists a package on
// success. Server-gated by AP_SIGNING_COMPOSER_ENABLED so no accidental
// submission is possible while the flag is OFF (even if a client managed
// to reach this endpoint directly).
//
// Vault gates SIGNING_PLAN_V2_ENABLED — with that flag OFF, Vault will
// return 400 { reason: 'plan_version_not_enabled' } and no package will
// be written. Combined with AP's own flag, submission is a two-key gate.
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
    `/signing/transactions/${encodeURIComponent(transactionId)}/packages`,
    body,
  )
}
