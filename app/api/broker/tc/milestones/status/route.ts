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

    const { searchParams } = new URL(req.url)
    const transactionId = searchParams.get('transaction_id')

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    // Verify transaction exists and user has access to it
    const { data: transaction, error: txnError } = await supabase
      .from('tc_transactions')
      .select('id, agent_id, tc_id')
      .eq('id', transactionId)
      .single()

    if (txnError || !transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Check user has access to this transaction
    const hasAccess =
      userRole === 'agent'
        ? transaction.agent_id === userId
        : userRole === 'tc'
          ? transaction.tc_id === userId
          : userRole === 'broker'
          ? true
          : false

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to view milestone status for this transaction' },
        { status: 403 }
      )
    }

    // Get milestone statistics
    const { data: milestones, error: msError } = await supabase
      .from('tc_milestones')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('is_deleted', false)

    if (msError) {
      console.error('Error fetching milestones:', msError)
      return NextResponse.json(
        { success: false, error: msError.message },
        { status: 400 }
      )
    }

    const milestoneList = milestones || []

    // Calculate statistics
    const totalMilestones = milestoneList.length
    const completedMilestones = milestoneList.filter((m) => m.status === 'completed').length
    const pendingMilestones = milestoneList.filter((m) => m.status === 'pending').length
    const overdueMilestones = milestoneList.filter((m) => m.status === 'overdue').length
    const completionPercentage = totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100)

    return NextResponse.json({
      success: true,
      data: {
        transaction_id: transactionId,
        total_milestones: totalMilestones,
        completed_milestones: completedMilestones,
        pending_milestones: pendingMilestones,
        overdue_milestones: overdueMilestones,
        completion_percentage: completionPercentage,
        milestones: milestoneList.map((m) => ({
          id: m.id,
          milestone_name: m.milestone_name,
          description: m.description,
          status: m.status,
          due_date: m.due_date,
          completed_date: m.completed_date,
          order: m.order,
        })),
      },
    })
  } catch (error) {
    console.error('Error in milestone status endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
