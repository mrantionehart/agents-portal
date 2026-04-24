'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, XCircle, Clock } from 'lucide-react'
import ReviewRejectionDialog from './ReviewRejectionDialog'

interface ReviewDetailModalProps {
  isOpen: boolean
  review: any
  onClose: () => void
  onApprove: (reviewId: string, notes?: string) => Promise<void>
  onReject: (reviewId: string, reason: string, notes?: string) => Promise<void>
  loading?: boolean
}

export default function ReviewDetailModal({
  isOpen,
  review,
  onClose,
  onApprove,
  onReject,
  loading = false,
}: ReviewDetailModalProps) {
  const [approving, setApproving] = useState(false)
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (review?.notes) {
      setNotes(review.notes)
    }
  }, [review])

  if (!isOpen || !review) return null

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      pre_milestone: 'Pre-Milestone Review',
      pre_closing: 'Pre-Closing Review',
      compliance_flagged: 'Compliance Flag Review',
    }
    return labels[stage] || stage
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/15 text-yellow-400">
            <Clock size={14} />
            Pending
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-500/15 text-green-400">
            <CheckCircle size={14} />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-500/15 text-red-800">
            <XCircle size={14} />
            Rejected
          </span>
        )
      default:
        return <span className="px-3 py-1 text-sm font-medium bg-[#0a0a0f]">{status}</span>
    }
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      await onApprove(review.id, notes)
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async (reason: string, rejectNotes?: string) => {
    await onReject(review.id, reason, rejectNotes)
    setShowRejectionDialog(false)
  }

  const transaction = review.tc_transactions
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
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-[#0a0a0f] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-[#0a0a0f]">
            <div>
              <h2 className="text-2xl font-bold text-white">Review Details</h2>
              <p className="text-sm text-gray-400 mt-1">{getStageLabel(review.stage)}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-400 transition"
              disabled={loading}
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Section */}
            <div className="bg-[#050507] p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Status</p>
                  <p className="mt-2">{getStatusBadge(review.status)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-400">Time Waiting</p>
                  <p className="text-lg font-semibold text-white mt-1">
                    {formatTimeWaiting(timeWaiting)}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Deal Information</h3>
              <div className="space-y-3 bg-[#050507] p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400">Deal Name</p>
                  <p className="font-semibold text-white">{transaction?.title || 'Untitled'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Transaction ID</p>
                  <p className="font-mono text-sm text-white">{review.transaction_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Requested By</p>
                  <p className="font-semibold text-white">{review.auth_requester?.email || 'Unknown'}</p>
                </div>
              </div>
            </div>

            {/* Rejection Reason (if applicable) */}
            {review.status === 'rejected' && review.rejection_reason && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Rejection Reason</h3>
                <p className="text-red-800">{review.rejection_reason}</p>
              </div>
            )}

            {/* Notes Section */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Broker Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={review.status !== 'pending' || loading}
                placeholder="Add any notes about this review..."
                className="w-full px-3 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-transparent disabled:bg-[#0a0a0f]"
                rows={4}
              />
            </div>

            {/* Timeline */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Timeline</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Requested:</span>
                  <span className="text-white">
                    {review.requested_at
                      ? new Date(review.requested_at).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                {review.reviewed_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reviewed:</span>
                    <span className="text-white">
                      {new Date(review.reviewed_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t bg-[#050507]">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-200 border border-[#1a1a2e] rounded-lg hover:bg-[#111] transition disabled:opacity-50"
              disabled={loading || approving}
            >
              Close
            </button>
            {review.status === 'pending' && (
              <>
                <button
                  onClick={() => setShowRejectionDialog(true)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  disabled={loading || approving}
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  disabled={loading || approving}
                >
                  {approving ? 'Approving...' : 'Approve'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Dialog */}
      <ReviewRejectionDialog
        isOpen={showRejectionDialog}
        onClose={() => setShowRejectionDialog(false)}
        onConfirm={handleReject}
        loading={loading}
      />
    </>
  )
}
