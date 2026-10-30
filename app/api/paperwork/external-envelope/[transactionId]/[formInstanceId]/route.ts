// ============================================================================
// AGENT PORTAL — POST /api/paperwork/external-envelope/[txn]/[formInstance]
// ============================================================================
// Forwards to Vault's external-envelope route, which records an envelope the
// agent sent from their own DocuSign. Vault owns every decision: approval
// state, checksum binding, duplicate refusal, and — the one that matters —
// reading the envelope back from the SENDING account to decide whether it is
// verified. This proxy decides nothing.
//
// 🔑🔑 IT FORWARDS THE BODY. The sibling compliance-review proxy does not,
// correctly, because that endpoint takes none — and copying it without
// noticing is how a forwarder silently drops a request body in this codebase
// already. Everything that identifies this envelope IS the body: the id, the
// recipients, when it was sent. A proxy that dropped it would reach Vault as
// an empty object and be refused as a malformed id, which reads to the agent
// as "your envelope ID is wrong" when in fact it never left the browser.
// `[XAP-3]` is the test that fails if the body stops being forwarded.
//
// 🔒 The Authorization header is passed through untouched; AP never mints or
// holds a Vault credential, and Vault re-authorizes on every call.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ transactionId: string; formInstanceId: string }> },
) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const { transactionId, formInstanceId } = await context.params

    // Read it as TEXT and send it on verbatim. Re-serializing through
    // JSON.parse would silently normalise or drop what Vault is about to
    // validate, and Vault — not this hop — is the validator.
    const body = await request.text()

    const response = await fetch(
      `${VAULT_API_URL}/paperwork/transactions/${encodeURIComponent(transactionId)}` +
        `/documents/${encodeURIComponent(formInstanceId)}/external-envelope`,
      {
        method: 'POST',
        headers: {
          Authorization: request.headers.get('authorization') || '',
          'Content-Type': 'application/json',
        },
        body,
        cache: 'no-store',
      },
    )

    const data = await response
      .json()
      .catch(() => ({ error: 'Unreadable response from Vault' }))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[external-envelope] proxy failed:', error)
    return NextResponse.json(
      { error: 'Could not reach Vault to record the envelope.' },
      { status: 502 },
    )
  }
}
