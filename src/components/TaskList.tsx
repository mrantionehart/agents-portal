// Task List Component
// Displays tasks in a filterable table with inline actions
// Supports real-time updates via Supabase subscriptions

'use client'

import React, { useState, useEffect } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ChevronRight,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { Task } from './TaskDashboard'

interface TaskListProps {
  tasks: Task[]
  onTaskClick?: (task: Task) => void
  onRefresh?: () => void
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onTaskClick,
  onRefresh
}) => {
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created_at'>('due_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <Calendar className="w-3 h-3" /> },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Clock className="w-3 h-3" /> },
      completed: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle2 className="w-3 h-3" /> },
      blocked: { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertCircle className="w-3 h-3" /> }
    }

    const config = statusConfig[status] || statusConfig.pending
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        {status.replace('_', ' ')}
      </span>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { bg: string; text: string }> = {
      low: { bg: 'bg-green-50', text: 'text-green-700' },
      medium: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
      high: { bg: 'bg-orange-50', text: 'text-orange-700' },
      urgent: { bg: 'bg-red-50', text: 'text-red-700' }
    }

    const config = priorityConfig[priority] || priorityConfig.medium
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    )
  }

  const isOverdue = (dueDate: string | undefined, status: string) => {
    if (!dueDate || status === 'completed') return false
    return new Date(dueDate) < new Date()
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    let aVal: any = a[sortBy]
    let bVal: any = b[sortBy]

    if (sortBy === 'priority') {
      const priorityMap = { low: 0, medium: 1, high: 2, urgent: 3 }
      aVal = priorityMap[a.priority as keyof typeof priorityMap] || 0
      bVal = priorityMap[b.priority as keyof typeof priorityMap] || 0
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Table Header with Sort Controls */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Tasks</h3>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 text-xs rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="due_date">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="created_at">Sort by Created</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1 hover:bg-gray-200 rounded transition"
            title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 hover:bg-gray-200 rounded transition"
              title="Refresh tasks"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        {sortedTasks.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No tasks found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Title</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Assignee</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Due Date</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedTasks.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onTaskClick?.(task)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                        {task.transaction && (
                          <p className="text-xs text-gray-500 mt-1">{task.transaction.title}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">
                      {task.assigned_to_profile?.full_name || task.assigned_to_profile?.email || 'Unknown'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(task.status)}
                  </td>
                  <td className="px-6 py-4">
                    {getPriorityBadge(task.priority)}
                  </td>
                  <td className="px-6 py-4">
                    {task.due_date ? (
                      <div className="flex items-center gap-2">
                        <Calendar className={`w-3 h-3 ${
                          isOverdue(task.due_date, task.status) ? 'text-red-500' : 'text-gray-400'
                        }`} />
                        <span className={`text-sm ${
                          isOverdue(task.due_date, task.status) ? 'text-red-600 font-medium' : 'text-gray-700'
                        }`}>
                          {format(new Date(task.due_date), 'MMM dd')}
                        </span>
                        {isOverdue(task.due_date, task.status) && (
                          <span className="text-xs text-red-600 font-medium">
                            {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No due date</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onTaskClick?.(task)
                      }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with count */}
      {sortedTasks.length > 0 && (
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-xs text-gray-600">
          Showing {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default TaskList
