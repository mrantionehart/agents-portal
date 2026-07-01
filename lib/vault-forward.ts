// ============================================================================
// AGENT.SIGN.1B — Vault forwarding helpers (Phase 0)
// ============================================================================
// Server-side helpers for agents-portal API routes to call Vault agent-tier
// endpoints on behalf of the current user. Vault gates on a Supabase Bearer
// token (gateCaller), so we resolve the caller's access token from the
// incoming request (Authorization header first, then the cookie session) and
// forward it.
// ============================================================================

import { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { VAULT_API_URL } from './vault-client'

/** Resolve the caller's Supabase access token: Bearer header, else cookie
 *  session. Returns null when the request carries no usable session. */
export async function resolveAccessToken(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    if (token) return token
  }
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          // read-only: this helper never mutates the response cookies.
          set(_name: string, _value: string, _options: CookieOptions) {},
          remove(_name: string, _options: CookieOptions) {},
        },
      }
    )
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

export interface EnsureVaultFormsResult {
  ok: boolean
  status: number
  body: {
    ok?: boolean
    materialized?: number
    requirements?: Array<{
      form_id: string
      form_name: string
      category: string
      form_revision: string | null
      required: boolean
      reason: string
    }>
    documents?: Array<{
      form_instance_id: string
      form_id: string
      form_name: string
      category: string
      disposition: string
      status_label: string
      downloadable: boolean
      last_updated: string
    }>
    error?: string
  } | null
}

/**
 * POST Vault ensure-forms for a transaction: materializes form_instances from
 * the Vault rule engine (System A) and returns the agent-safe requirements +
 * documents projection. Idempotent — safe to call on create and on every
 * checklist load.
 */
export async function ensureVaultForms(
  request: NextRequest,
  transactionId: string,
  vaultTransactionType?: string | null
): Promise<EnsureVaultFormsResult> {
  const token = await resolveAccessToken(request)
  if (!token) return { ok: false, status: 401, body: { error: 'no_access_token' } }

  try {
    const res = await fetch(
      `${VAULT_API_URL}/paperwork/agents/transactions/${transactionId}/ensure-forms`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // AGENT.SIGN.1B.5 — forward the mapped Vault type so derivation uses
        // the correct rules (e.g. portal 'seller' → 'listing').
        body: JSON.stringify(
          vaultTransactionType ? { transaction_type: vaultTransactionType } : {}
        ),
        cache: 'no-store',
      }
    )
    const body = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    console.error('[vault-forward] ensureVaultForms failed:', err)
    return { ok: false, status: 502, body: { error: 'vault_unreachable' } }
  }
}
