// MDC-1 — the agent acknowledges a written membership/assessment disclosure
// addressed to them. Forwarded to Vault, which checks it is the caller's own.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security'
import { proxyToVault } from '@/lib/vault-forward'
import { membershipSectionEnabled } from '@/src/portal/profile/membership-flag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!membershipSectionEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const auth = await requireAuth(request)
  if (auth.response) return auth.response
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  return proxyToVault(request, 'POST', `/agent/membership-compliance/disclosures/${id}/acknowledge`, {})
}
