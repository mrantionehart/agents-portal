// ============================================================================
// Association Membership — server-side forwarder to Vault
// ============================================================================
// Vault's /api/association/* carries no CORS, so the portal proxies it.
// 🔒 ADDS NO AUTHORITY: forwards the caller's bearer and the body unchanged —
// no service role, no tenant id, no role. Vault decides who may see or do what
// (own records for an agent; Broker of Record for determinations).
// 🔒 STATUS PASSES THROUGH; an unreadable body is a 502, never a fake success.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { VAULT_API_URL } from '@/lib/vault-client'

export async function forwardToVault(request: NextRequest, vaultPath: string, method: 'GET' | 'POST'): Promise<NextResponse> {
  try {
    const search = new URL(request.url).search
    const body = method === 'POST' ? await request.text() : undefined
    const response = await fetch(`${VAULT_API_URL}${vaultPath}${method === 'GET' ? search : ''}`, {
      method,
      headers: { Authorization: request.headers.get('authorization') || '', 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    if (data === null) return NextResponse.json({ error: 'Vault response unreadable', code: 'vault_unreadable' }, { status: 502 })
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Vault unreachable', code: 'vault_unreachable' }, { status: 502 })
  }
}
