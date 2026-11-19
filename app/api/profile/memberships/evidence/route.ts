// MDC-1 — agent evidence upload (membership confirmation, renewal receipt, MLS
// confirmation), forwarded to Vault as multipart. Only `file`, `kind` and ONE
// record id are forwarded; never agent_id / tenant_id / bucket / path / hash.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security'
import { resolveAccessToken } from '@/lib/vault-forward'
import { VAULT_API_URL } from '@/lib/vault-client'
import { membershipSectionEnabled } from '@/src/portal/profile/membership-flag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// financial_item_id: a response on the agent's OWN reimbursement case (R7d); Vault re-checks it.
const FORWARDED = ['kind', 'membership_id', 'mls_subscription_id', 'request_id', 'financial_item_id'] as const
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  if (!membershipSectionEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  const token = await resolveAccessToken(request)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 })
  }
  const file = form.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'missing_file' }, { status: 400 })
  if ((file as Blob).size > MAX_BYTES) return NextResponse.json({ error: 'Files must be under 10 MB' }, { status: 413 })

  const out = new FormData()
  out.append('file', file as Blob, (file as File).name || 'evidence')
  for (const k of FORWARDED) {
    const v = form.get(k)
    if (typeof v === 'string' && v) out.append(k, v)
  }
  let res: Response
  try {
    res = await fetch(`${VAULT_API_URL}/agent/membership-compliance/evidence`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: out,
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ error: 'vault_unreachable' }, { status: 502 })
  }
  const payload = await res.json().catch(() => null)
  return NextResponse.json(payload ?? {}, { status: res.status })
}
