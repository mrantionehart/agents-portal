// ============================================================================
// HARTFELT-READY-FINAL-1 — Agent Portal access to the comprehensive final
// ============================================================================
// A thin proxy. The exam's bank, its 85% threshold, the 26-module
// prerequisite, grading and persistence all live in Vault, which is the system
// of record — and the answer keys never leave it. This route forwards the
// caller's own session and adds nothing, so there is exactly ONE authoritative
// question bank behind both the Agent Portal and EASE.
//
// Self-service: the learner is whoever Vault authenticates from the forwarded
// token. No user id is accepted or forwarded from the body.
import { NextRequest } from 'next/server'
import { proxyToVault } from '@/lib/vault-forward'
import { requireAuth } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const VAULT_PATH = '/api/onboarding/hartfelt-ready/final-exam'

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

  // Forward ONLY the submission. `user_id` in particular is never passed on —
  // Vault derives the learner from the token, and forwarding a client-supplied
  // id would create a shape where one agent could sit another's exam.
  const { answers, idempotency_key } = (body ?? {}) as {
    answers?: Record<string, string>
    idempotency_key?: string
  }

  return proxyToVault(request, 'POST', VAULT_PATH, { answers, idempotency_key })
}
