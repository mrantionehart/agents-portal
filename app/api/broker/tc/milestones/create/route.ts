import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Only agents and TCs can create milestones
    if (!['agent', 'tc'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to create milestones' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { transaction_id, milestone_name, due_date, description } = body

    // Validate required fields
    if (!transaction_id) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    if (!milestone_name || !milestone_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Milestone name is required' },
        { status: 400 }
      )
    }

    if (!due_date) {
      return NextResponse.json(
        { success: false, error: 'Due date is required' },
        { status: 400 }
      )
    }

    // Verify transaction exists and user has access to it
    const { data: transaction, error: txnError } = await supabase
      .from('tc_transactions')
      .select('id, agent_id, tc_id')
      .eq('id', transaction_id)
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
        { success: false, error: 'Unauthorized to create milestones for this transaction' },
        { status: 403 }
      )
    }

    // Get the next order value for this transaction
    const { data: existingMilestones } = await supabase
      .from('tc_milestones')
      .select('order', { count: 'exact' })
      .eq('transaction_id', transaction_id)
      .eq('is_deleted', false)

    const nextOrder = (existingMilestones?.length ?? 0) + 1

    // Create the milestone
    const { data: milestone, error } = await supabase
      .from('tc_milestones')
      .insert({
        transaction_id,
        milestone_name: milestone_name.trim(),
        due_date,
        description: description?.trim() || null,
        status: 'pending',
        created_by: userId,
        order: nextOrder,
        is_deleted: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating milestone:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Milestone created successfully',
        data: milestone,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in milestone creation endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
