// ============================================================================
// TRANSACTION OS 3.3D — Agent Portal → Vault e-sign status forward
// ============================================================================
// Thin proxy: report whether the agent's DocuSign account is connected (Vault
// GET /api/esign/status). Authenticated; read-only; no secrets forwarded.
// ============================================================================

import { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  return proxyToVault(request, 'GET', `/esign/status`)
}
