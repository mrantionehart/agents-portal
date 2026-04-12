// Activity Feed Component
// Displays recent activities from activity_log in real-time
// Shows who did what, when, with context

'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  FileUp,
  Zap,
  CheckCircle,
  AlertCircle,
  FileText,
  TrendingUp,
  Edit,
} from 'lucide-react'

export interface Activity {
  id: string
  userId: string
  userEmail: string
  userName?: string
  actionType: string
  description: string
  resourceType: string
  resourceId: string
  metadata: Record<string, any>
  createdAt: Date
}

interface ActivityFeedProps {
  activities: Activity[]
  isLoading?: boolean
  isConnected?: boolean
  onActivityClick?: (activity: Activity) => void
}

const getActivityIcon = (actionType: string) => {
  switch (actionType) {
    case 'document_uploaded':
      return <FileUp size={16} className="text-blue-600" />
    case 'deal_created':
      return <Zap size={16} className="text-yellow-600" />
    case 'deal_closed':
      return <CheckCircle size={16} className="text-green-600" />
    case 'document_requested':
      return <FileText size={16} className="text-purple-600" />
    case 'deal_updated':
      return <Edit size={16} className="text-orange-600" />
    case 'notification_sent':
      return <AlertCircle size={16} className="text-red-600" />
    default:
      return <TrendingUp size={16} className="text-gray-600" />
  }
}

const getActivityBadgeColor = (actionType: string) => {
  switch (actionType) {
    case 'document_uploaded':
      return 'bg-blue-50 text-blue-700 border border-blue-200'
    case 'deal_created':
      return 'bg-yellow-50 text-yellow-700 border border-yellow-200'
    case 'deal_closed':
      return 'bg-green-50 text-green-700 border border-green-200'
    case 'document_requested':
      return 'bg-purple-50 text-purple-700 border border-purple-200'
    case 'deal_updated':
      return 'bg-orange-50 text-orange-700 border border-orange-200'
    case 'notification_sent':
      return 'bg-red-50 text-red-700 border border-red-200'
    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200'
  }
}

const formatActionType = (actionType: string) => {
  return actionType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  isLoading = false,
  isConnected = false,
  onActivityClick,
}) => {
  if (isLoading && activities.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <ActivitySkeleton key={i} />
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-3">
          <TrendingUp size={32} className="mx-auto" />
        </div>
        <p className="text-gray-600 font-medium">No activity yet</p>
        <p className="text-sm text-gray-500">
          Activities will appear here when agents create deals or upload documents
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Connection status */}
      {isConnected && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
          <span className="text-sm text-green-700">Live updates enabled</span>
        </div>
      )}

      {/* Activity items */}
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          onClick={() => onActivityClick?.(activity)}
        />
      ))}
    </div>
  )
}

interface ActivityItemProps {
  activity: Activity
  onClick?: () => void
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg p-4 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="mt-1">
          {getActivityIcon(activity.actionType)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Description */}
          <p className="text-sm text-gray-900 font-medium mb-1">
            {activity.description}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-xs px-2 py-1 rounded-full ${getActivityBadgeColor(activity.actionType)}`}>
              {formatActionType(activity.actionType)}
            </span>
            {activity.metadata.dealId && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                Deal: {activity.metadata.dealId?.slice(0, 8)}...
              </span>
            )}
            {activity.metadata.stage && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                Stage: {activity.metadata.stage}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              {activity.userName ? (
                <>
                  <span className="font-medium">{activity.userName}</span> (
                  {activity.userEmail})
                </>
              ) : (
                activity.userEmail
              )}
            </span>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading skeleton for activity item
 */
const ActivitySkeleton: React.FC = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-4 h-4 bg-gray-300 rounded mt-1" />
        <div className="flex-1">
          <div className="h-4 w-2/3 bg-gray-300 rounded mb-2" />
          <div className="flex gap-2 mb-2">
            <div className="h-5 w-24 bg-gray-300 rounded-full" />
            <div className="h-5 w-20 bg-gray-300 rounded-full" />
          </div>
          <div className="h-3 w-1/2 bg-gray-300 rounded" />
        </div>
      </div>
    </div>
  )
}

/**
 * Empty state component
 */
export const ActivityFeedEmpty: React.FC = () => {
  return (
    <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg bg-gray-50">
      <TrendingUp size={32} className="mx-auto text-gray-400 mb-3" />
      <p className="text-gray-600 font-medium">No activities yet</p>
      <p className="text-sm text-gray-500">
        Real-time activity will appear here
      </p>
    </div>
  )
}
