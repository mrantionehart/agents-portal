// API Route: Transaction Management
// POST: Create transaction
// GET: List transactions
// PATCH: Update transaction
// DELETE: Delete transaction

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
        { error: 'Only TCs and brokers can create transactions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { agent_id, tc_id, title, type, expected_close_date, notes } = body

    if (!agent_id || !tc_id || !title || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const validTypes = ['new_deal', 'follow_up', 'closing', 'other']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_transactions')
      .insert([
        {
          agent_id,
          tc_id,
          title,
          type,
          status: 'created',
          expected_close_date,
          notes,
          assigned_by: userId,
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

    let query = supabase.from('tc_transactions').select('*')

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

    if (userRole !== 'tc' && userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Only TCs and brokers can update transactions' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const transactionId = pathArray[pathArray.length - 1]

    if (!transactionId || transactionId === 'transactions') {
      return NextResponse.json(
        { error: 'Missing transaction ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, status, expected_close_date, notes } = body

    const validStatuses = ['created', 'in_progress', 'pending_docs', 'completed', 'stalled']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid transaction status' },
        { status: 400 }
      )
    }

    const updateData: any = { updated_at: new Date().toISOString() }
    if (title) updateData.title = title
    if (status) updateData.status = status
    if (expected_close_date) updateData.expected_close_date = expected_close_date
    if (notes) updateData.notes = notes

    const { data, error } = await supabase
      .from('tc_transactions')
      .update(updateData)
      .eq('id', transactionId)
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
        { error: 'Only TCs and brokers can delete transactions' },
        { status: 403 }
      )
    }

    const pathArray = request.nextUrl.pathname.split('/')
    const transactionId = pathArray[pathArray.length - 1]

    if (!transactionId || transactionId === 'transactions') {
      return NextResponse.json(
        { error: 'Missing transaction ID' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tc_transactions')
      .delete()
      .eq('id', transactionId)
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
