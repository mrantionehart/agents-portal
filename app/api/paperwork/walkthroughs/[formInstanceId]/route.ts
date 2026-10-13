import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ============================================================================
// LEASE-WALKTHROUGH-1 — client-callable read + save
// ============================================================================
// Pass-through. The checklist, the validation and the signer rules all live in
// Vault, which is the only reason EASE and this client cannot drift apart —
// re-implementing any of them here would undo that.
// ============================================================================

async function forward(request: NextRequest, id: string, init: RequestInit) {
  const response = await fetch(
    `${VAULT_API_URL}/paperwork/walkthroughs/${encodeURIComponent(id)}`,
    {
      ...init,
      headers: {
        Authorization: request.headers.get('authorization') || '',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  )
  const data = await response
    .json()
    .catch(() => ({ error: 'Unreadable response from Vault' }))
  return NextResponse.json(data, { status: response.status })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ formInstanceId: string }> },
) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const { formInstanceId } = await context.params
    return await forward(request, formInstanceId, { method: 'GET' })
  } catch (error) {
    console.error('[walkthroughs] get failed:', error)
    return NextResponse.json({ error: 'Failed to load walkthrough' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ formInstanceId: string }> },
) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const { formInstanceId } = await context.params
    const body = await request.text()
    return await forward(request, formInstanceId, { method: 'PATCH', body })
  } catch (error) {
    console.error('[walkthroughs] save failed:', error)
    return NextResponse.json({ error: 'Failed to save walkthrough' }, { status: 500 })
  }
}
