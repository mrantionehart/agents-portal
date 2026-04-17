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

    // Only brokers can view coordinators
    if (userRole !== 'broker') {
      return NextResponse.json(
        { success: false, error: 'Only brokers can access coordinators' },
        { status: 403 }
      )
    }

    // Get all TCs for this broker
    const { data: tcs, error } = await supabase
      .from('transaction_coordinators')
      .select('*')
      .eq('broker_id', userId)
      .order('created_at', { ascending: false })

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
