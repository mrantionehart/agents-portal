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

    // For TC viewing their documents
    if (userRole === 'tc') {
      const { data: documents, error } = await supabase
        .from('tc_documents')
        .select('*')
        .eq('tc_id', userId)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: documents || [],
      })
    }

    // For Agent viewing TC's documents
    if (userRole === 'agent') {
      const { data: documents, error } = await supabase
        .from('tc_documents')
        .select('*')
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: documents || [],
      })
    }

    // For Broker viewing all TC documents
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

      const { data: documents, error } = await supabase
        .from('tc_documents')
        .select('*')
        .in('tc_id', tcIds)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: documents || [],
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized role' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in documents endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
