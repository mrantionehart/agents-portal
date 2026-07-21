// ============================================================================
// AP.MAIL.P2.001 — Support request: authenticated proxy to Vault
// ============================================================================
// The Agent Portal is the UI/request boundary only. Support persistence,
// validation, the domain event, the transactional outbox append, and the
// notification workflow are owned by Vault. This route no longer sends email
// (SendGrid removed): it forwards the authenticated request to the Vault
// business endpoint, which durably saves the request and returns success
// independently of notification delivery.
//
// Failure contract: proxyToVault returns an honest normalized failure — 401 if
// unauthenticated, 502 (vault_unreachable) if Vault is down — and passes
// Vault's status + JSON through otherwise. It never silently claims success.
// ============================================================================

import { NextRequest } from 'next/server'
import { proxyToVault } from '@/lib/vault-forward'
import { requireAuth } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Portal-side gate (defense in depth). Vault re-verifies the token and
  // resolves role/tenant itself via gateCaller.
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  // Forward the form body ({ name, email, subject, message }) unchanged.
  const body = await request.json().catch(() => ({}))
  return proxyToVault(request, 'POST', '/support/requests', body)
}
