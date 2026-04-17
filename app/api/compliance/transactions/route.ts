import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

async function getAuthedUser(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) return null
      return data.user
    } catch { return null }
  }
  try {
    const stubResponse = NextResponse.json({})
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { stubResponse.cookies.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { stubResponse.cookies.delete(name) },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch { return null }
}

// GET — list transactions with compliance progress
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'agent'

    // Get transactions — agents see own, broker/admin see all
    let query = admin
      .from('transactions')
      .select('id, agent_id, type, status, property_address, city, state, client_name, contract_price, closing_date, contract_date, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (role === 'agent') {
      query = query.eq('agent_id', user.id)
    }

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
    if (role !== 'agent') {
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
