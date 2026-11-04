// ============================================================================
// AGENT PORTAL — POST /api/paperwork/external-envelope/refresh/[envelopeRowId]
// ============================================================================
// Asks Vault to re-read the envelope from the sending DocuSign account. Vault
// refuses a native envelope, refuses to move an unverified record past `sent`,
// and on a verified completion stores the executed PDF and the certificate.
//
// 🔒 THIS IS NOT A RESEND. Nothing here creates an envelope, sends a reminder
// or re-sends anything — the only provider traffic Vault makes on this path is
// one status read and two document reads. `[XAP-7]` pins that the proxy's URL
// contains no send surface, which is also what the nav contract forbids.
//
// No body: the envelope row id is the whole request.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ envelopeRowId: string }> },
) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const { envelopeRowId } = await context.params

    const response = await fetch(
      `${VAULT_API_URL}/paperwork/envelopes/${encodeURIComponent(envelopeRowId)}/external-refresh`,
      {
        method: 'POST',
        headers: { Authorization: request.headers.get('authorization') || '' },
        cache: 'no-store',
      },
    )

    const data = await response
      .json()
      .catch(() => ({ error: 'Unreadable response from Vault' }))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[external-envelope/refresh] proxy failed:', error)
    return NextResponse.json(
      { error: 'Could not reach Vault to refresh the envelope.' },
      { status: 502 },
    )
  }
}
