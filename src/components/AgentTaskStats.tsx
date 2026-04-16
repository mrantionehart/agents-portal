// Agent Task Stats Widget
// Compact widget showing task summary for dashboard
// Shows total, due today, overdue with status breakdown

'use client'

import React, { useState, useEffect } from 'react'
import { AlertCircle, Calendar, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'

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

interface AgentTaskStatsProps {
  userId: string
  userRole: string
  transactionId?: string
  onTasksClick?: () => void
}

const AgentTaskStats: React.FC<AgentTaskStatsProps> = ({
  userId,
  userRole,
  transactionId,
  onTasksClick
}) => {
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
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
      console.error('Error fetching task stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-center h-40">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const completionPercentage = stats.total_tasks > 0
    ? Math.round((stats.completed_count / stats.total_tasks) * 100)
    : 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Task Summary</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.total_tasks}</p>
            <p className="text-xs text-blue-600 mt-1">Total Tasks</p>
          </div>

          <div className={`rounded-lg p-3 text-center ${
            stats.due_today_count > 0 ? 'bg-yellow-50' : 'bg-gray-50'
          }`}>
            <p className={`text-2xl font-bold ${
              stats.due_today_count > 0 ? 'text-yellow-700' : 'text-gray-700'
            }`}>
              {stats.due_today_count}
            </p>
            <p className={`text-xs mt-1 ${
              stats.due_today_count > 0 ? 'text-yellow-600' : 'text-gray-600'
            }`}>
              Due Today
            </p>
          </div>

          <div className={`rounded-lg p-3 text-center ${
            stats.overdue_count > 0 ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <p className={`text-2xl font-bold ${
              stats.overdue_count > 0 ? 'text-red-700' : 'text-gray-700'
            }`}>
              {stats.overdue_count}
            </p>
            <p className={`text-xs mt-1 ${
              stats.overdue_count > 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              Overdue
            </p>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-900 uppercase">Status</h4>

          <div className="space-y-2">
            {/* Pending */}
            {stats.pending_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Pending</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded h-2" style={{ minWidth: '60px' }}>
                    <div
                      className="bg-gray-400 h-2 rounded"
                      style={{
                        width: `${(stats.pending_count / stats.total_tasks) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-8">{stats.pending_count}</span>
                </div>
              </div>
            )}

            {/* In Progress */}
            {stats.in_progress_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">In Progress</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-blue-100 rounded h-2" style={{ minWidth: '60px' }}>
                    <div
                      className="bg-blue-400 h-2 rounded"
                      style={{
                        width: `${(stats.in_progress_count / stats.total_tasks) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-blue-600 w-8">{stats.in_progress_count}</span>
                </div>
              </div>
            )}

            {/* Blocked */}
            {stats.blocked_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Blocked</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-red-100 rounded h-2" style={{ minWidth: '60px' }}>
                    <div
                      className="bg-red-400 h-2 rounded"
                      style={{
                        width: `${(stats.blocked_count / stats.total_tasks) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-red-600 w-8">{stats.blocked_count}</span>
                </div>
              </div>
            )}

            {/* Completed */}
            {stats.completed_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Completed</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-green-100 rounded h-2" style={{ minWidth: '60px' }}>
                    <div
                      className="bg-green-400 h-2 rounded"
                      style={{
                        width: `${(stats.completed_count / stats.total_tasks) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-green-600 w-8">{stats.completed_count}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">Completion Rate</span>
            <span className="text-lg font-bold text-gray-900">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* View All Tasks Button */}
        <button
          onClick={onTasksClick}
          className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium text-sm"
        >
          View All Tasks
        </button>

        {/* Alerts */}
        {stats.overdue_count > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-800">
              You have <strong>{stats.overdue_count}</strong> overdue task{stats.overdue_count !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {stats.due_today_count > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <Calendar className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">
              <strong>{stats.due_today_count}</strong> task{stats.due_today_count !== 1 ? 's' : ''} due today
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentTaskStats
