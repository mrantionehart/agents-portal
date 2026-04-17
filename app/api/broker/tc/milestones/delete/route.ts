import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Only agents and TCs can delete milestones
    if (!['agent', 'tc'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to delete milestones' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { milestone_id } = body

    if (!milestone_id) {
      return NextResponse.json(
        { success: false, error: 'Milestone ID is required' },
        { status: 400 }
      )
    }

    // Verify milestone exists and user has access to it
    const { data: milestone, error: fetchError } = await supabase
      .from('tc_milestones')
      .select('id, transaction_id')
      .eq('id', milestone_id)
      .single()

    if (fetchError || !milestone) {
      return NextResponse.json(
        { success: false, error: 'Milestone not found' },
        { status: 404 }
      )
    }

    // Verify transaction and check access
    const { data: transaction, error: txnError } = await supabase
      .from('tc_transactions')
      .select('id, agent_id, tc_id')
      .eq('id', milestone.transaction_id)
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
          : false

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to delete this milestone' },
        { status: 403 }
      )
    }

    // Soft delete milestone by setting is_deleted flag
    const { data: deletedMilestone, error: deleteError } = await supabase
      .from('tc_milestones')
      .update({ is_deleted: true })
      .eq('id', milestone_id)
      .select()
      .single()

    if (deleteError) {
      console.error('Error deleting milestone:', deleteError)
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Milestone deleted successfully',
      data: deletedMilestone,
    })
  } catch (error) {
    console.error('Error in milestone deletion endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
