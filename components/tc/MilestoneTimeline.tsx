'use client'

import { CheckCircle, AlertCircle, Clock } from 'lucide-react'

interface Milestone {
  id: string
  milestone_name: string
  due_date: string
  status: string
  completed_date?: string
  order?: number
}

interface MilestoneTimelineProps {
  milestones: Milestone[]
}

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  const sortedMilestones = [...milestones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  if (milestones.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        <p>No milestones to display</p>
      </div>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />
      case 'overdue':
        return <AlertCircle className="w-6 h-6 text-red-600" />
      default:
        return <Clock className="w-6 h-6 text-gray-400" />
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'overdue':
        return 'bg-red-500'
      case 'pending':
        return 'bg-gray-300'
      case 'in_progress':
        return 'bg-blue-500'
      default:
        return 'bg-gray-300'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Milestone Timeline</h3>

      <div className="space-y-6">
        {sortedMilestones.map((milestone, index) => (
          <div key={milestone.id} className="flex gap-4 pb-6 relative">
            {/* Timeline line */}
            {index < sortedMilestones.length - 1 && (
              <div className="absolute left-3 top-10 w-0.5 h-16 bg-gray-200"></div>
            )}

            {/* Timeline dot */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-4 border-white ${getStatusDot(milestone.status)}`}>
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-gray-900">{milestone.milestone_name}</h4>
                <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded capitalize">
                  {milestone.status.replace('_', ' ')}
                </span>
              </div>

              <p className="text-sm text-gray-600">
                Due: {new Date(milestone.due_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>

              {milestone.completed_date && milestone.status === 'completed' && (
                <p className="text-sm text-green-600 mt-1">
                  Completed: {new Date(milestone.completed_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
