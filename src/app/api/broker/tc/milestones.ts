// API Route: Milestone Management
// POST: Create milestone
// GET: List milestones
// PATCH: Update milestone status
// DELETE: Delete milestone

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

    if (userRole !== 'tc' && userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only TCs and brokers can create milestones' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { transaction_id, milestone_name, due_date } = body

    if (!transaction_id || !milestone_name || !due_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_milestones')
      .insert([
        {
          transaction_id,
          milestone_name,
          due_date,
          status: 'pending',
          created_by: userId,
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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const transaction_id = searchParams.get('transaction_id')

    let query = supabase.from('tc_milestones').select('*')

    if (transaction_id) {
      query = query.eq('transaction_id', transaction_id)
    }

    const { data, error } = await query
      .range(offset, offset + limit - 1)
      .order('due_date', { ascending: true })

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

    if (userRole !== 'tc' && userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only TCs and brokers can update milestones' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const milestoneId = pathArray[pathArray.length - 1]

    if (!milestoneId || milestoneId === 'milestones') {
      return NextResponse.json(
        { error: 'Missing milestone ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status } = body

    const validStatuses = ['pending', 'completed', 'overdue', 'skipped']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid milestone status' },
        { status: 400 }
      )
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'completed') {
      updateData.completed_date = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('tc_milestones')
      .update(updateData)
      .eq('id', milestoneId)
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

    if (userRole !== 'tc' && userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only TCs and brokers can delete milestones' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const milestoneId = pathArray[pathArray.length - 1]

    if (!milestoneId || milestoneId === 'milestones') {
      return NextResponse.json(
        { error: 'Missing milestone ID' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_milestones')
      .delete()
      .eq('id', milestoneId)
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
