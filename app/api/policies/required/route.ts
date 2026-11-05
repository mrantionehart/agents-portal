import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

// ============================================================================
// A4 · GET /api/policies/required — forwarder to Vault
// ============================================================================
// A server-side proxy because Vault's `/api/policies/*` carries no CORS.
// 🔒 ADDS NO AUTHORITY: forwards the caller's bearer and nothing else — no
// service role, no tenant id, no role. Vault decides audience and tenant.
// 🔒 STATUS PASSES THROUGH. A 503 `{required:null, failClosed:true}` stays a
// 503; an unreadable body becomes a 502 `failClosed`, never `required: []`.
// ============================================================================

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const response = await fetch(`${VAULT_API_URL}/policies/required`, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    if (data === null) {
      return NextResponse.json(
        { required: null, failClosed: true, code: 'vault_policies_unreadable' },
        { status: 502 },
      )
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { required: null, failClosed: true, code: 'vault_policies_unreachable' },
      { status: 502 },
    )
  }
})
