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

    // Brokers see their own TCs, Agents see all active TCs
    let query = supabase
      .from('transaction_coordinators')
      .select('*')

    if (userRole === 'broker') {
      // Brokers only see their own TCs
      query = query.eq('broker_id', userId)
    } else if (userRole === 'agent') {
      // Agents see all active TCs available for requesting
      query = query.eq('status', 'active')
    } else {
      return NextResponse.json(
        { success: false, error: 'Only brokers and agents can access coordinators' },
        { status: 403 }
      )
    }

    const { data: tcs, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching coordinators:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: tcs || [],
    })
  } catch (error) {
    console.error('Error in coordinators endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
