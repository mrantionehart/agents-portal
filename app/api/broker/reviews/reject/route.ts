import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * PATCH /api/broker/reviews/reject
 * Broker rejects a review request with reason
 */
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

    if (userRole !== 'broker') {
      return NextResponse.json(
        { success: false, error: 'Only brokers can reject reviews' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { review_id, rejection_reason, notes } = body

    if (!review_id || !rejection_reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: review_id, rejection_reason' },
        { status: 400 }
      )
    }

    // Get the review and verify broker can reject it
    const { data: review, error: fetchError } = await supabase
      .from('broker_reviews')
      .select('*')
      .eq('id', review_id)
      .single()

    if (fetchError || !review) {
      console.error('Review not found:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      )
    }

    // Verify the broker requesting rejection is the one assigned
    if (review.broker_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot reject this review' },
        { status: 403 }
      )
    }

    // Update the review to rejected
    const { data: updatedReview, error: updateError } = await supabase
      .from('broker_reviews')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        rejection_reason,
        notes: notes || review.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', review_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error rejecting review:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 400 }
      )
    }

    // Get transaction details for activity log and notification
    const { data: transaction } = await supabase
      .from('tc_transactions')
      .select('agent_id, title')
      .eq('id', review.transaction_id)
      .single()

    // Send notification to agent with rejection reason
    if (transaction) {
      await supabase.from('tc_notifications').insert({
        recipient_id: transaction.agent_id,
        transaction_id: review.transaction_id,
        notification_type: 'broker_review_rejected',
        message: `Your deal was rejected by your broker. Reason: ${rejection_reason}`,
      })
    }

    // Create activity log entry
    await supabase.from('transaction_activity_log').insert({
      transaction_id: review.transaction_id,
      actor_id: userId,
      action_type: 'broker_review_rejected',
      action_details: {
        stage: review.stage,
        rejection_reason,
        notes: notes || null,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedReview,
    })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/broker/reviews/reject:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
