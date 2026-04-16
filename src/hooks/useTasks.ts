// Hook: useTasks
// Manages task fetching, real-time subscriptions, and state management
// Integrates with Supabase for real-time updates

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string
  assigned_by: string
  transaction_id: string
  due_date?: string
  completion_date?: string
  created_at: string
  updated_at: string
}

interface UseTasksOptions {
  userId: string
  userRole: string
  status?: string
  priority?: string
  transactionId?: string
  autoSubscribe?: boolean
}

export function useTasks({
  userId,
  userRole,
  status,
  priority,
  transactionId,
  autoSubscribe = true
}: UseTasksOptions) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: '1',
        limit: '100'
      })

      if (status) params.append('status', status)
      if (priority) params.append('priority', priority)
      if (transactionId) params.append('transaction_id', transactionId)

      const response = await fetch(`/api/broker/tasks?${params}`, {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (!response.ok) throw new Error('Failed to fetch tasks')

      const { data } = await response.json()
      setTasks(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [userId, userRole, status, priority, transactionId])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!autoSubscribe) return

    fetchTasks()

    // Subscribe to task changes
    const subscription = supabase
      .channel('tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as Task, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((t) => (t.id === (payload.new as Task).id ? (payload.new as Task) : t))
            )
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== (payload.old as Task).id))
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [autoSubscribe, fetchTasks, supabase])

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks
  }
}

// Hook: useTaskStats
// Fetches task statistics for dashboard widgets

interface TaskStats {
  total_tasks: number
  pending_count: number
  in_progress_count: number
  completed_count: number
  blocked_count: number
  overdue_count: number
  due_today_count: number
  completion_rate: number
}

export function useTaskStats(userId: string, userRole: string) {
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/broker/tasks/stats', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (!response.ok) throw new Error('Failed to fetch stats')

      const { data } = await response.json()
      setStats(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [userId, userRole])

  useEffect(() => {
    fetchStats()

    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [fetchStats])

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  }
}

// Hook: useTask
// Fetches and manages a single task with comments and activity

export interface TaskDetail extends Task {
  comments?: Array<{
    id: string
    comment_text: string
    user_id: string
    user_profile?: {
      email: string
      full_name?: string
    }
    created_at: string
  }>
  activity?: Array<{
    id: string
    action: string
    user_id: string
    user_profile?: {
      email: string
      full_name?: string
    }
    changes?: Record<string, any>
    created_at: string
  }>
}

export function useTask(taskId: string, userId: string, userRole: string) {
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTask = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/broker/tasks/${taskId}`, {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (!response.ok) throw new Error('Failed to fetch task')

      const { data } = await response.json()
      setTask(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [taskId, userId, userRole])

  useEffect(() => {
    fetchTask()
  }, [fetchTask])

  return {
    task,
    loading,
    error,
    refetch: fetchTask
  }
}
