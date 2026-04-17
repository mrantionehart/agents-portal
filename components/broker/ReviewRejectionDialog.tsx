'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface ReviewRejectionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string, notes?: string) => Promise<void>
  loading?: boolean
}

const commonReasons = [
  'Documentation missing',
  'Compliance issue',
  'Missing signatures',
  'Title concern',
  'Financing issue',
  'Other',
]

export default function ReviewRejectionDialog({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: ReviewRejectionDialogProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState(false)

  if (!isOpen) return null

  const finalReason = selectedReason === 'Other' ? customReason : selectedReason

  const handleConfirm = async () => {
    if (!finalReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }

    setConfirming(true)
    try {
      await onConfirm(finalReason, notes)
      setSelectedReason('')
      setCustomReason('')
      setNotes('')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Reject Review Request</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={confirming}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason *
            </label>
            <select
              value={selectedReason}
              onChange={(e) => {
                setSelectedReason(e.target.value)
                if (e.target.value !== 'Other') {
                  setCustomReason('')
                }
              }}
              disabled={confirming}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select a reason...</option>
              {commonReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Reason (if Other selected) */}
          {selectedReason === 'Other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Please specify
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                disabled={confirming}
                placeholder="Explain the rejection reason..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
          )}

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={confirming}
              placeholder="Any additional instructions for the agent..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            disabled={confirming || !selectedReason}
          >
            {confirming ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
