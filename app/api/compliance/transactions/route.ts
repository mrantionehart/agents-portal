import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userClient } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'


// GET — list transactions with compliance progress
export async function GET(request: NextRequest) {
  try {
    // FINSEC closeout — shared gate: 401 no session, 403 inactive/suspended/deleted.
    const auth = await requireAuth(request)
    if (auth.response) return auth.response
    const user = auth.user

    // Sprint D-3 Track C: was service-role; now user JWT + RLS.
    // Coverage matrix:
    //   profiles SELECT          profiles_select USING true
    //   transactions SELECT      agent self + broker/admin (3 OR'd policies)
    //   transaction_doc_requirements SELECT  doc_reqs_select USING true
    //   documents SELECT         broker/admin via documents_broker_admin_select;
    //                            agent sees own uploads (Users can view own documents)
    //                            + own-transaction docs (documents_agent_own_transaction_select
    //                            — new Track C policy). Together these reproduce
    //                            the pre-conversion service-role count behavior
    //                            (broker-uploaded docs on agent transactions are
    //                            now visible to the agent).
    const admin = userClient(request)

    // Get user role
    const { data: profile } = await admin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'agent'
    // FINSEC closeout — scope in code, not by RLS alone. Before: any role other
    // than exactly 'agent' (new_agent, tc, office_manager, a typo) read EVERY
    // transaction with client name and contract price, bounded only by RLS.
    // Now agent-tier roles see their own; every other role sees its own tenant,
    // and a caller with no tenant fails closed.
    const ownOnly = role === 'agent' || role === 'new_agent'
    const callerTenantId = (profile?.tenant_id as string | null) ?? null
    if (!ownOnly && !callerTenantId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Get transactions — agents see own, broker/admin see all
    let query = admin
      .from('transactions')
      .select('id, agent_id, type, status, property_address, city, state, client_name, contract_price, closing_date, contract_date, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    query = ownOnly
      ? query.eq('agent_id', user.id)
      : query.eq('tenant_id', callerTenantId as string)

    const { data: transactions, error: txError } = await query

    if (txError) throw txError

    // For each transaction, get document counts
    const txIds = (transactions || []).map(t => t.id)

    if (txIds.length === 0) {
      return NextResponse.json({ transactions: [], role })
    }

    // Get all requirements grouped by type
    const { data: allReqs } = await admin
      .from('transaction_doc_requirements')
      .select('transaction_type, is_required')
      .eq('is_active', true)

    // Get uploaded document counts per transaction
    const { data: docs } = await admin
      .from('documents')
      .select('transaction_id, status')
      .in('transaction_id', txIds)
      .is('deleted_at', null)

    // Build requirement counts by type
    const reqCounts: Record<string, { required: number; total: number }> = {}
    for (const req of allReqs || []) {
      if (!reqCounts[req.transaction_type]) {
        reqCounts[req.transaction_type] = { required: 0, total: 0 }
      }
      reqCounts[req.transaction_type].total++
      if (req.is_required) reqCounts[req.transaction_type].required++
    }

    // Build doc counts by transaction
    const docCounts: Record<string, { uploaded: number; approved: number }> = {}
    for (const doc of docs || []) {
      if (!docCounts[doc.transaction_id]) {
        docCounts[doc.transaction_id] = { uploaded: 0, approved: 0 }
      }
      docCounts[doc.transaction_id].uploaded++
      if (doc.status === 'verified') docCounts[doc.transaction_id].approved++
    }

    // Get agent names for broker view
    let agentNames: Record<string, string> = {}
    if (!ownOnly) {
      const agentIds = [...new Set((transactions || []).map(t => t.agent_id))]
      const { data: agents } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', agentIds)

      for (const a of agents || []) {
        agentNames[a.id] = a.full_name || 'Unknown'
      }
    }

    const enriched = (transactions || []).map(tx => {
      const reqs = reqCounts[tx.type] || { required: 0, total: 0 }
      const uploaded = docCounts[tx.id] || { uploaded: 0, approved: 0 }

      return {
        ...tx,
        agent_name: agentNames[tx.agent_id] || undefined,
        compliance: {
          required_docs: reqs.required,
          total_docs: reqs.total,
          uploaded: uploaded.uploaded,
          approved: uploaded.approved,
          progress: reqs.required > 0
            ? Math.round((uploaded.uploaded / reqs.required) * 100)
            : 0,
        },
      }
    })

    return NextResponse.json({ transactions: enriched, role })
  } catch (err) {
    console.error('Compliance transactions error:', err)
    return NextResponse.json({ error: 'Failed to load transactions' }, { status: 500 })
  }
}
