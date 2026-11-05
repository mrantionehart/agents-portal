// ============================================================================
// A4 — policy acknowledgments, browser client
// ============================================================================
// 🔒 THE SERVER IS THE ONLY PROOF. Nothing here reads or writes localStorage,
// sessionStorage or any other client flag. "Owed" vs "clear" is decided by
// Vault's `/api/policies/required`, reached through AP's own forwarder
// (`app/api/policies/required`) because Vault carries no CORS on that route.
//
// 🔒 FAIL CLOSED. A 503, a network failure, a timeout, a non-JSON body,
// `required: null` or a malformed item is `error` — never `clear`. Only a 200
// with a well-formed `required: []` is clear.
//
// 🔑 NO ROLE FILTER. Whatever Vault returns is what is owed; the audience
// (agent, new_agent, office_manager, staff …) is decided server-side.
//
// 🔑 NO TENANT ID. The only identity sent is the caller's bearer, attached by
// `authFetch`. Tenant isolation is Vault's.
// ============================================================================

import { authFetch } from '@/lib/supabase'

export interface PolicySection {
  key: string
  title: string
}

export interface RequiredPolicy {
  id: string
  policy_key: string
  version: string
  title: string
  document_sha256: string
  document_url: string | null
  effective_at: string | null
  material_change: boolean
  acknowledge_by: string | null
  sections: PolicySection[]
}

export type RequiredResult =
  | { kind: 'loaded'; required: RequiredPolicy[]; noticeDays: number | null }
  /** Vault says this role is outside the acknowledgment audience entirely. */
  | { kind: 'not_applicable' }
  /** 401 / account_not_active — the existing auth and standing gates own this. */
  | { kind: 'deferred' }
  | { kind: 'error'; status: number }

/** `ok` is true ONLY for a 201/200 carrying `{ok:true}` from Vault. */
export interface AcceptResult {
  ok: boolean
  already: boolean
  status: number
  refusal: string | null
}

const SHA256_HEX = /^[0-9a-f]{64}$/i

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

/** Returns null when the item is not something we can safely display. */
function parseItem(raw: unknown): RequiredPolicy | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  const title = str(r.title)
  const sha = str(r.document_sha256)
  const version =
    typeof r.version === 'number' ? String(r.version) : str(r.version)
  if (!id || !title || !sha || !version || !SHA256_HEX.test(sha)) return null

  let sections: PolicySection[] = []
  if (r.sections !== undefined && r.sections !== null) {
    if (!Array.isArray(r.sections)) return null
    for (const s of r.sections) {
      const key = str((s as Record<string, unknown>)?.key)
      const stitle = str((s as Record<string, unknown>)?.title)
      if (!key || !stitle) return null
      sections.push({ key, title: stitle })
    }
  }

  return {
    id,
    policy_key: str(r.policy_key) ?? id,
    version,
    title,
    // Sent back EXACTLY as received — no case-folding, no trimming.
    document_sha256: r.document_sha256 as string,
    document_url: str(r.document_url),
    effective_at: str(r.effective_at),
    material_change: r.material_change === true,
    acknowledge_by: str(r.acknowledge_by),
    sections,
  }
}

/** Pure parser, exported for tests. Anything unexpected is an error. */
export function parseRequiredResponse(status: number, body: unknown): RequiredResult {
  const b = (body && typeof body === 'object' ? body : null) as Record<string, unknown> | null

  if (status === 401) return { kind: 'deferred' }
  if (status === 403) {
    const reason = b ? str(b.reason) ?? str(b.refusal) : null
    if (reason === 'role_not_permitted') return { kind: 'not_applicable' }
    if (reason === 'account_not_active') return { kind: 'deferred' }
    return { kind: 'error', status }
  }
  if (status !== 200 || !b) return { kind: 'error', status }
  if (!Array.isArray(b.required)) return { kind: 'error', status }

  const required: RequiredPolicy[] = []
  for (const raw of b.required) {
    const item = parseItem(raw)
    // One unreadable item makes the whole answer unreadable: dropping it
    // would quietly turn "owed" into "clear".
    if (!item) return { kind: 'error', status }
    required.push(item)
  }
  const noticeDays = typeof b.notice_days === 'number' ? b.notice_days : null
  return { kind: 'loaded', required, noticeDays }
}

export async function fetchRequiredPolicies(): Promise<RequiredResult> {
  try {
    const res = await authFetch('/api/policies/required', { cache: 'no-store' })
    const body = await res.json().catch(() => null)
    return parseRequiredResponse(res.status, body)
  } catch {
    return { kind: 'error', status: 0 }
  }
}

export async function acceptPolicy(
  policy: RequiredPolicy,
  sectionKeys: string[],
): Promise<AcceptResult> {
  try {
    const payload: Record<string, unknown> = {
      policy_version_id: policy.id,
      document_sha256: policy.document_sha256,
      client: 'agent_portal',
    }
    if (policy.sections.length > 0) payload.sections = sectionKeys
    const res = await authFetch('/api/policies/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if ((res.status === 201 || res.status === 200) && body?.ok === true) {
      return { ok: true, already: body.already === true, status: res.status, refusal: null }
    }
    return {
      ok: false,
      already: false,
      status: res.status,
      refusal: body ? str(body.refusal) ?? str(body.reason) : null,
    }
  } catch {
    return { ok: false, already: false, status: 0, refusal: null }
  }
}

/** First 12 hex characters, for display. */
export function shortHash(sha: string): string {
  return sha.slice(0, 12)
}

/** Only http(s) links are rendered; anything else is not a document link. */
export function safeDocumentUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url, 'https://placeholder.invalid')
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.origin === 'https://placeholder.invalid' ? url : u.toString()
  } catch {
    return null
  }
}
