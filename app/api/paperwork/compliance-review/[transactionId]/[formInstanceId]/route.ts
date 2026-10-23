import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ============================================================================
// P4H-13 — client-callable automatic compliance review
// ============================================================================
// Pure forwarder. Vault owns the review: the verdict, the findings, and the
// decision about which audience sees the approval card. This route adds no
// rule of its own, because a second place that could decide a verdict is a
// second place that could disagree with the first.
//
// It forwards the Authorization header and nothing else, so Vault's gate —
// tenant scope, then assigned-agent — is what answers. The status is passed
// through verbatim: a 404 for a cross-tenant read has to stay a 404, and a 400
// for "this form is not reviewable" must not be flattened into an empty pass.
// ============================================================================

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ transactionId: string; formInstanceId: string }> },
) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const { transactionId, formInstanceId } = await context.params
    const response = await fetch(
      `${VAULT_API_URL}/paperwork/transactions/${encodeURIComponent(transactionId)}` +
        `/documents/${encodeURIComponent(formInstanceId)}/compliance-review`,
      {
        method: 'GET',
        headers: { Authorization: request.headers.get('authorization') || '' },
        cache: 'no-store',
      },
    )
    const data = await response
      .json()
      .catch(() => ({ error: 'Unreadable response from Vault' }))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[compliance-review] proxy failed:', error)
    return NextResponse.json({ error: 'Failed to load review' }, { status: 500 })
  }
}
