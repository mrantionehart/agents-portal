// Task Dashboard Component
// Main interface for agents and TCs to manage tasks
// Shows task overview, filtering, and quick actions

'use client'

import React, { useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Filter,
  BarChart3,
  Zap,
  Calendar,
  Loader2
} from 'lucide-react'
import TaskList from './TaskList'
import TaskDetailModal from './TaskDetailModal'
import TaskAssignmentDialog from './TaskAssignmentDialog'

export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string
  assigned_to_profile?: {
    email: string
    full_name?: string
  }
  assigned_by: string
  assigned_by_profile?: {
    email: string
    full_name?: string
  }
  transaction_id: string
  transaction?: {
    id: string
    title: string
    status: string
  }
  due_date?: string
  completion_date?: string
  created_at: string
  updated_at: string
}

export interface TaskStats {
  total_tasks: number
  pending_count: number
  in_progress_count: number
  completed_count: number
  blocked_count: number
  overdue_count: number
  due_today_count: number
  completion_rate: number
}

interface TaskDashboardProps {
  userId: string
  userRole: string
  transactionId?: string
}

const TaskDashboard: React.FC<TaskDashboardProps> = ({
  userId,
  userRole,
  transactionId
}) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')

  // Fetch tasks and stats
  useEffect(() => {
    fetchTasks()
    fetchStats()
  }, [statusFilter, priorityFilter])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        limit: '50'
      })

      if (statusFilter) params.append('status', statusFilter)
      if (priorityFilter) params.append('priority', priorityFilter)
      if (transactionId) params.append('transaction_id', transactionId)

      const response = await fetch(`/api/broker/tasks?${params}`, {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (response.ok) {
        const { data } = await response.json()
        setTasks(data)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/broker/tasks/stats', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (response.ok) {
        const { data } = await response.json()
        setStats(data.summary)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'blocked':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-50'
      case 'high':
        return 'text-orange-600 bg-orange-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-green-600 bg-green-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />
      case 'in_progress':
        return <Clock className="w-4 h-4" />
      case 'blocked':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Calendar className="w-4 h-4" />
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (activeFilter === 'due-today') {
      const dueDate = task.due_date ? new Date(task.due_date) : null
      const today = new Date()
      return (
        dueDate &&
        dueDate.toDateString() === today.toDateString() &&
        task.status !== 'completed'
      )
    }
    if (activeFilter === 'overdue') {
      const dueDate = task.due_date ? new Date(task.due_date) : null
      return (
        dueDate &&
        dueDate < new Date() &&
        task.status !== 'completed'
      )
    }
    if (activeFilter === 'high-priority') {
      return ['high', 'urgent'].includes(task.priority)
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Manage your transaction tasks and deadlines</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Task
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_tasks}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{stats.in_progress_count}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Due Today</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.due_today_count}</p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue_count}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />

          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Tasks
          </button>

          <button
            onClick={() => setActiveFilter('due-today')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              activeFilter === 'due-today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Due Today
          </button>

          <button
            onClick={() => setActiveFilter('overdue')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              activeFilter === 'overdue'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Overdue
          </button>

          <button
            onClick={() => setActiveFilter('high-priority')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              activeFilter === 'high-priority'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Zap className="w-3 h-3 inline mr-1" />
            High Priority
          </button>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1 rounded border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1 rounded border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          onTaskClick={(task) => {
            setSelectedTask(task)
            setShowDetailModal(true)
          }}
          onRefresh={fetchTasks}
        />
      )}

      {/* Modals */}
      {showDetailModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          userId={userId}
          userRole={userRole}
          onClose={() => setShowDetailModal(false)}
          onRefresh={fetchTasks}
        />
      )}

      {showCreateDialog && (
        <TaskAssignmentDialog
          userId={userId}
          userRole={userRole}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false)
            fetchTasks()
            fetchStats()
          }}
        />
      )}
    </div>
  )
}

export default TaskDashboard
