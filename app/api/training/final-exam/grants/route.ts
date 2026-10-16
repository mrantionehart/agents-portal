// HARTFELT-EXAM-GOVERNANCE-1 — Agent Portal proxy for broker exam-attempt grants.
//
// Thin, like the exam proxy next to it. Vault holds the authority check
// (role-exact broker, active, same tenant, no self-grant), the audit record
// and the one-outstanding-grant constraint. This route forwards the caller's
// own session and nothing else — in particular it never forwards a
// `granted_by` or `tenant_id`, because Vault derives both from the token.
import { NextRequest } from 'next/server'
import { proxyToVault } from '@/lib/vault-forward'
import { requireAuth } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const VAULT_PATH = '/api/onboarding/hartfelt-ready/final-exam/grants'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  return proxyToVault(request, 'GET', VAULT_PATH)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  // Only the two fields a broker actually supplies.
  const { agent_id, reason } = (body ?? {}) as { agent_id?: string; reason?: string }
  return proxyToVault(request, 'POST', VAULT_PATH, { agent_id, reason })
}
