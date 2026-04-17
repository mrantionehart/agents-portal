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

    // Only agents can create transactions
    if (userRole !== 'agent') {
      return NextResponse.json(
        { success: false, error: 'Only agents can create transactions' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { title, transactionType, expectedCloseDate, selectedTC } = body

    // Validate required fields
    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'Transaction title is required' },
        { status: 400 }
      )
    }

    if (!transactionType) {
      return NextResponse.json(
        { success: false, error: 'Transaction type is required' },
        { status: 400 }
      )
    }

    if (!expectedCloseDate) {
      return NextResponse.json(
        { success: false, error: 'Expected close date is required' },
        { status: 400 }
      )
    }

    if (!selectedTC) {
      return NextResponse.json(
        { success: false, error: 'Transaction Coordinator is required' },
        { status: 400 }
      )
    }

    // Verify TC exists and is assigned to this agent
    const { data: assignment, error: assignmentError } = await supabase
      .from('tc_assignments')
      .select('tc_id')
      .eq('tc_id', selectedTC)
      .eq('agent_id', userId)
      .eq('status', 'approved')
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { success: false, error: 'Transaction Coordinator is not assigned to you' },
        { status: 404 }
      )
    }

    // Create the transaction
    const { data: transaction, error } = await supabase
      .from('tc_transactions')
      .insert({
        agent_id: userId,
        tc_id: selectedTC,
        title: title.trim(),
        transaction_type: transactionType,
        expected_close_date: expectedCloseDate,
        status: 'active',
        assigned_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating transaction:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Transaction created successfully',
        data: transaction,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in transaction creation endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
