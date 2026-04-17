'use client'

import { useState } from 'react'
import { Plus, AlertCircle, CheckCircle } from 'lucide-react'

interface MilestoneFormProps {
  transactionId: string
  userId: string
  userRole: string
  onMilestoneCreated?: () => void
}

export default function MilestoneForm({
  transactionId,
  userId,
  userRole,
  onMilestoneCreated,
}: MilestoneFormProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [milestoneName, setMilestoneName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!milestoneName.trim()) {
      setError('Milestone name is required')
      return
    }

    if (!dueDate) {
      setError('Due date is required')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/broker/tc/milestones/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          milestone_name: milestoneName,
          due_date: dueDate,
          description: description || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create milestone')
      }

      const responseData = await response.json()
      setSuccess('Milestone created successfully!')
      setMilestoneName('')
      setDueDate('')
      setDescription('')
      setIsExpanded(false)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 3000)

      // Call callback to refresh parent component
      if (onMilestoneCreated) {
        onMilestoneCreated()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create milestone')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Create Milestone</h3>
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      {isExpanded && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Milestone Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Milestone Name
            </label>
            <input
              type="text"
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
              placeholder="e.g., Inspection Complete, Appraisal Received"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={submitting}
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={submitting}
            />
          </div>

          {/* Description (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any additional details..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              rows={3}
              disabled={submitting}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create Milestone'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false)
                setError(null)
                setSuccess(null)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
