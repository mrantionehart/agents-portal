// API Route: Task Management - List and Create
// GET: List tasks with filtering and pagination
// POST: Create new task

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication header' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const assigned_to = searchParams.get('assigned_to')
    const due_before = searchParams.get('due_before')
    const due_after = searchParams.get('due_after')
    const sort_by = searchParams.get('sort_by') || 'due_date'
    const sort_order = searchParams.get('sort_order') || 'asc'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    let query = supabase
      .from('tasks')
      .select(
        `
        *,
        assigned_to_profile:assigned_to(id, email, full_name),
        assigned_by_profile:assigned_by(id, email, full_name),
        transaction:transaction_id(id, title, status),
        comment_count:task_comments(count),
        activity_count:task_activity(count)
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null)

    // Filter by status
    if (status) {
      query = query.eq('status', status)
    }

    // Filter by priority
    if (priority) {
      query = query.eq('priority', priority)
    }

    // Filter by assignee
    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to)
    } else if (userRole !== 'broker') {
      // Non-brokers only see their own assigned tasks or tasks they created
      query = query.or(
        `assigned_to.eq.${userId},assigned_by.eq.${userId}`
      )
    }

    // Filter by due date range
    if (due_before) {
      query = query.lte('due_date', due_before)
    }
    if (due_after) {
      query = query.gte('due_date', due_after)
    }

    // Sort and paginate
    const validSortFields = ['due_date', 'created_at', 'priority', 'status']
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'due_date'
    const validSortOrders = ['asc', 'desc']
    const sortDir = validSortOrders.includes(sort_order) ? sort_order : 'asc'

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication header' },
        { status: 401 }
      )
    }

    if (userRole !== 'agent' && userRole !== 'tc' && userRole !== 'broker') {
      return NextResponse.json(
        { error: 'Unauthorized to create tasks' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      transaction_id,
      assigned_to,
      title,
      description,
      priority = 'medium',
      due_date
    } = body

    // Validate required fields
    if (!transaction_id || !assigned_to || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: transaction_id, assigned_to, title' },
        { status: 400 }
      )
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority' },
        { status: 400 }
      )
    }

    // Check transaction access
    const { data: transaction, error: txError } = await supabase
      .from('tc_transactions')
      .select('agent_id')
      .eq('id', transaction_id)
      .single()

    if (txError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Verify user has access to create task for this transaction
    if (userRole === 'agent' && transaction.agent_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to create task for this transaction' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          transaction_id,
          assigned_by: userId,
          assigned_to,
          title,
          description: description || null,
          priority,
          due_date: due_date || null,
          status: 'pending'
        }
      ])
      .select(
        `
        *,
        assigned_to_profile:assigned_to(id, email, full_name),
        assigned_by_profile:assigned_by(id, email, full_name),
        transaction:transaction_id(id, title, status)
      `
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { data },
      { status: 201 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
