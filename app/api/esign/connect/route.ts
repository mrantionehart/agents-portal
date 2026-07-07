// ============================================================================
// TRANSACTION OS 3.3D — Agent Portal → Vault e-sign connect forward
// ============================================================================
// Thin proxy: get the DocuSign OAuth redirect URL (Vault GET
// /api/esign/docusign/connect). Authenticated. The UI redirects the browser to
// the returned redirectUrl; the callback (unchanged) returns to /settings. No
// AGENT.SIGN / DocuSign logic changes here.
// ============================================================================

import { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  return proxyToVault(request, 'GET', `/esign/docusign/connect`)
}
