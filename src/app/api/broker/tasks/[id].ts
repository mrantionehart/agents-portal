// API Route: Task Management - Get, Update, Delete Single Task
// GET: Retrieve task with comments and activity
// PATCH: Update task details or status
// DELETE: Soft delete task

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    const taskId = params.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication header' },
        { status: 401 }
      )
    }

    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(
        `
        *,
        assigned_to_profile:assigned_to(id, email, full_name),
        assigned_by_profile:assigned_by(id, email, full_name),
        transaction:transaction_id(id, title, status)
      `
      )
      .eq('id', taskId)
      .is('deleted_at', null)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Get comments
    const { data: comments, error: commentsError } = await supabase
      .from('task_comments')
      .select(
        `
        *,
        user_profile:user_id(id, email, full_name)
      `
      )
      .eq('task_id', taskId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Get activity log
    const { data: activity, error: activityError } = await supabase
      .from('task_activity')
      .select(
        `
        *,
        user_profile:user_id(id, email, full_name)
      `
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      data: {
        ...task,
        comments: comments || [],
        activity: activity || []
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')
    const taskId = params.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication header' },
        { status: 401 }
      )
    }

    // Get current task
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !currentTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Check permissions
    const canUpdate =
      userId === currentTask.assigned_by ||
      userId === currentTask.assigned_to ||
      userRole === 'broker'

    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Unauthorized to update this task' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, priority, due_date, status } = body

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Only allow certain fields to be updated
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'urgent']
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: 'Invalid priority' },
          { status: 400 }
        )
      }
      updateData.priority = priority
    }
    if (due_date !== undefined) updateData.due_date = due_date
    if (status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'blocked']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        )
      }
      updateData.status = status
      // Auto-set completion date if status is completed
      if (status === 'completed' && !currentTask.completion_date) {
        updateData.completion_date = new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
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

    return NextResponse.json({ data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    const userRole = request.headers.get('X-User-Role')
    const taskId = params.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication header' },
        { status: 401 }
      )
    }

    // Get current task
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !currentTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Check permissions (only creator or broker)
    const canDelete = userId === currentTask.assigned_by || userRole === 'broker'

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this task' },
        { status: 403 }
      )
    }

    // Soft delete
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
