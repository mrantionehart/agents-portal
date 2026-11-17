// ============================================================================
// LEAD-POOL · claim a pooled brokerage lead (HartFelt REAL ESTATE)
// ============================================================================
// Calls Vault's existing claim — the same path EASE uses — with the agent's
// own Bearer token. Vault decides: tenant, agent role, the lead's audience
// (selected-group leads answer 404 to anyone outside it) and first-claim-wins.
// 🔒 Sends nothing but the action; there is no agent or tenant parameter.
// ============================================================================
import { authFetch } from '@/lib/supabase'

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? 'https://vault.hartfeltrealestate.com/api'
).replace(/\/$/, '')

// Flat on purpose: this repo's TS settings do not narrow a discriminated union
// on a boolean literal, so `reason`/`message` are optional and present when !ok.
export interface ClaimResult {
  ok: boolean
  reason?: 'taken' | 'gone' | 'forbidden' | 'error'
  message?: string
}

export async function claimPooledLead(clientProfileId: string): Promise<ClaimResult> {
  let res: Response
  try {
    res = await authFetch(`${VAULT_API_URL}/client-intelligence/${encodeURIComponent(clientProfileId)}/dispo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim' }),
    })
  } catch {
    return { ok: false, reason: 'error', message: 'Could not reach the server.' }
  }
  if (res.ok) return { ok: true }
  if (res.status === 409) return { ok: false, reason: 'taken', message: 'Another agent claimed this lead first.' }
  if (res.status === 404) return { ok: false, reason: 'gone', message: 'This lead is no longer available to you.' }
  if (res.status === 401) return { ok: false, reason: 'forbidden', message: 'Please sign in again.' }
  if (res.status === 403) {
    return { ok: false, reason: 'forbidden', message: 'Only active agents with a verified licence can claim leads.' }
  }
  return { ok: false, reason: 'error', message: `Could not claim the lead (${res.status}).` }
}
