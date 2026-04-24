'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface AgentReviewStatusProps {
  transactionId: string
  userId: string
  userRole: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default function AgentReviewStatus({
  transactionId,
  userId,
  userRole,
}: AgentReviewStatusProps) {
  const [review, setReview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showResubmit, setShowResubmit] = useState(false)

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Fetch current review status
  useEffect(() => {
    const fetchReview = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/broker/reviews?transaction_id=${transactionId}`, {
          headers: {
            'X-User-ID': userId,
            'X-User-Role': userRole,
          },
        })

        const data = await response.json()
        if (data.success && data.data && data.data.length > 0) {
          // Get the most recent review
          setReview(data.data[0])
        }
      } catch (error) {
        console.error('Error fetching review status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReview()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`review_${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broker_reviews',
          filter: `transaction_id=eq.${transactionId}`,
        },
        () => {
          fetchReview()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [transactionId, userId, userRole, supabase])

  const handleResubmit = async () => {
    try {
      const response = await fetch('/api/broker/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          broker_id: review.broker_id,
          stage: review.stage,
          notes: 'Resubmitted after addressing feedback',
        }),
      })

      const data = await response.json()
      if (data.success) {
        setReview(data.data)
        setShowResubmit(false)
      } else {
        alert('Error resubmitting review: ' + data.error)
      }
    } catch (error) {
      console.error('Error resubmitting review:', error)
      alert('Error resubmitting review')
    }
  }

  if (!review) return null

  const getStatusIcon = () => {
    switch (review.status) {
      case 'pending':
        return <Clock className="text-yellow-600" size={20} />
      case 'approved':
        return <CheckCircle className="text-green-600" size={20} />
      case 'rejected':
        return <XCircle className="text-red-600" size={20} />
      default:
        return <AlertCircle className="text-gray-400" size={20} />
    }
  }

  const getStatusLabel = () => {
    switch (review.status) {
      case 'pending':
        return 'Pending Broker Review'
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      default:
        return 'Review in Progress'
    }
  }

  const getStatusColor = () => {
    switch (review.status) {
      case 'pending':
        return 'bg-yellow-500/10 border-yellow-500/20'
      case 'approved':
        return 'bg-green-500/10 border-green-500/20'
      case 'rejected':
        return 'bg-red-500/10 border-red-500/20'
      default:
        return 'bg-[#050507] border-[#1a1a2e]'
    }
  }

  const timeWaiting = review.requested_at
    ? Math.floor(
        (new Date().getTime() - new Date(review.requested_at).getTime()) /
          (1000 * 60)
      )
    : 0

  const formatTimeWaiting = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
    return `${Math.floor(minutes / 1440)}d`
  }

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getStatusIcon()}
          <div className="flex-1">
            <h3 className="font-semibold text-white">{getStatusLabel()}</h3>
            <p className="text-sm text-gray-400 mt-1">
              {review.status === 'pending' && `Waiting for ${formatTimeWaiting(timeWaiting)}`}
              {review.status === 'approved' &&
                `Approved on ${new Date(review.reviewed_at).toLocaleDateString()}`}
              {review.status === 'rejected' && 'Please address the feedback and resubmit'}
            </p>

            {review.status === 'rejected' && review.rejection_reason && (
              <div className="mt-3 bg-red-500/15 rounded p-3 text-sm">
                <p className="font-semibold text-red-900 mb-1">Reason:</p>
                <p className="text-red-800">{review.rejection_reason}</p>
              </div>
            )}
          </div>
        </div>

        {review.status === 'rejected' && (
          <div className="ml-4">
            {!showResubmit ? (
              <button
                onClick={() => setShowResubmit(true)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition whitespace-nowrap"
              >
                Resubmit
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleResubmit}
                  className="w-full px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowResubmit(false)}
                  className="w-full px-3 py-1 text-sm bg-[#1a1a2e] text-gray-200 rounded hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
