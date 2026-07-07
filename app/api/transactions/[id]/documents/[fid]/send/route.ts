// ============================================================================
// TRANSACTION OS 3.3D — Agent Portal → Vault send forward
// ============================================================================
// Thin proxy: send a form_instance for signature (Vault send). Authenticated;
// no DocuSign logic here — the existing Vault envelope pipeline does the work.
// Vault returns 409 esign_not_connected when the agent's DocuSign account isn't
// connected, and guards against duplicate envelopes.
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
    `/paperwork/agents/transactions/${id}/documents/${fid}/send`,
    {}
  )
}
