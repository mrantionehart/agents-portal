import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ============================================================================
// LEASE-WALKTHROUGH-1 — client-callable send
// ============================================================================
// Pass-through. Vault refuses on its own terms — not generated yet, no
// designated signers, already sent — and those messages are forwarded verbatim
// because they are precisely what tells the agent what to do next.
//
// The body is forwarded too. Vault's one-sided safeguard answers 409 +
// requires_confirmation:'one_sided' and only relents on
// { confirm_one_sided: true }; a forwarder that dropped the body would turn
// "Send anyway" into a button that 409s forever. This route does NOT invent
// that flag — it only carries what the client sent.
// ============================================================================

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ formInstanceId: string }> },
) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const { formInstanceId } = await context.params
    const body = await request.text().catch(() => '')
    const response = await fetch(
      `${VAULT_API_URL}/paperwork/walkthroughs/${encodeURIComponent(formInstanceId)}/send`,
      {
        method: 'POST',
        headers: {
          Authorization: request.headers.get('authorization') || '',
          'Content-Type': 'application/json',
        },
        body: body || '{}',
        cache: 'no-store',
      },
    )
    const data = await response
      .json()
      .catch(() => ({ error: 'Unreadable response from Vault' }))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[walkthroughs] send failed:', error)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
