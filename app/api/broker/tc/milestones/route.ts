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

    // Get query parameter for transaction_id (optional filter)
    const { searchParams } = new URL(req.url)
    const transactionId = searchParams.get('transaction_id')

    // For TC viewing their milestones
    if (userRole === 'tc') {
      let query = supabase
        .from('tc_milestones')
        .select('*')
        .eq('is_deleted', false)

      // If transaction_id is provided, filter by it
      if (transactionId) {
        query = query.eq('transaction_id', transactionId)
      } else {
        // Otherwise get milestones for all transactions of this TC
        const { data: tcTransactions } = await supabase
          .from('tc_transactions')
          .select('id')
          .eq('tc_id', userId)

        const txnIds = tcTransactions?.map((t) => t.id) || []
        if (txnIds.length > 0) {
          query = query.in('transaction_id', txnIds)
        } else {
          return NextResponse.json({
            success: true,
            data: [],
          })
        }
      }

      const { data: milestones, error } = await query.order('order', { ascending: true }).order('due_date', { ascending: true })

      if (error) {
        console.error('Error fetching milestones:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: milestones || [],
      })
    }

    // For Agent viewing TC's milestones
    if (userRole === 'agent') {
      let query = supabase
        .from('tc_milestones')
        .select('*')
        .eq('is_deleted', false)

      // If transaction_id is provided, filter by it
      if (transactionId) {
        query = query.eq('transaction_id', transactionId)
      } else {
        // Otherwise get milestones for all agent transactions
        const { data: agentTransactions } = await supabase
          .from('tc_transactions')
          .select('id')
          .eq('agent_id', userId)

        const txnIds = agentTransactions?.map((t) => t.id) || []
        if (txnIds.length > 0) {
          query = query.in('transaction_id', txnIds)
        } else {
          return NextResponse.json({
            success: true,
            data: [],
          })
        }
      }

      const { data: milestones, error } = await query.order('order', { ascending: true }).order('due_date', { ascending: true })

      if (error) {
        console.error('Error fetching milestones:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: milestones || [],
      })
    }

    // For Broker viewing all TC milestones
    if (userRole === 'broker') {
      const { data: tcs, error: tcsError } = await supabase
        .from('transaction_coordinators')
        .select('id, tc_user_id')
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

      let query = supabase
        .from('tc_milestones')
        .select('*')
        .in('transaction_id',
          (await supabase
            .from('tc_transactions')
            .select('id')
            .in('tc_id', tcIds)).data?.map((t) => t.id) || []
        )
        .eq('is_deleted', false)

      if (transactionId) {
        query = query.eq('transaction_id', transactionId)
      }

      const { data: milestones, error } = await query.order('order', { ascending: true }).order('due_date', { ascending: true })

      if (error) {
        console.error('Error fetching milestones:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: milestones || [],
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized role' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in milestones endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
