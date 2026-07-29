// ============================================================================
// POST /api/profile/birthday/dismiss — Agent Portal proxy to Vault
// ============================================================================
// Snoozes the "add your birthday" dashboard prompt for 30 days. No body is
// forwarded — Vault sets the timestamp on the caller's own profile.
// ============================================================================

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  return proxyToVault(request, 'POST', '/api/profile/birthday/dismiss')
}
