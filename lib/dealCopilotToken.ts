// ============================================================================
// Deal Copilot token verifier (Portal side)
// ============================================================================
// Verifies the HMAC-signed link minted by Vault on broker approval. Uses the
// shared DEAL_INTAKE_SIGNING_SECRET so Portal can read the link without a
// round-trip — but state mutations still go through Vault's
// /api/deal-copilot/sessions/:id/client-confirm endpoint.

import crypto from 'crypto'
import { validateDealCopilotEnv } from './env'

// Fail-early env check — throws a descriptive error if DEAL_INTAKE_SIGNING_SECRET
// or VAULT_BASE_URL is missing. Cached after first successful call.
validateDealCopilotEnv()

function getSecret(): string {
  const s = process.env.DEAL_INTAKE_SIGNING_SECRET
  if (!s || s.length < 16) {
    throw new Error('DEAL_INTAKE_SIGNING_SECRET is missing or too short (need 16+ chars).')
  }
  return s
}

export function verifyClientToken(
  token: string
): { sessionId: string; exp: number } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [sessionId, expStr, sig] = parts
  const exp = parseInt(expStr, 10)
  if (!Number.isFinite(exp)) return null
  if (exp < Math.floor(Date.now() / 1000)) return null

  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(`${sessionId}.${exp}`)
    .digest('hex')

  if (sig.length !== expected.length) return null
  const ok = crypto.timingSafeEqual(
    Buffer.from(sig, 'hex'),
    Buffer.from(expected, 'hex')
  )
  return ok ? { sessionId, exp } : null
}

export interface StructuredDealLite {
  transaction_type?: 'buyer' | 'seller' | 'lease' | 'wholesale' | null
  property_address?: string | null
  buyer_name?: string | null
  seller_name?: string | null
  offer_amount?: number | null
  escrow_company?: string | null
  escrow_amount?: number | null
  financing_type?: string | null
  financing_down_pct?: number | null
  inspection_days?: number | null
  closing_days?: number | null
  closing_date?: string | null
}
