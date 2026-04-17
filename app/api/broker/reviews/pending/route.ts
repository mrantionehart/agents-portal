import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * GET /api/broker/reviews/pending
 * Quick endpoint for broker dashboard
 * Returns count and list of pending reviews only
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
        { success: false, error: 'Only brokers can view pending reviews' },
        { status: 403 }
      )
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10')

    // Get pending reviews for this broker
    const { data: reviews, error, count } = await supabase
      .from('broker_reviews')
      .select(`
        id,
        transaction_id,
        stage,
        requested_at,
        tc_transactions:transaction_id (
          title,
          agent_id
        )
      `, { count: 'exact' })
      .eq('broker_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error fetching pending reviews:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      count: count || 0,
      data: reviews || [],
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/broker/reviews/pending:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
