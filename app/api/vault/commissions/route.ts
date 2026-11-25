import { NextRequest, NextResponse } from 'next/server'
import { VAULT_API_URL } from '@/lib/vault-client'
import { requireAuth } from '@/lib/security/withAuth'

export const dynamic = 'force-dynamic'

// GET /api/vault/commissions — proxy to Vault's caller-scoped commission list.
//
// FINSEC P0-4. This hop used to forward whatever Authorization header arrived
// and return Vault's body verbatim, with no AP-side gate at all: the route was
// exactly as authorized as Vault happened to be. It now self-gates the same
// way the sibling `vault/compensation` proxy does (middleware.ts excludes
// /api/*, so nothing upstream gates it):
//
//   • requireAuth → 401 with no valid session, 403 for an inactive/suspended/
//     deleted account. Vault is never called in either case.
//   • Only a validated Bearer token is forwarded. A cookie-only session has no
//     token to hand Vault, so it is refused here rather than relaying an empty
//     header and letting the downstream decide.
//   • No query parameters are forwarded: Vault's /commissions/get is scoped to
//     the token's own user, and this hop gives the caller no way to widen it.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(`${VAULT_API_URL}/commissions/get`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error fetching commissions from Vault:', error)
    return NextResponse.json(
      { error: 'Failed to fetch commissions' },
      { status: 500 }
    )
  }
}
