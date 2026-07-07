// ============================================================================
// TRANSACTION OS 3.3D — Agent Portal → Vault download forward
// ============================================================================
// Thin proxy: fetch a short-lived signed URL for a generated/signed PDF (Vault
// download) so Package Review can preview it. Authenticated; read-only.
// ============================================================================

import { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fid: string }> }
) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  const { id, fid } = await params
  return proxyToVault(
    request,
    'GET',
    `/paperwork/agents/transactions/${id}/documents/${fid}/download`
  )
}
