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

    // Only agents and TCs can reorder milestones
    if (!['agent', 'tc'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to reorder milestones' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { transaction_id, milestone_orders } = body

    if (!transaction_id) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(milestone_orders) || milestone_orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Milestone orders array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Verify transaction exists and user has access
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
        { success: false, error: 'Unauthorized to reorder milestones for this transaction' },
        { status: 403 }
      )
    }

    // Update milestone orders in batch
    const updates = milestone_orders.map((item: { id: string; order: number }, index: number) => ({
      id: item.id,
      order: item.order ?? index,
    }))

    // Update all milestones
    const updatePromises = updates.map((update: { id: string; order: number }) =>
      supabase.from('tc_milestones').update({ order: update.order }).eq('id', update.id)
    )

    const results = await Promise.all(updatePromises)

    // Check for errors
    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      console.error('Errors updating milestone order:', errors)
      return NextResponse.json(
        { success: false, error: 'Failed to update some milestones' },
        { status: 400 }
      )
    }

    // Fetch updated milestones
    const { data: updatedMilestones, error: fetchError } = await supabase
      .from('tc_milestones')
      .select('*')
      .eq('transaction_id', transaction_id)
      .eq('is_deleted', false)
      .order('order', { ascending: true })

    if (fetchError) {
      console.error('Error fetching updated milestones:', fetchError)
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Milestones reordered successfully',
      data: updatedMilestones || [],
    })
  } catch (error) {
    console.error('Error in milestone reorder endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
