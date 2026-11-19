// FL-CAT-1 — the deal's own agent answers the two controlled questions that
// decide the Brokerage Relationship Disclosure and Proof of Earnest Money.
// Thin proxy: Vault is the system of record and the only authority (own deal
// only; agent edits only while draft / revisions_required; controlled values).
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  const { id } = await params
  return proxyToVault(request, 'GET', `/transactions/${encodeURIComponent(id)}/compliance-facts`)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  // Forward only the two controlled keys; Vault validates the values.
  const forwarded: Record<string, unknown> = {}
  for (const key of ['brokerage_relationship', 'earnest_money_status']) {
    if (key in body) forwarded[key] = (body as Record<string, unknown>)[key]
  }
  return proxyToVault(request, 'POST', `/transactions/${encodeURIComponent(id)}/compliance-facts`, forwarded)
}
