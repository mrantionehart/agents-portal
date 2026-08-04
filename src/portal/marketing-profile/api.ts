// ============================================================================
// Marketing-profile — the ONE typed Agent Portal client for the Vault contract.
// ============================================================================
// Consumes the approved Vault companion contracts via the canonical `authFetch`
// (cached Supabase Bearer token + 401 self-heal — NEVER getSession() on the
// request path) with `credentials: 'omit'` (the Vault CORS contract). It sends
// ONLY the image body / phone field — never agent_id / tenant_id / profile_id /
// bucket / path / hash. Returns typed product state + bounded, mapped errors;
// raw server bodies never reach components.
import { authFetch } from '@/lib/supabase'
import { VAULT_API_URL } from '@/lib/vault-client'
import type { MarketingProfileState } from './types'

const STATE_URL = `${VAULT_API_URL}/agent/marketing-profile`
const PHONE_URL = `${STATE_URL}/phone`
const AVATAR_URL = `${VAULT_API_URL}/agent/avatar`

/** Bounded error surfaced to the UI. `code` is a stable Vault code (or a client
 *  sentinel); the UI maps it to a friendly message. NEVER carries SQL / Supabase
 *  / storage / token / signed-URL / raw-body detail. `contract` is false when the
 *  response was NOT the expected Vault JSON envelope (non-JSON / empty / malformed
 *  — e.g. a platform HTML 404 from an undeployed route). */
export class MarketingProfileError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly contract: boolean = true,
  ) {
    super(code)
    this.name = 'MarketingProfileError'
  }
}

/** A network / CORS / abort failure (fetch rejected — no HTTP response). */
export const NETWORK_ERROR_CODE = 'NETWORK'
/** The response was not the expected Vault JSON contract (non-JSON / empty /
 *  malformed) — e.g. an undeployed route's platform HTML 404. */
export const NON_CONTRACT_CODE = 'NON_CONTRACT'

/**
 * Parse a response strictly as the Vault JSON contract. Returns the parsed
 * object, or the NON_CONTRACT sentinel when the response is NOT JSON (platform
 * HTML/text), is empty, or is malformed. Raw HTML/text bodies are NEVER read into
 * a value that could reach a component — only whether it parsed as our JSON.
 */
async function parseContract(res: Response): Promise<Record<string, unknown> | typeof NON_CONTRACT_CODE> {
  const ct = res.headers?.get?.('content-type') ?? ''
  if (!ct.toLowerCase().includes('application/json')) return NON_CONTRACT_CODE
  try {
    const body = (await res.json()) as unknown // throws on empty/malformed
    if (!body || typeof body !== 'object') return NON_CONTRACT_CODE
    return body as Record<string, unknown>
  } catch {
    return NON_CONTRACT_CODE // empty or malformed JSON
  }
}

/** Build a bounded error from a non-ok / non-contract response. Preserves the
 *  stable JSON `code` when present; otherwise a bounded generic. */
function errorFrom(parsed: Record<string, unknown> | typeof NON_CONTRACT_CODE, status: number): MarketingProfileError {
  if (parsed === NON_CONTRACT_CODE) return new MarketingProfileError(NON_CONTRACT_CODE, status, false)
  const code = typeof parsed.code === 'string' ? parsed.code : 'UNKNOWN'
  return new MarketingProfileError(code, status, true)
}

/** GET the caller's own marketing-profile state. */
export async function getMarketingProfile(): Promise<MarketingProfileState> {
  let res: Response
  try {
    res = await authFetch(STATE_URL, { method: 'GET', credentials: 'omit', cache: 'no-store' })
  } catch {
    throw new MarketingProfileError(NETWORK_ERROR_CODE, 0, false)
  }
  const parsed = await parseContract(res)
  if (!res.ok || parsed === NON_CONTRACT_CODE || parsed.success !== true || !parsed.data) {
    throw errorFrom(parsed, res.status)
  }
  return parsed.data as MarketingProfileState
}

/** Update ONLY the caller's own preferred_public_phone (null clears it). Returns
 *  the refreshed product state (normalized display + updated readiness). */
export async function updatePreferredPublicPhone(value: string | null): Promise<MarketingProfileState> {
  let res: Response
  try {
    res = await authFetch(PHONE_URL, {
      method: 'PATCH',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_public_phone: value }),
    })
  } catch {
    throw new MarketingProfileError(NETWORK_ERROR_CODE, 0, false)
  }
  const parsed = await parseContract(res)
  if (!res.ok || parsed === NON_CONTRACT_CODE || parsed.success !== true || !parsed.data) {
    throw errorFrom(parsed, res.status)
  }
  return parsed.data as MarketingProfileState
}

/** Upload/replace the caller's OWN headshot. Sends ONLY the image — never a
 *  target/tenant/storage field. Returns the refreshed product state. */
export async function uploadAvatar(file: File): Promise<MarketingProfileState> {
  const form = new FormData()
  form.append('file', file) // image ONLY — no agent_id/tenant_id/bucket/path/hash
  let res: Response
  try {
    // No explicit Content-Type → the browser sets the multipart boundary.
    res = await authFetch(AVATAR_URL, { method: 'POST', credentials: 'omit', body: form }, 20000)
  } catch {
    throw new MarketingProfileError(NETWORK_ERROR_CODE, 0, false)
  }
  const parsed = await parseContract(res)
  if (!res.ok || parsed === NON_CONTRACT_CODE || parsed.ok !== true || !parsed.marketingProfile) {
    throw errorFrom(parsed, res.status)
  }
  return parsed.marketingProfile as MarketingProfileState
}
