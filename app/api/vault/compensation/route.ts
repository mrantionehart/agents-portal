import { NextRequest, NextResponse } from 'next/server'
import { VAULT_API_URL } from '@/lib/vault-client'
import { requireAuth } from '@/lib/security/withAuth'

export const dynamic = 'force-dynamic'

// GET /api/vault/compensation — proxy to Vault's authoritative terms endpoint.
//
// HFOS-P1. Identical shape to the sibling `vault/commissions` proxy: the
// caller's Authorization header is forwarded and Vault's body AND status are
// returned verbatim. Vault owns the figures; this hop adds nothing and
// computes nothing.
//
// 🔑 A forwarder is only as authorized as what it forwards TO. `/api/broker/
// contract-training` returned 200 to anonymous callers purely because Vault
// did — the hop belonged to neither review. Vault's
// /api/agents/me/compensation is scoped to the CALLER (no id parameter) and
// 401s without a session, so there is nothing here for an unauthenticated
// request to reach.
export async function GET(request: NextRequest) {
  try {
    // Gate HERE as well as in Vault. The contract-training leak happened
    // because a forwarder relayed an empty Authorization header and returned
    // whatever came back: the hop authorized nothing and neither review owned
    // it. `requireAuth` also enforces is_active, so an invitee who has not
    // been promoted cannot pull terms.
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const authHeader = request.headers.get('authorization') || ''

    const response = await fetch(`${VAULT_API_URL}/agents/me/compensation`, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error fetching compensation from Vault:', error)
    return NextResponse.json(
      { error: 'Failed to fetch compensation' },
      { status: 500 }
    )
  }
}
