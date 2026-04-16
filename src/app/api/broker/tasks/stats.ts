// API Route: Task Statistics
// GET: Dashboard statistics for tasks

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

    // Call the get_task_stats function
    const { data: stats, error: statsError } = await supabase
      .rpc('get_task_stats', {
        p_user_id: userId,
        p_role: userRole
      })

    if (statsError) {
      return NextResponse.json(
        { error: statsError.message },
        { status: 400 }
      )
    }

    // Get overdue tasks
    const { data: overdueTasks, error: overdueError } = await supabase
      .rpc('get_overdue_tasks', {
        p_user_id: userId
      })

    if (overdueError) {
      return NextResponse.json(
        { error: overdueError.message },
        { status: 400 }
      )
    }

    // Get tasks due today
    const today = new Date().toISOString().split('T')[0]
    const { data: dueTodayTasks, error: dueTodayError } = await supabase
      .from('tasks')
      .select('id, title, priority, assigned_to')
      .is('deleted_at', null)
      .neq('status', 'completed')
      .gte('due_date', `${today}T00:00:00`)
      .lt('due_date', `${today}T23:59:59`)

    if (dueTodayError) {
      return NextResponse.json(
        { error: dueTodayError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: {
        summary: stats?.[0] || {
          total_tasks: 0,
          pending_count: 0,
          in_progress_count: 0,
          completed_count: 0,
          blocked_count: 0,
          overdue_count: 0,
          due_today_count: 0,
          high_priority_count: 0,
          urgent_count: 0,
          completion_rate: 0,
          avg_completion_days: 0
        },
        overdue_tasks: overdueTasks || [],
        due_today_tasks: dueTodayTasks || [],
        status_breakdown: {
          pending: stats?.[0]?.pending_count || 0,
          in_progress: stats?.[0]?.in_progress_count || 0,
          completed: stats?.[0]?.completed_count || 0,
          blocked: stats?.[0]?.blocked_count || 0
        },
        priority_breakdown: {
          low: 0,
          medium: 0,
          high: stats?.[0]?.high_priority_count || 0,
          urgent: stats?.[0]?.urgent_count || 0
        }
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
