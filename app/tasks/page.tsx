'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import { authFetch } from '@/lib/supabase'
import {
  CheckSquare,
  Loader2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Tag,
  Filter,
  Circle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface Task {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: string | null
  due_date: string | null
  assigned_to: string | null
  assigned_by_name: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Helpers
// ============================================================================

function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'completed') return false
  return new Date(task.due_date) < new Date()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeDue(dateStr: string | null): string {
  if (!dateStr) return ''
  const now = new Date()
  const due = new Date(dateStr)
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  if (diffDays <= 7) return `${diffDays}d left`
  return formatDate(dateStr)
}

function getPriorityConfig(priority: string) {
  switch (priority) {
    case 'critical':
      return {
        label: 'Critical',
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/30',
        dot: 'bg-red-400',
      }
    case 'high':
      return {
        label: 'High',
        bg: 'bg-orange-500/20',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        dot: 'bg-orange-400',
      }
    case 'medium':
      return {
        label: 'Medium',
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        border: 'border-yellow-500/30',
        dot: 'bg-yellow-400',
      }
    case 'low':
      return {
        label: 'Low',
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        dot: 'bg-blue-400',
      }
    default:
      return {
        label: priority,
        bg: 'bg-gray-500/20',
        text: 'text-gray-400',
        border: 'border-gray-500/30',
        dot: 'bg-gray-400',
      }
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        icon: CheckCircle2,
      }
    case 'in_progress':
      return {
        label: 'In Progress',
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        icon: Clock,
      }
    case 'blocked':
      return {
        label: 'Blocked',
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/30',
        icon: AlertTriangle,
      }
    case 'pending':
    default:
      return {
        label: 'To Do',
        bg: 'bg-gray-500/20',
        text: 'text-gray-400',
        border: 'border-gray-500/30',
        icon: Circle,
      }
  }
}

// ============================================================================
// Component
// ============================================================================

export default function TasksPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  const [tasks, setTasks] = useState<Task[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  // Expanded task (click to see full description)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Toggling status in flight
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Auth redirect
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setDataLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      } else {
        const errData = await res.json().catch(() => ({}))
        setError(errData.error || 'Failed to load tasks')
        setTasks([])
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
      setError('Could not connect to tasks service')
      setTasks([])
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchTasks()
  }, [user, fetchTasks])

  // Toggle task status
  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus as Task['status'] } : t))
    )
    setTogglingIds((prev) => new Set(prev).add(task.id))

    try {
      const res = await authFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        // Revert optimistic update
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
        )
      }
    } catch {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      )
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    }
  }

  // Filter logic
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  // Sort: overdue first, then by due date (soonest first), then by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Completed tasks go to the bottom
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (a.status !== 'completed' && b.status === 'completed') return -1

    // Overdue tasks float to top
    const aOverdue = isOverdue(a) ? 0 : 1
    const bOverdue = isOverdue(b) ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue

    // Then by priority
    const aPri = priorityOrder[a.priority] ?? 4
    const bPri = priorityOrder[b.priority] ?? 4
    if (aPri !== bPri) return aPri - bPri

    // Then by due date (soonest first, null last)
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    if (a.due_date) return -1
    if (b.due_date) return 1

    return 0
  })

  // Counts for filter badges
  const statusCounts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060611] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-[#060611]">
      <SidebarNav onSignOut={signOut} userName={user.email || ''} role={role || ''} />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#C9A84C]/10 rounded-lg">
              <CheckSquare className="w-6 h-6 text-[#C9A84C]" />
            </div>
            <h1 className="text-2xl font-bold text-white">My Tasks</h1>
          </div>
          <p className="text-gray-400 ml-[52px]">
            View your assigned tasks and track progress. Toggle tasks to mark them complete.
          </p>
        </div>

        {/* Filter Row */}
        <div className="mb-6 space-y-4">
          {/* Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-500 mr-1" />
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'To Do' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'completed', label: 'Completed' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === opt.key
                    ? 'bg-[#C9A84C] text-black'
                    : 'bg-[#0a0a1a] text-gray-400 border border-[#1a1a2e] hover:border-[#C9A84C]/30 hover:text-white'
                }`}
              >
                {opt.label} ({statusCounts[opt.key as keyof typeof statusCounts] ?? 0})
              </button>
            ))}
          </div>

          {/* Priority Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 mr-1 uppercase tracking-wider">Priority</span>
            {[
              { key: 'all', label: 'Any' },
              { key: 'critical', label: 'Critical' },
              { key: 'high', label: 'High' },
              { key: 'medium', label: 'Medium' },
              { key: 'low', label: 'Low' },
            ].map((opt) => {
              const pConfig = opt.key !== 'all' ? getPriorityConfig(opt.key) : null
              return (
                <button
                  key={opt.key}
                  onClick={() => setPriorityFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    priorityFilter === opt.key
                      ? 'bg-[#C9A84C] text-black'
                      : pConfig
                      ? `${pConfig.bg} ${pConfig.text} border ${pConfig.border} hover:opacity-80`
                      : 'bg-[#0a0a1a] text-gray-400 border border-[#1a1a2e] hover:border-[#C9A84C]/30 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Task List */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-gray-400 text-lg mb-2">{error}</p>
            <button
              onClick={fetchTasks}
              className="px-4 py-2 bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg text-sm font-medium hover:bg-[#C9A84C]/20 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckSquare className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">
              {statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No tasks match your current filters.'
                : 'No tasks assigned to you yet.'}
            </p>
            {(statusFilter !== 'all' || priorityFilter !== 'all') && (
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setPriorityFilter('all')
                }}
                className="mt-3 text-[#C9A84C] text-sm hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTasks.map((task) => {
              const overdue = isOverdue(task)
              const expanded = expandedId === task.id
              const toggling = togglingIds.has(task.id)
              const priorityCfg = getPriorityConfig(task.priority)
              const statusCfg = getStatusConfig(task.status)
              const StatusIcon = statusCfg.icon

              return (
                <div
                  key={task.id}
                  className={`bg-[#0a0a1a] rounded-xl transition-all duration-200 ${
                    overdue
                      ? 'border-2 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.08)]'
                      : 'border border-[#1a1a2e] hover:border-[#C9A84C]/20'
                  } ${task.status === 'completed' ? 'opacity-60' : ''}`}
                >
                  {/* Main Row */}
                  <div className="flex items-start gap-4 p-5">
                    {/* Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleStatus(task)
                      }}
                      disabled={toggling || task.status === 'blocked'}
                      className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        task.status === 'completed'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : task.status === 'blocked'
                          ? 'border-red-500/40 text-red-400 cursor-not-allowed'
                          : 'border-gray-600 hover:border-[#C9A84C] hover:bg-[#C9A84C]/10 text-transparent hover:text-[#C9A84C]'
                      } ${toggling ? 'animate-pulse' : ''}`}
                      title={
                        task.status === 'completed'
                          ? 'Mark as incomplete'
                          : task.status === 'blocked'
                          ? 'Task is blocked'
                          : 'Mark as complete'
                      }
                    >
                      {toggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A84C]" />
                      ) : task.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : task.status === 'blocked' ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </button>

                    {/* Task Content */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : task.id)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3
                          className={`font-semibold text-sm leading-tight ${
                            task.status === 'completed'
                              ? 'line-through text-gray-500'
                              : 'text-white'
                          }`}
                        >
                          {task.title}
                        </h3>

                        {/* Expand/Collapse indicator */}
                        <div className="flex-shrink-0 mt-0.5">
                          {expanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </div>

                      {/* Badges Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Priority Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${priorityCfg.bg} ${priorityCfg.text} ${priorityCfg.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
                          {priorityCfg.label}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>

                        {/* Category Badge */}
                        {task.category && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded text-[10px] font-medium">
                            <Tag className="w-2.5 h-2.5" />
                            {task.category}
                          </span>
                        )}

                        {/* Overdue Badge */}
                        {overdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-semibold uppercase border border-red-500/30">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>

                      {/* Meta Row */}
                      <div className="flex items-center gap-4 mt-2.5 text-[11px] text-gray-500">
                        {/* Due Date */}
                        {task.due_date && (
                          <span
                            className={`flex items-center gap-1 ${
                              overdue ? 'text-red-400 font-medium' : ''
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {relativeDue(task.due_date)}
                          </span>
                        )}

                        {/* Assigned By */}
                        {task.assigned_by_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            From {task.assigned_by_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Description */}
                  {expanded && (
                    <div className="px-5 pb-5 pt-0 ml-10 border-t border-[#1a1a2e] mt-0">
                      <div className="pt-4">
                        {task.description ? (
                          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {task.description}
                          </p>
                        ) : (
                          <p className="text-gray-600 text-sm italic">No description provided.</p>
                        )}

                        {/* Additional Details */}
                        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Due: {formatDate(task.due_date)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Created: {formatDate(task.created_at)}
                          </span>
                        </div>

                        {/* Toggle Action */}
                        {task.status !== 'blocked' && (
                          <div className="mt-4">
                            <button
                              onClick={() => toggleStatus(task)}
                              disabled={toggling}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                                task.status === 'completed'
                                  ? 'bg-gray-500/10 text-gray-400 border border-gray-600/30 hover:bg-gray-500/20 hover:text-white'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              }`}
                            >
                              {toggling ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : task.status === 'completed' ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              {task.status === 'completed' ? 'Reopen Task' : 'Mark Complete'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary Footer */}
        {!dataLoading && tasks.length > 0 && (
          <div className="mt-8 p-4 bg-[#0a0a1a] border border-[#1a1a2e] rounded-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                Showing {sortedTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {statusCounts.completed} done
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  {tasks.filter((t) => t.status === 'in_progress').length} in progress
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  {statusCounts.pending} to do
                </span>
                {tasks.filter((t) => isOverdue(t)).length > 0 && (
                  <span className="flex items-center gap-1.5 text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    {tasks.filter((t) => isOverdue(t)).length} overdue
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
