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

    // For Agent viewing their own assignments
    if (userRole === 'agent') {
      const { data: assignments, error } = await supabase
        .from('tc_assignments')
        .select('*')
        .eq('agent_id', userId)
        .order('requested_at', { ascending: false })

      if (error) {
        console.error('Error fetching assignments:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: assignments || [],
      })
    }

    // For TC viewing assignments
    if (userRole === 'tc') {
      const { data: assignments, error } = await supabase
        .from('tc_assignments')
        .select('*')
        .eq('tc_id', userId)
        .order('requested_at', { ascending: false })

      if (error) {
        console.error('Error fetching assignments:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: assignments || [],
      })
    }

    // For Broker viewing all assignments
    if (userRole === 'broker') {
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
          data: [],
        })
      }

      const { data: assignments, error } = await supabase
        .from('tc_assignments')
        .select('*')
        .in('tc_id', tcIds)
        .order('requested_at', { ascending: false })

      if (error) {
        console.error('Error fetching assignments:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: assignments || [],
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized role' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in assignments endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    // Only agents can request TC assignments
    if (userRole !== 'agent') {
      return NextResponse.json(
        { success: false, error: 'Only agents can request TC assignments' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { tc_id, commission_split } = body

    if (!tc_id || commission_split === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tc_id, commission_split' },
        { status: 400 }
      )
    }

    if (commission_split < 0 || commission_split > 100) {
      return NextResponse.json(
        { success: false, error: 'Commission split must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Check if agent already has a pending or approved assignment with this TC
    const { data: existingAssignment, error: checkError } = await supabase
      .from('tc_assignments')
      .select('id, status')
      .eq('agent_id', userId)
      .eq('tc_id', tc_id)
      .single()

    if (!checkError && existingAssignment) {
      return NextResponse.json(
        { success: false, error: 'You already have an assignment with this TC' },
        { status: 400 }
      )
    }

    // Check if TC exists and is active
    const { data: tc, error: tcError } = await supabase
      .from('transaction_coordinators')
      .select('id, status')
      .eq('id', tc_id)
      .single()

    if (tcError || !tc) {
      return NextResponse.json(
        { success: false, error: 'Transaction Coordinator not found' },
        { status: 404 }
      )
    }

    if (tc.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Transaction Coordinator is not active' },
        { status: 400 }
      )
    }

    // Create the assignment request with status 'pending_approval'
    const { data: assignment, error } = await supabase
      .from('tc_assignments')
      .insert({
        tc_id,
        agent_id: userId,
        commission_split,
        status: 'pending_approval',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating assignment:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'TC assignment request submitted successfully',
        data: assignment,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in assignments POST endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Only brokers can approve/deny assignments
    if (userRole !== 'broker') {
      return NextResponse.json(
        { success: false, error: 'Only brokers can approve/deny TC assignments' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { assignment_id, action } = body

    if (!assignment_id || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: assignment_id, action' },
        { status: 400 }
      )
    }

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be either "approve" or "deny"' },
        { status: 400 }
      )
    }

    // Get the assignment and verify broker can modify it
    const { data: assignment, error: fetchError } = await supabase
      .from('tc_assignments')
      .select('tc_id, status')
      .eq('id', assignment_id)
      .single()

    if (fetchError || !assignment) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      )
    }

    // Verify the TC belongs to this broker
    const { data: tc, error: tcError } = await supabase
      .from('transaction_coordinators')
      .select('id')
      .eq('id', assignment.tc_id)
      .eq('broker_id', userId)
      .single()

    if (tcError || !tc) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to modify this assignment' },
        { status: 403 }
      )
    }

    if (assignment.status !== 'pending_approval') {
      return NextResponse.json(
        { success: false, error: 'Assignment is not in pending approval status' },
        { status: 400 }
      )
    }

    // Update assignment status
    const newStatus = action === 'approve' ? 'approved' : 'denied'
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('tc_assignments')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignment_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating assignment:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Assignment ${action}ed successfully`,
      data: updatedAssignment,
    })
  } catch (error) {
    console.error('Error in assignments PATCH endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
