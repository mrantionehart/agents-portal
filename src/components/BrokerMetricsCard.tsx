// Broker Metrics Card Component
// Displays individual metrics with icons and values
// Shows real-time updates when data changes

'use client'

import React from 'react'
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  bgColor?: 'blue' | 'green' | 'orange' | 'red' | 'purple'
  isLoading?: boolean
  onClick?: () => void
}

export const BrokerMetricsCard: React.FC<MetricCardProps> = ({
  title,
  value,
  description,
  icon,
  trend = 'neutral',
  trendValue,
  bgColor = 'blue',
  isLoading = false,
  onClick,
}) => {
  const bgColorMap = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
    purple: 'bg-purple-50 border-purple-200',
  }

  const iconColorMap = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
  }

  const trendColorMap = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  }

  return (
    <div
      onClick={onClick}
      className={`${bgColorMap[bgColor]} border rounded-lg p-6 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-lg' : ''
      } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className={`${iconColorMap[bgColor]} p-3 bg-white rounded-lg`}>{icon}</div>
        {trend !== 'neutral' && trendValue && (
          <div className={`flex items-center gap-1 ${trendColorMap[trend]}`}>
            {trend === 'up' ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )}
            <span className="text-sm font-semibold">{trendValue}</span>
          </div>
        )}
      </div>

      {/* Title and Value */}
      <h3 className="text-gray-600 text-sm font-medium mb-2">{title}</h3>
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-3xl font-bold text-gray-900">
          {isLoading ? '...' : value}
        </p>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-600">{description}</p>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          Updating...
        </div>
      )}
    </div>
  )
}

/**
 * Card specifically for pending approvals
 */
export const PendingApprovalsCard: React.FC<{
  count: number
  isLoading?: boolean
  onClick?: () => void
}> = ({ count, isLoading, onClick }) => {
  return (
    <BrokerMetricsCard
      title="Pending Approvals"
      value={count}
      description="Deals awaiting review"
      icon={<AlertCircle size={20} />}
      bgColor="orange"
      isLoading={isLoading}
      onClick={onClick}
    />
  )
}

/**
 * Card for active agents
 */
export const ActiveAgentsCard: React.FC<{
  count: number
  isLoading?: boolean
  onClick?: () => void
}> = ({ count, isLoading, onClick }) => {
  return (
    <BrokerMetricsCard
      title="Active Agents (6h)"
      value={count}
      description="Agents with recent activity"
      icon={<TrendingUp size={20} />}
      bgColor="green"
      isLoading={isLoading}
      onClick={onClick}
    />
  )
}

/**
 * Simple loading skeleton
 */
export const MetricsCardSkeleton: React.FC = () => {
  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 animate-pulse">
      <div className="h-10 w-10 bg-gray-300 rounded-lg mb-4"></div>
      <div className="h-4 w-24 bg-gray-300 rounded mb-3"></div>
      <div className="h-8 w-16 bg-gray-400 rounded mb-2"></div>
      <div className="h-3 w-32 bg-gray-300 rounded"></div>
    </div>
  )
}
