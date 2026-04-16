// API Route: Transaction Coordinator Management
// POST: Create TC
// GET: List TCs
// PATCH: Update TC
// DELETE: Deactivate TC

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    if (userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can create TCs' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { agent_id, tc_user_id, commission_split, metadata } = body

    if (!agent_id || !tc_user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: agent_id, tc_user_id' },
        { status: 400 }
      )
    }

    if (commission_split < 0 || commission_split > 100) {
      return NextResponse.json(
        { error: 'Commission split must be between 0 and 100' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_coordinators')
      .insert([
        {
          agent_id,
          tc_user_id,
          status: 'active',
          commission_split,
          metadata: metadata || {},
          hire_date: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data?.[0] }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    if (userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can list TCs' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    let query = supabase.from('tc_coordinators').select('*')

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    if (userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can update TCs' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const tcId = pathArray[pathArray.length - 1]

    if (!tcId || tcId === 'coordinators') {
      return NextResponse.json(
        { error: 'Missing TC ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status, commission_split, metadata } = body

    if (commission_split !== undefined && (commission_split < 0 || commission_split > 100)) {
      return NextResponse.json(
        { error: 'Commission split must be between 0 and 100' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (status) updateData.status = status
    if (commission_split !== undefined) updateData.commission_split = commission_split
    if (metadata) updateData.metadata = metadata
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('tc_coordinators')
      .update(updateData)
      .eq('id', tcId)
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data?.[0] }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    if (userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only brokers can deactivate TCs' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const tcId = pathArray[pathArray.length - 1]

    if (!tcId || tcId === 'coordinators') {
      return NextResponse.json(
        { error: 'Missing TC ID' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_coordinators')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', tcId)
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data?.[0] }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
