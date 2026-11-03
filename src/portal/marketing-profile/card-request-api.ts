// ============================================================================
// Card requests — the typed Agent Portal client for the Vault contract.
// ============================================================================
// Same shape and the same reasoning as ./api.ts, deliberately: the canonical
// `authFetch` (cached Supabase Bearer token + 401 self-heal — never
// getSession() on the request path) with `credentials: 'omit'`, which is the
// Vault CORS contract. It sends ONLY a reason and an optional note — never an
// agent_id, tenant_id, status or resolver field; Vault REFUSES those outright,
// and a client that sent them would be trusting something the server never
// honoured.
import { authFetch } from '@/lib/supabase'
import { VAULT_API_URL } from '@/lib/vault-client'
import { MarketingProfileError, NETWORK_ERROR_CODE, NON_CONTRACT_CODE } from './api'
import type { CardRequestReason, CardRequestState } from './types'

const REQUEST_URL = `${VAULT_API_URL}/agent/card-request`

/** Parse strictly as the Vault JSON contract, or the NON_CONTRACT sentinel.
 *  Raw HTML/text bodies are never read into a value that could reach a
 *  component — only whether the response parsed as our JSON. */
async function parseContract(res: Response): Promise<Record<string, unknown> | typeof NON_CONTRACT_CODE> {
  const ct = res.headers?.get?.('content-type') ?? ''
  if (!ct.toLowerCase().includes('application/json')) return NON_CONTRACT_CODE
  try {
    const body = (await res.json()) as unknown
    if (!body || typeof body !== 'object') return NON_CONTRACT_CODE
    return body as Record<string, unknown>
  } catch {
    return NON_CONTRACT_CODE
  }
}

function errorFrom(parsed: Record<string, unknown> | typeof NON_CONTRACT_CODE, status: number): MarketingProfileError {
  if (parsed === NON_CONTRACT_CODE) return new MarketingProfileError(NON_CONTRACT_CODE, status, false)
  const code = typeof parsed.code === 'string' ? parsed.code : 'UNKNOWN'
  return new MarketingProfileError(code, status, true)
}

/** GET the caller's own card-request position. */
export async function getCardRequest(): Promise<CardRequestState> {
  let res: Response
  try {
    res = await authFetch(REQUEST_URL, { method: 'GET', credentials: 'omit', cache: 'no-store' })
  } catch {
    throw new MarketingProfileError(NETWORK_ERROR_CODE, 0, false)
  }
  const parsed = await parseContract(res)
  if (!res.ok || parsed === NON_CONTRACT_CODE || parsed.success !== true || !parsed.data) {
    throw errorFrom(parsed, res.status)
  }
  return parsed.data as CardRequestState
}

/**
 * Raise one request. Returns the refreshed state.
 *
 * A 409 is NOT a failure from the agent's side — it means a request of theirs
 * is already waiting, which is what they were trying to achieve. The caller
 * reloads rather than showing an error; `REQUEST_ALREADY_OPEN` is preserved as
 * the code so it can be told apart from a genuine refusal.
 */
export async function raiseCardRequest(reason: CardRequestReason, note?: string): Promise<CardRequestState> {
  let res: Response
  try {
    res = await authFetch(REQUEST_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      // reason + note ONLY.
      body: JSON.stringify(note && note.trim() ? { reason, note: note.trim() } : { reason }),
    })
  } catch {
    throw new MarketingProfileError(NETWORK_ERROR_CODE, 0, false)
  }
  const parsed = await parseContract(res)
  if (!res.ok || parsed === NON_CONTRACT_CODE || parsed.success !== true || !parsed.data) {
    throw errorFrom(parsed, res.status)
  }
  return parsed.data as CardRequestState
}
