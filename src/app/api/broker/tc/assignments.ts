// API Route: TC Assignment Workflow
// POST: Request assignment
// GET: List assignments
// PATCH: Approve/Deny/Update assignment
// DELETE: Deactivate assignment

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

    if (userRole !== 'agent') {
      return NextResponse.json(
        { error: 'Only agents can request assignments' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { agent_id, tc_id, commission_split } = body

    if (!agent_id || !tc_id) {
      return NextResponse.json(
        { error: 'Missing required fields: agent_id, tc_id' },
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
      .from('tc_assignments')
      .insert([
        {
          agent_id,
          tc_id,
          status: 'pending_approval',
          commission_split,
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

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const agent_id = searchParams.get('agent_id')
    const tc_id = searchParams.get('tc_id')

    let query = supabase.from('tc_assignments').select('*')

    if (status) query = query.eq('status', status)
    if (agent_id) query = query.eq('agent_id', agent_id)
    if (tc_id) query = query.eq('tc_id', tc_id)

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
        { error: 'Only brokers can approve/update assignments' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const assignmentId = pathArray[pathArray.length - 1]

    if (!assignmentId || assignmentId === 'assignments') {
      return NextResponse.json(
        { error: 'Missing assignment ID' },
        { status: 400 }
      )
    }

    const action = request.nextUrl.searchParams.get('action')
    const body = await request.json()

    let updateData: any = { updated_at: new Date().toISOString() }

    if (action === 'approve') {
      updateData.status = 'active'
    } else if (action === 'deny') {
      updateData.status = 'inactive'
    } else {
      if (body.commission_split !== undefined) {
        if (body.commission_split < 0 || body.commission_split > 100) {
          return NextResponse.json(
            { error: 'Commission split must be between 0 and 100' },
            { status: 400 }
          )
        }
        updateData.commission_split = body.commission_split
      }
    }

    const { data, error } = await supabase
      .from('tc_assignments')
      .update(updateData)
      .eq('id', assignmentId)
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
        { error: 'Only brokers can deactivate assignments' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const assignmentId = pathArray[pathArray.length - 1]

    if (!assignmentId || assignmentId === 'assignments') {
      return NextResponse.json(
        { error: 'Missing assignment ID' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_assignments')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', assignmentId)
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
