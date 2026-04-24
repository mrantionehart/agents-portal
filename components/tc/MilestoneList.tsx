'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react'

interface Milestone {
  id: string
  milestone_name: string
  description?: string
  status: string
  due_date: string
  completed_date?: string
  order?: number
}

interface MilestoneListProps {
  milestones: Milestone[]
  userId: string
  userRole: string
  transactionId: string
  onMilestoneUpdated?: () => void
  onMilestoneDeleted?: () => void
}

export default function MilestoneList({
  milestones,
  userId,
  userRole,
  transactionId,
  onMilestoneUpdated,
  onMilestoneDeleted,
}: MilestoneListProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/15 text-green-400 border-l-4 border-green-500'
      case 'pending':
        return 'bg-[#0a0a0f] text-white border-l-4 border-gray-400'
      case 'in_progress':
        return 'bg-blue-500/15 text-blue-400 border-l-4 border-blue-500'
      case 'overdue':
        return 'bg-red-500/15 text-red-800 border-l-4 border-red-500'
      default:
        return 'bg-[#0a0a0f] text-white border-l-4 border-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const handleStatusChange = async (milestoneId: string, currentStatus: string) => {
    if (currentStatus === 'completed') {
      return // Already completed
    }

    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending'

    try {
      setUpdatingId(milestoneId)
      setError(null)

      const response = await fetch('/api/broker/tc/milestones/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          milestone_id: milestoneId,
          status: newStatus,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update milestone')
      }

      if (onMilestoneUpdated) {
        onMilestoneUpdated()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update milestone')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (milestoneId: string) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) {
      return
    }

    try {
      setDeletingId(milestoneId)
      setError(null)

      const response = await fetch('/api/broker/tc/milestones/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          milestone_id: milestoneId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete milestone')
      }

      if (onMilestoneDeleted) {
        onMilestoneDeleted()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete milestone')
    } finally {
      setDeletingId(null)
    }
  }

  const sortedMilestones = [...milestones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  if (milestones.length === 0) {
    return (
      <div className="bg-[#0a0a0f] rounded-lg shadow p-6 text-center text-gray-400">
        <p>No milestones created yet. Create one to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {sortedMilestones.map((milestone) => (
          <div
            key={milestone.id}
            className={`rounded-lg shadow p-6 cursor-pointer transition hover:shadow-md shadow-black/20 ${getStatusColor(milestone.status)}`}
            onClick={() => handleStatusChange(milestone.id, milestone.status)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="mt-0.5">{getStatusIcon(milestone.status)}</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">{milestone.milestone_name}</h4>
                  {milestone.description && (
                    <p className="text-sm opacity-75 mt-1">{milestone.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-sm opacity-75">
                    <span>Due: {new Date(milestone.due_date).toLocaleDateString()}</span>
                    {milestone.completed_date && (
                      <span>Completed: {new Date(milestone.completed_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-1 bg-opacity-20 bg-black rounded capitalize">
                  {milestone.status.replace('_', ' ')}
                </span>
                {(userRole === 'agent' || userRole === 'tc') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(milestone.id)
                    }}
                    disabled={deletingId === milestone.id}
                    className="p-2 text-red-600 hover:bg-red-500/15 rounded-lg transition disabled:opacity-50"
                    title="Delete milestone"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {updatingId === milestone.id && (
              <div className="mt-3 text-xs opacity-75">Updating...</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
