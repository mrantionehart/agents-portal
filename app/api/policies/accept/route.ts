import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

// ============================================================================
// A4 · POST /api/policies/accept — forwarder to Vault
// ============================================================================
// 🔒 ADDS NO AUTHORITY: the caller's bearer is the only identity forwarded.
// 🔒 FORWARDS ONLY THE CONTRACT KEYS: `policy_version_id`, `document_sha256`
// (exactly as sent — never rewritten), `sections` (string keys), and
// `client`, which is pinned to 'agent_portal'. Anything else in the body —
// a user id, a tenant id, an accepted_at — is dropped.
// 🔒 STATUS PASSES THROUGH so the browser can tell 409 `stale_document` from
// a 503; an unreadable Vault body is a 502, never `{ok:true}`.
// ============================================================================

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (request: NextRequest) => {
  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { policy_version_id, document_sha256, sections } = body
  if (typeof policy_version_id !== 'string' || typeof document_sha256 !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'policy_version_id and document_sha256 are required.' },
      { status: 400 },
    )
  }
  if (sections !== undefined && !(Array.isArray(sections) && sections.every((s) => typeof s === 'string'))) {
    return NextResponse.json({ ok: false, error: 'sections must be an array of strings.' }, { status: 400 })
  }

  const forwarded: Record<string, unknown> = {
    policy_version_id,
    document_sha256,
    client: 'agent_portal',
  }
  if (sections !== undefined) forwarded.sections = sections

  try {
    const authHeader = request.headers.get('authorization') || ''
    const response = await fetch(`${VAULT_API_URL}/policies/accept`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(forwarded),
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    if (data === null) {
      return NextResponse.json(
        { ok: false, code: 'vault_policies_unreadable' },
        { status: 502 },
      )
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ ok: false, code: 'vault_policies_unreachable' }, { status: 502 })
  }
})
