import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // For TC or Agent viewing their transactions
    if (userRole === 'tc' || userRole === 'agent') {
      const { data: transactions, error } = await supabase
        .from('tc_transactions')
        .select('*')
        .eq('tc_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching transactions:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: transactions || [],
      })
    }

    // For Broker viewing TC statistics
    if (userRole === 'broker') {
      // Get all TCs for this broker and their stats
      const { data: tcs, error: tcsError } = await supabase
        .from('transaction_coordinators')
        .select('id')
        .eq('broker_id', userId)

      if (tcsError) {
        console.error('Error fetching TCs:', tcsError)
        return NextResponse.json(
          { success: false, error: tcsError.message },
          { status: 400 }
        )
      }

      const tcIds = tcs?.map((tc) => tc.id) || []

      if (tcIds.length === 0) {
        return NextResponse.json({
          success: true,
          stats: {
            assigned_agents: 0,
            active_transactions: 0,
            pending_docs: 0,
            overdue_milestones: 0,
          },
          data: [],
        })
      }

      // Get transactions for all TCs
      const { data: transactions, error: txnError } = await supabase
        .from('tc_transactions')
        .select('*')
        .in('tc_id', tcIds)

      if (txnError) {
        console.error('Error fetching transactions:', txnError)
        return NextResponse.json(
          { success: false, error: txnError.message },
          { status: 400 }
        )
      }

      // Get documents
      const { data: documents, error: docError } = await supabase
        .from('tc_documents')
        .select('*')
        .in('tc_id', tcIds)

      if (docError) {
        console.error('Error fetching documents:', docError)
      }

      // Get milestones
      const { data: milestones, error: msError } = await supabase
        .from('tc_milestones')
        .select('*')
        .in('tc_id', tcIds)

      if (msError) {
        console.error('Error fetching milestones:', msError)
      }

      // Calculate stats
      const activeTransactions = (transactions || []).filter(
        (t) => t.status !== 'completed' && t.status !== 'stalled'
      )
      const pendingDocs = (documents || []).filter((d) => d.status === 'pending')
      const overdueMilestones = (milestones || []).filter((m) => m.status === 'overdue')

      // Get unique assigned agents
      const { data: assignments, error: assignError } = await supabase
        .from('tc_assignments')
        .select('agent_id')
        .in('tc_id', tcIds)
        .eq('status', 'approved')

      if (assignError) {
        console.error('Error fetching assignments:', assignError)
      }

      const uniqueAgents = new Set((assignments || []).map((a) => a.agent_id))

      return NextResponse.json({
        success: true,
        stats: {
          assigned_agents: uniqueAgents.size,
          active_transactions: activeTransactions.length,
          pending_docs: pendingDocs.length,
          overdue_milestones: overdueMilestones.length,
        },
        data: transactions || [],
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized role' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in transactions endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
