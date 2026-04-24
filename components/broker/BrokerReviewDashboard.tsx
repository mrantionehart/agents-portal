'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, RefreshCw, Clock } from 'lucide-react'
import ReviewDetailModal from './ReviewDetailModal'
import { createClient } from '@supabase/supabase-js'

interface BrokerReviewDashboardProps {
  userId: string
  userRole: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default function BrokerReviewDashboard({
  userId,
  userRole,
}: BrokerReviewDashboardProps) {
  const [reviews, setReviews] = useState<any[]>([])
  const [selectedReview, setSelectedReview] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedStage, setSelectedStage] = useState<string>('all')
  const [stats, setStats] = useState<any>(null)

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    if (userRole !== 'broker') return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('status', 'pending')
      if (selectedStage !== 'all') {
        params.append('stage', selectedStage)
      }

      const response = await fetch(`/api/broker/reviews?${params}`, {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })

      const data = await response.json()
      if (data.success) {
        setReviews(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, userRole, selectedStage])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (userRole !== 'broker') return

    try {
      const response = await fetch('/api/broker/reviews/status', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })

      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [userId, userRole])

  // Initial fetch and subscription
  useEffect(() => {
    fetchReviews()
    fetchStats()

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('broker_reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broker_reviews',
          filter: `broker_id=eq.${userId}`,
        },
        () => {
          // Refetch when changes occur
          fetchReviews()
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, fetchReviews, fetchStats, supabase])

  const handleApprove = async (reviewId: string, notes?: string) => {
    try {
      const response = await fetch('/api/broker/reviews/approve', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({ review_id: reviewId, notes }),
      })

      const data = await response.json()
      if (data.success) {
        setShowDetailModal(false)
        fetchReviews()
        fetchStats()
      } else {
        alert('Error approving review: ' + data.error)
      }
    } catch (error) {
      console.error('Error approving review:', error)
      alert('Error approving review')
    }
  }

  const handleReject = async (reviewId: string, reason: string, notes?: string) => {
    try {
      const response = await fetch('/api/broker/reviews/reject', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          review_id: reviewId,
          rejection_reason: reason,
          notes,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setShowDetailModal(false)
        fetchReviews()
        fetchStats()
      } else {
        alert('Error rejecting review: ' + data.error)
      }
    } catch (error) {
      console.error('Error rejecting review:', error)
      alert('Error rejecting review')
    }
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      pre_milestone: 'Pre-Milestone',
      pre_closing: 'Pre-Closing',
      compliance_flagged: 'Compliance Flag',
    }
    return labels[stage] || stage
  }

  const formatTimeWaiting = (createdAt: string) => {
    const minutes = Math.floor(
      (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60)
    )
    if (minutes < 60) return `${minutes}m`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
    return `${Math.floor(minutes / 1440)}d`
  }

  if (userRole !== 'broker') {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Broker Reviews</h2>
          <p className="text-gray-400 mt-1">Manage incoming review requests for deal progression</p>
        </div>
        <button
          onClick={() => {
            fetchReviews()
            fetchStats()
          }}
          className="p-2 hover:bg-[#111] rounded-lg transition"
          disabled={loading}
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0a0a0f] rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-400">Total Reviews</p>
            <p className="text-3xl font-bold text-white mt-2">{stats.total}</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-400">Pending</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
            {stats.overdue_count > 0 && (
              <p className="text-xs text-red-600 mt-1">{stats.overdue_count} overdue (24h+)</p>
            )}
          </div>
          <div className="bg-[#0a0a0f] rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-400">Approved</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.approved}</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-400">Rejected</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{stats.rejected}</p>
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {['all', 'pre_milestone', 'pre_closing', 'compliance_flagged'].map((stage) => (
          <button
            key={stage}
            onClick={() => setSelectedStage(stage)}
            className={`px-4 py-2 rounded-lg transition ${
              selectedStage === stage
                ? 'bg-blue-600 text-white'
                : 'bg-[#0a0a0f] text-gray-200 hover:bg-[#1a1a2e]'
            }`}
          >
            {stage === 'all' ? 'All Stages' : getStageLabel(stage)}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div className="bg-[#0a0a0f] rounded-lg shadow overflow-hidden">
        {reviews.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-400">No pending reviews</p>
            <p className="text-sm text-gray-400 mt-1">
              {selectedStage === 'all'
                ? 'All review requests have been processed'
                : `No reviews for ${getStageLabel(selectedStage)}`}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {reviews.map((review) => (
              <div
                key={review.id}
                onClick={() => {
                  setSelectedReview(review)
                  setShowDetailModal(true)
                }}
                className="p-4 hover:bg-[#0a0a0f] cursor-pointer transition border-l-4 border-yellow-400"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">
                      {review.tc_transactions?.title || 'Untitled Deal'}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        {getStageLabel(review.stage)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} />
                        {formatTimeWaiting(review.created_at)} waiting
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/15 text-yellow-400">
                      Pending
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ReviewDetailModal
        isOpen={showDetailModal}
        review={selectedReview}
        onClose={() => setShowDetailModal(false)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  )
}
