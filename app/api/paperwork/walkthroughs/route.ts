import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security'
import { VAULT_API_URL } from '@/lib/vault-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ============================================================================
// LEASE-WALKTHROUGH-1 — client-callable list + create
// ============================================================================
// A forwarder, nothing more. Vault owns every rule here: tenant scope, the
// assigned-agent check, the duplicate guard. requireAuth only stops an
// unauthenticated caller at the edge rather than forwarding a bad Bearer.
//
// Statuses are forwarded VERBATIM, 409 included — "a completed walkthrough of
// this type already exists" is a real answer the UI must act on (it prompts
// for confirm_new), not a failure to flatten into a 500.
// ============================================================================

async function forward(request: NextRequest, transactionId: string, init: RequestInit) {
  const response = await fetch(
    `${VAULT_API_URL}/paperwork/transactions/${encodeURIComponent(transactionId)}/walkthroughs`,
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const transactionId = new URL(request.url).searchParams.get('transaction_id')
    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction_id' }, { status: 400 })
    }
    return await forward(request, transactionId, { method: 'GET' })
  } catch (error) {
    console.error('[walkthroughs] list failed:', error)
    return NextResponse.json({ error: 'Failed to load walkthroughs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const body = (await request.json().catch(() => ({}))) as {
      transaction_id?: string
      [k: string]: unknown
    }
    if (!body.transaction_id) {
      return NextResponse.json({ error: 'Missing transaction_id' }, { status: 400 })
    }
    const { transaction_id, ...rest } = body
    return await forward(request, transaction_id, {
      method: 'POST',
      body: JSON.stringify(rest),
    })
  } catch (error) {
    console.error('[walkthroughs] create failed:', error)
    return NextResponse.json({ error: 'Failed to create walkthrough' }, { status: 500 })
  }
}
