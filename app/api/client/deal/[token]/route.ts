// ============================================================================
// POST /api/client/deal/[token] — Portal proxy to Vault's shared service
// ============================================================================
// The Portal verifies the token locally for a fast 401, then forwards to Vault
// so all state transitions still flow through ONE shared Deal Copilot service.

import { NextRequest, NextResponse } from 'next/server'
import { verifyClientToken } from '@/lib/dealCopilotToken'

const VAULT_BASE =
  process.env.VAULT_BASE_URL ||
  process.env.NEXT_PUBLIC_VAULT_BASE_URL ||
  'https://hartfelt-vault.vercel.app'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const verified = verifyClientToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body?.action
    const notes = body?.notes ?? null
    if (action !== 'confirm' && action !== 'request_changes') {
      return NextResponse.json(
        { error: "action must be 'confirm' or 'request_changes'" },
        { status: 400 }
      )
    }

    const vaultRes = await fetch(
      `${VAULT_BASE.replace(/\/$/, '')}/api/deal-copilot/sessions/${verified.sessionId}/client-confirm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, notes }),
      }
    )
    const json = await vaultRes.json().catch(() => ({}))
    if (!vaultRes.ok) {
      return NextResponse.json(
        { error: json?.error || `Vault returned ${vaultRes.status}` },
        { status: vaultRes.status }
      )
    }
    return NextResponse.json(json, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
