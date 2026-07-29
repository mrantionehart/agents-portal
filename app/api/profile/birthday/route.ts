// ============================================================================
// /api/profile/birthday — Agent Portal proxy to Vault (system of record)
// ============================================================================
// The portal never writes birthday data directly. It forwards the caller's
// session to Vault, which is the sole birthday write path and the authorization
// boundary. The forwarded PUT body is allowlisted to self-service fields ONLY —
// `agentId` and any administrative fields can never be smuggled through here.
// ============================================================================

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET — the caller's own birthday state (Vault enforces active-agent eligibility).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  return proxyToVault(request, 'GET', '/api/profile/birthday')
}

// PUT — self-service update. Only month/day + email preference are forwarded.
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const input = (body ?? {}) as Record<string, unknown>

  // Strict self-service allowlist. Never forward agentId or admin fields.
  const safe: Record<string, unknown> = {
    birthMonth: input.birthMonth,
    birthDay: input.birthDay,
  }
  if ('birthdayEmailEnabled' in input) {
    safe.birthdayEmailEnabled = input.birthdayEmailEnabled
  }

  return proxyToVault(request, 'PUT', '/api/profile/birthday', safe)
}
