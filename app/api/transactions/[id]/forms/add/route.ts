// ============================================================================
// TRANSACTION OS 3.3D — Agent Portal → Vault forms/add forward
// ============================================================================
// Thin proxy: materialize a selected optional/rider form (Vault forms/add).
// Authenticated; no business logic — Vault validates + inserts idempotently.
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
  const body = await request.json().catch(() => ({}))
  return proxyToVault(
    request,
    'POST',
    `/paperwork/agents/transactions/${id}/forms/add`,
    body
  )
}
