// ============================================================================
// TRANSACTION OS 3.3D — Agent Portal → Vault generate forward
// ============================================================================
// Thin proxy: generate a form_instance's PDF (Vault generate). Authenticated;
// no PDF logic here — the existing Vault PDF-generation pipeline does the work.
// ============================================================================

import { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fid: string }> }
) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  const { id, fid } = await params
  return proxyToVault(
    request,
    'POST',
    `/paperwork/agents/transactions/${id}/documents/${fid}/generate`,
    {}
  )
}
