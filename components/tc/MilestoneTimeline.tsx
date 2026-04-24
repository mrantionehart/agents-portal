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
      <div className="bg-[#0a0a0f] rounded-lg shadow p-6 text-center text-gray-400">
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
        return 'bg-green-500/100'
      case 'overdue':
        return 'bg-red-500/100'
      case 'pending':
        return 'bg-[#1a1a2e]'
      case 'in_progress':
        return 'bg-blue-500/100'
      default:
        return 'bg-[#1a1a2e]'
    }
  }

  return (
    <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-white mb-6">Milestone Timeline</h3>

      <div className="space-y-6">
        {sortedMilestones.map((milestone, index) => (
          <div key={milestone.id} className="flex gap-4 pb-6 relative">
            {/* Timeline line */}
            {index < sortedMilestones.length - 1 && (
              <div className="absolute left-3 top-10 w-0.5 h-16 bg-[#1a1a2e]"></div>
            )}

            {/* Timeline dot */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-4 border-white ${getStatusDot(milestone.status)}`}>
              <div className="w-2 h-2 bg-[#0a0a0f] rounded-full"></div>
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-white">{milestone.milestone_name}</h4>
                <span className="text-xs font-medium px-2 py-1 bg-[#0a0a0f] text-gray-200 rounded capitalize">
                  {milestone.status.replace('_', ' ')}
                </span>
              </div>

              <p className="text-sm text-gray-400">
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
