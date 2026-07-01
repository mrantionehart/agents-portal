import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'
import { ensureVaultForms } from '@/lib/vault-forward'
import { mapPortalTransactionTypeToVaultType } from '@/lib/portal-transaction-type'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// AGENT.SIGN.1C — client-callable checklist source. Returns the agent-safe
// Vault projection ({ requirements, documents }) for the transaction document
// checklist. Ownership is doubly enforced: (a) the RLS-scoped transactions read
// below (agents see only their own) and (b) Vault ensure-forms' assignment gate.
// No field_map / tenant_id / paths / checksums cross this boundary — the Vault
// projections already scrub them.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transaction_id')
    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction_id' }, { status: 400 })
    }

    // RLS: agents see only their own transactions → cross-user → no row → 404.
    const supabase = userClient(request)
    const { data: tx, error } = await supabase
      .from('transactions')
      .select('type')
      .eq('id', transactionId)
      .is('deleted_at', null)
      .single()
    if (error || !tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const mapped = mapPortalTransactionTypeToVaultType(tx.type)
    if (!mapped.supported || !mapped.vaultType) {
      // Legacy types (referral/wholesale/double_close) are not covered by
      // Vault System A — the checklist is empty for these (no fabrication).
      return NextResponse.json({
        requirements: [],
        documents: [],
        supported: false,
      })
    }

    const ensured = await ensureVaultForms(request, transactionId, mapped.vaultType)
    if (!ensured.ok) {
      return NextResponse.json(
        {
          requirements: [],
          documents: [],
          supported: true,
          error: ensured.body?.error ?? 'vault_unavailable',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      requirements: ensured.body?.requirements ?? [],
      documents: ensured.body?.documents ?? [],
      supported: true,
    })
  } catch (err) {
    console.error('[paperwork/checklist] error:', err)
    return NextResponse.json({ error: 'Failed to load checklist' }, { status: 500 })
  }
}
