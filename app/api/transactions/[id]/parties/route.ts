// ============================================================================
// TRANSACTION OS 3.3B.3D — Agent Portal → Vault party forward
// ============================================================================
// Thin proxy: forwards a single party create to the Vault agent party endpoint
// (Transaction OS 3.3B.2) on behalf of the current user. Mirrors the
// ensureVaultForms forwarding pattern — resolve the caller's Supabase access
// token, attach it as a Bearer, pass the body through, return Vault's response.
//
// It performs no document or paperwork work of its own: the Vault endpoint owns
// validation (14 roles, email format, name/company) and the fail-open form
// recompute. This route only proxies party creation.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/security'
import { resolveAccessToken } from '@/lib/vault-forward'
import { VAULT_API_URL } from '@/lib/vault-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Authenticated route: the caller must have a valid session. Vault does the
    // real authorization (agent must own the transaction).
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const token = await resolveAccessToken(request)
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    let res: Response
    try {
      res = await fetch(
        `${VAULT_API_URL}/paperwork/agents/transactions/${id}/parties`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body ?? {}),
          cache: 'no-store',
        }
      )
    } catch (err) {
      console.error('[transactions/parties] Vault unreachable:', err)
      return NextResponse.json({ error: 'vault_unreachable' }, { status: 502 })
    }

    // Pass Vault's status + JSON straight through (201 / 400 / 404 / 500).
    const payload = await res.json().catch(() => null)
    return NextResponse.json(payload ?? {}, { status: res.status })
  } catch (err) {
    console.error('[transactions/parties] forward error:', err)
    return NextResponse.json({ error: 'Failed to create party' }, { status: 500 })
  }
}
