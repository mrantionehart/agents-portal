// Task Assignment Dialog Component
// Create and assign new tasks to team members
// Includes form validation and transaction selection

'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

interface Transaction {
  id: string
  title: string
  status: string
  agent_id: string
}

interface User {
  id: string
  email: string
  full_name?: string
}

interface TaskAssignmentDialogProps {
  userId: string
  userRole: string
  onClose: () => void
  onSuccess: () => void
}

const TaskAssignmentDialog: React.FC<TaskAssignmentDialogProps> = ({
  userId,
  userRole,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    transaction_id: '',
    assigned_to: '',
    title: '',
    description: '',
    priority: 'medium',
    due_date: ''
  })

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch transactions on mount
  useEffect(() => {
    fetchTransactions()
    fetchUsers()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/broker/tc/transactions', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (response.ok) {
        const { data } = await response.json()
        setTransactions(data || [])
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setError('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      // This would typically fetch from your user management API
      // For now, we'll fetch from a profiles endpoint
      const response = await fetch('/api/broker/profiles', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole
        }
      })

      if (response.ok) {
        const { data } = await response.json()
        setUsers(data || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
    if (!formData.transaction_id) {
      setError('Please select a transaction')
      return
    }
    if (!formData.assigned_to) {
      setError('Please select someone to assign this task to')
      return
    }
    if (!formData.title.trim()) {
      setError('Task title is required')
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch('/api/broker/tasks', {
        method: 'POST',
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transaction_id: formData.transaction_id,
          assigned_to: formData.assigned_to,
          title: formData.title,
          description: formData.description || null,
          priority: formData.priority,
          due_date: formData.due_date || null
        })
      })

      if (response.ok) {
        setSuccess(true)
        setFormData({
          transaction_id: '',
          assigned_to: '',
          title: '',
          description: '',
          priority: 'medium',
          due_date: ''
        })

        // Close dialog after brief delay to show success message
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        const { error: errMsg } = await response.json()
        setError(errMsg || 'Failed to create task')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTransaction = transactions.find(t => t.id === formData.transaction_id)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Create Task</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-4" />
              <p className="text-lg font-medium text-gray-900">Task Created Successfully</p>
              <p className="text-sm text-gray-600 mt-2">The task has been assigned and notifications sent</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Transaction Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Transaction <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.transaction_id}
                  onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">Select a transaction...</option>
                  {transactions.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.title} ({tx.status})
                    </option>
                  ))}
                </select>
                {selectedTransaction && (
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedTransaction.title}
                  </p>
                )}
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Assign To <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">Select a team member...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Task Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Prepare closing documents"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add any details or instructions for this task..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['low', 'medium', 'high', 'urgent'].map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority })}
                      className={`px-3 py-2 rounded-lg border-2 transition text-sm font-medium ${
                        formData.priority === priority
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Task'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskAssignmentDialog
