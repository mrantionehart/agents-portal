import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * GET /api/broker/reviews/status
 * Statistics endpoint for broker dashboard
 * Returns aggregated data about reviews
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

    if (userRole !== 'broker') {
      return NextResponse.json(
        { success: false, error: 'Only brokers can view review statistics' },
        { status: 403 }
      )
    }

    // Get all reviews for this broker
    const { data: allReviews, error: allError } = await supabase
      .from('broker_reviews')
      .select('id, status, stage, created_at, reviewed_at')
      .eq('broker_id', userId)

    if (allError) {
      console.error('Error fetching reviews:', allError)
      return NextResponse.json(
        { success: false, error: allError.message },
        { status: 400 }
      )
    }

    if (!allReviews || allReviews.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          by_stage: {
            pre_milestone: 0,
            pre_closing: 0,
            compliance_flagged: 0,
          },
          avg_review_time_hours: 0,
          overdue_count: 0,
        },
      })
    }

    // Calculate statistics
    const total = allReviews.length
    const pending = allReviews.filter((r) => r.status === 'pending').length
    const approved = allReviews.filter((r) => r.status === 'approved').length
    const rejected = allReviews.filter((r) => r.status === 'rejected').length

    // By stage
    const pre_milestone = allReviews.filter((r) => r.stage === 'pre_milestone').length
    const pre_closing = allReviews.filter((r) => r.stage === 'pre_closing').length
    const compliance_flagged = allReviews.filter((r) => r.stage === 'compliance_flagged').length

    // Average review time (for completed reviews)
    const completedReviews = allReviews.filter(
      (r) => r.reviewed_at && (r.status === 'approved' || r.status === 'rejected')
    )
    let avgReviewTimeHours = 0
    if (completedReviews.length > 0) {
      const totalHours = completedReviews.reduce((sum, r) => {
        const createdDate = new Date(r.created_at).getTime()
        const reviewedDate = new Date(r.reviewed_at!).getTime()
        const hours = (reviewedDate - createdDate) / (1000 * 60 * 60)
        return sum + hours
      }, 0)
      avgReviewTimeHours = Math.round((totalHours / completedReviews.length) * 10) / 10
    }

    // Overdue reviews (pending for more than 24 hours)
    const now = new Date().getTime()
    const overdue = allReviews.filter((r) => {
      if (r.status !== 'pending') return false
      const createdDate = new Date(r.created_at).getTime()
      const hoursOld = (now - createdDate) / (1000 * 60 * 60)
      return hoursOld > 24
    }).length

    return NextResponse.json({
      success: true,
      stats: {
        total,
        pending,
        approved,
        rejected,
        by_stage: {
          pre_milestone,
          pre_closing,
          compliance_flagged,
        },
        avg_review_time_hours: avgReviewTimeHours,
        overdue_count: overdue,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/broker/reviews/status:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
