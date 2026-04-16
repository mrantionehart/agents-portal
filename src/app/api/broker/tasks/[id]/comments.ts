// API Route: Task Comments - Add and manage comments
// POST: Add comment to task
// GET: List comments for task

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
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

    const body = await request.json()
    const { comment_text } = body

    if (!comment_text || !comment_text.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      )
    }

    // Verify task exists
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .is('deleted_at', null)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Create comment
    const { data, error } = await supabase
      .from('task_comments')
      .insert([
        {
          task_id: taskId,
          user_id: userId,
          comment_text: comment_text.trim()
        }
      ])
      .select(
        `
        *,
        user_profile:user_id(id, email, full_name)
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
