// useRealtimeDashboard Hook
// Manages real-time dashboard subscriptions and metrics
// Works with both agents-portal (React) and Ease App (React Native)

import { useEffect, useState, useCallback } from 'react'
import {
  createRealtimeMetricsSubscription,
  fetchInitialActivities,
  enrichActivitiesWithUsers,
  getTransactionMetrics,
  getCommissionMetrics,
  ActivityMetrics,
  ActivityEvent,
} from '@/lib/realtimeMetrics'

export interface DashboardMetrics extends ActivityMetrics {
  transactionMetrics?: {
    draftCount: number
    pendingCount: number
    reviewCount: number
    approvedCount: number
    closedCount: number
    total: number
  }
  commissionMetrics?: {
    pendingCount: number
    approvedCount: number
    paidCount: number
    totalAmount: number
    totalPaidAmount: number
  }
}

interface UseRealtimeDashboardOptions {
  enabled?: boolean
  initialLoadLimit?: number
  enrichWithUsers?: boolean
  includeTransactionMetrics?: boolean
  includeCommissionMetrics?: boolean
}

interface UseRealtimeDashboardReturn {
  // Realtime data
  metrics: DashboardMetrics
  activities: ActivityEvent[]

  // State
  isLoading: boolean
  isConnected: boolean
  error: string | null

  // Functions
  refresh: () => Promise<void>
  clearActivities: () => void
}

/**
 * Custom hook for real-time dashboard integration
 * Usage:
 *
 * export default function Dashboard() {
 *   const { metrics, activities, isConnected, isLoading } = useRealtimeDashboard()
 *
 *   return (
 *     <div>
 *       <MetricsCard value={metrics.dealsCreatedToday} />
 *       <ActivityFeed activities={activities} isConnected={isConnected} />
 *     </div>
 *   )
 * }
 */
export function useRealtimeDashboard(
  options: UseRealtimeDashboardOptions = {}
): UseRealtimeDashboardReturn {
  const {
    enabled = true,
    initialLoadLimit = 50,
    enrichWithUsers = true,
    includeTransactionMetrics = false,
    includeCommissionMetrics = false,
  } = options

  // State
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    dealsCreatedToday: 0,
    documentsUploadedToday: 0,
    commissionsPendingApproval: 0,
    dealsClosedToday: 0,
    activeAgents: new Set(),
    lastUpdated: new Date(),
  })
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize subscriptions and data
  useEffect(() => {
    if (!enabled) return

    const initialize = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch initial activities
        const initialActivities = await fetchInitialActivities(
          'current-user', // Note: in real use, pass actual user ID
          initialLoadLimit
        )

        // Enrich with user info if requested
        let enrichedActivities = initialActivities
        if (enrichWithUsers) {
          enrichedActivities = await enrichActivitiesWithUsers(initialActivities)
        }

        setActivities(enrichedActivities)

        // Fetch optional metrics
        let transactionMetrics, commissionMetrics

        if (includeTransactionMetrics) {
          transactionMetrics = await getTransactionMetrics()
        }

        if (includeCommissionMetrics) {
          commissionMetrics = await getCommissionMetrics()
        }

        // Create realtime subscription
        const subscription = createRealtimeMetricsSubscription()

        // Subscribe to updates
        subscription.subscribe(({ metrics: newMetrics, activities: newActivities }) => {
          setMetrics(prev => ({
            ...newMetrics,
            transactionMetrics: prev.transactionMetrics,
            commissionMetrics: prev.commissionMetrics,
          }))

          // Enrich if needed
          if (enrichWithUsers) {
            enrichActivitiesWithUsers(newActivities).then(enriched => {
              setActivities(enriched)
            })
          } else {
            setActivities(newActivities)
          }
        })

        // Monitor connection status
        const connectionCheck = setInterval(() => {
          setIsConnected(subscription.isConnected)
        }, 1000)

        // Cleanup
        return () => {
          subscription.unsubscribe()
          clearInterval(connectionCheck)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data'
        setError(errorMessage)
        console.error('[useRealtimeDashboard]', err)
      } finally {
        setIsLoading(false)
      }
    }

    const cleanup = initialize().then(() => {
      // Setup complete
    })

    return () => {
      if (cleanup instanceof Promise) {
        cleanup.catch(err => console.warn('[useRealtimeDashboard] Cleanup error:', err))
      }
    }
  }, [enabled, initialLoadLimit, enrichWithUsers, includeTransactionMetrics, includeCommissionMetrics])

  // Manual refresh function
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const newActivities = await fetchInitialActivities('current-user', initialLoadLimit)

      let enrichedActivities = newActivities
      if (enrichWithUsers) {
        enrichedActivities = await enrichActivitiesWithUsers(newActivities)
      }

      setActivities(enrichedActivities)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh'
      setError(errorMessage)
      console.error('[useRealtimeDashboard] Refresh error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [initialLoadLimit, enrichWithUsers])

  // Clear activities function
  const clearActivities = useCallback(() => {
    setActivities([])
  }, [])

  return {
    metrics,
    activities,
    isLoading,
    isConnected,
    error,
    refresh,
    clearActivities,
  }
}

/**
 * Simpler version for Ease App mobile
 * Returns just the metrics without the full activity feed
 */
export function useRealtimeMetrics(
  options: Omit<UseRealtimeDashboardOptions, 'initialLoadLimit' | 'enrichWithUsers'> = {}
) {
  const {
    enabled = true,
    includeTransactionMetrics = true,
    includeCommissionMetrics = true,
  } = options

  const { metrics, isLoading, isConnected, error } = useRealtimeDashboard({
    enabled,
    initialLoadLimit: 10,
    enrichWithUsers: false,
    includeTransactionMetrics,
    includeCommissionMetrics,
  })

  return {
    metrics,
    isLoading,
    isConnected,
    error,
  }
}
