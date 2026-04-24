'use client'

import { useEffect, useState } from 'react'

interface MilestoneTrackerProps {
  transactionId: string
  userId: string
  userRole: string
  showDetails?: boolean
}

interface MilestoneStatus {
  total_milestones: number
  completed_milestones: number
  pending_milestones: number
  overdue_milestones: number
  completion_percentage: number
}

export default function MilestoneTracker({
  transactionId,
  userId,
  userRole,
  showDetails = true,
}: MilestoneTrackerProps) {
  const [status, setStatus] = useState<MilestoneStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [transactionId])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/broker/tc/milestones/status?transaction_id=${transactionId}`,
        {
          headers: {
            'X-User-ID': userId,
            'X-User-Role': userRole,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch milestone status')
      }

      const data = await response.json()
      setStatus(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load milestone status')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
        <div className="h-4 bg-[#1a1a2e] rounded animate-pulse"></div>
      </div>
    )
  }

  if (error || !status) {
    return null
  }

  const percentage = status.completion_percentage

  return (
    <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-blue-500">
      <div className="space-y-4">
        {/* Title and Percentage */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Milestone Progress</h3>
          <span className="text-2xl font-bold text-blue-600">{percentage}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#1a1a2e] rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        {/* Details */}
        {showDetails && (
          <div className="grid grid-cols-4 gap-3 pt-2">
            <div className="bg-blue-500/10 rounded p-3 text-center">
              <p className="text-xs text-gray-400 font-medium">Total</p>
              <p className="text-xl font-bold text-blue-600">{status.total_milestones}</p>
            </div>
            <div className="bg-green-500/10 rounded p-3 text-center">
              <p className="text-xs text-gray-400 font-medium">Completed</p>
              <p className="text-xl font-bold text-green-600">{status.completed_milestones}</p>
            </div>
            <div className="bg-yellow-500/10 rounded p-3 text-center">
              <p className="text-xs text-gray-400 font-medium">Pending</p>
              <p className="text-xl font-bold text-yellow-600">{status.pending_milestones}</p>
            </div>
            <div className="bg-red-500/10 rounded p-3 text-center">
              <p className="text-xs text-gray-400 font-medium">Overdue</p>
              <p className="text-xl font-bold text-red-600">{status.overdue_milestones}</p>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className="pt-2">
          {percentage === 100 ? (
            <p className="text-sm text-green-400 font-medium">
              All milestones completed!
            </p>
          ) : status.overdue_milestones > 0 ? (
            <p className="text-sm text-red-400 font-medium">
              {status.overdue_milestones} milestone{status.overdue_milestones > 1 ? 's' : ''} overdue
            </p>
          ) : (
            <p className="text-sm text-gray-200 font-medium">
              {status.pending_milestones} milestone{status.pending_milestones > 1 ? 's' : ''} remaining
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
