import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * GET /api/broker/reviews
 * List broker review requests with filters
 * - Brokers see all reviews for their brokerage
 * - Agents see only their own review requests
 */
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

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const stage = url.searchParams.get('stage')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let query = supabase
      .from('broker_reviews')
      .select(`
        id,
        transaction_id,
        broker_id,
        requested_by,
        stage,
        status,
        notes,
        rejection_reason,
        requested_at,
        reviewed_at,
        created_at,
        tc_transactions:transaction_id (
          id,
          title,
          agent_id,
          status as transaction_status,
          expected_close_date
        ),
        auth_broker:broker_id (
          id,
          email
        ),
        auth_requester:requested_by (
          id,
          email
        )
      `, { count: 'exact' })

    // Apply role-based filtering
    if (userRole === 'broker') {
      // Brokers see reviews for their brokerage
      query = query.eq('broker_id', userId)
    } else if (userRole === 'agent') {
      // Agents see only their own reviews
      query = query.eq('requested_by', userId)
    } else {
      return NextResponse.json(
        { success: false, error: 'Unauthorized role' },
        { status: 403 }
      )
    }

    // Apply optional filters
    if (status) {
      query = query.eq('status', status)
    }
    if (stage) {
      query = query.eq('stage', stage)
    }

    // Sort by creation date (newest first) and paginate
    const { data: reviews, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching reviews:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: reviews || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/broker/reviews:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/broker/reviews
 * Create a new broker review request
 */
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

    const body = await req.json()
    const { transaction_id, broker_id, stage = 'pre_milestone', notes } = body

    // Validate required fields
    if (!transaction_id || !broker_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: transaction_id, broker_id' },
        { status: 400 }
      )
    }

    // Validate stage
    const validStages = ['pre_milestone', 'pre_closing', 'compliance_flagged']
    if (!validStages.includes(stage)) {
      return NextResponse.json(
        { success: false, error: 'Invalid stage' },
        { status: 400 }
      )
    }

    // Verify transaction exists and user is the owner/TC
    const { data: transaction, error: txnError } = await supabase
      .from('tc_transactions')
      .select('id, agent_id, tc_id, title')
      .eq('id', transaction_id)
      .single()

    if (txnError || !transaction) {
      console.error('Transaction not found:', txnError)
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Verify broker exists and is valid
    const { data: brokerProfile, error: brokerError } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', broker_id)
      .eq('role', 'broker')
      .single()

    if (brokerError || !brokerProfile) {
      console.error('Broker not found:', brokerError)
      return NextResponse.json(
        { success: false, error: 'Broker not found or invalid' },
        { status: 404 }
      )
    }

    // Create the review request
    const { data: review, error: createError } = await supabase
      .from('broker_reviews')
      .insert({
        transaction_id,
        broker_id,
        requested_by: userId,
        stage,
        notes,
        status: 'pending',
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating review:', createError)
      return NextResponse.json(
        { success: false, error: createError.message },
        { status: 400 }
      )
    }

    // Send notification to broker
    await supabase.from('tc_notifications').insert({
      recipient_id: broker_id,
      transaction_id,
      notification_type: 'broker_review_requested',
      message: `New deal pending review: ${transaction.title || 'Untitled Deal'}`,
    })

    return NextResponse.json({
      success: true,
      data: review,
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/broker/reviews:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
