'use client'

import { useEffect, useState } from 'react'
import { Send, AlertCircle } from 'lucide-react'

interface ApprovedTC {
  tc_id: string
  tc_email?: string
  commission_split: number
}

interface FormData {
  title: string
  transactionType: string
  expectedCloseDate: string
  selectedTC: string
}

export default function CreateTransactionForm({ userId, userRole }: { userId: string; userRole: string }) {
  const [approvedTCs, setApprovedTCs] = useState<ApprovedTC[]>([])
  const [formData, setFormData] = useState<FormData>({
    title: '',
    transactionType: 'sale',
    expectedCloseDate: '',
    selectedTC: '',
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchApprovedTCs()
  }, [userId])

  const fetchApprovedTCs = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/broker/tc/assignments', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })

      if (response.ok) {
        const data = await response.json()
        const approved = (data.data || []).filter((a: any) => a.status === 'approved')
        setApprovedTCs(approved)

        // Auto-select first approved TC if available
        if (approved.length > 0 && !formData.selectedTC) {
          setFormData((prev) => ({
            ...prev,
            selectedTC: approved[0].tc_id,
          }))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approved TCs')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      setError('Transaction title is required')
      return
    }

    if (!formData.selectedTC) {
      setError('Please select a Transaction Coordinator')
      return
    }

    if (!formData.expectedCloseDate) {
      setError('Expected close date is required')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/broker/tc/transactions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          title: formData.title,
          transactionType: formData.transactionType,
          expectedCloseDate: formData.expectedCloseDate,
          selectedTC: formData.selectedTC,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create transaction')
      }

      const responseData = await response.json()
      setSuccess('Transaction created successfully!')
      setFormData({
        title: '',
        transactionType: 'sale',
        expectedCloseDate: '',
        selectedTC: approvedTCs[0]?.tc_id || '',
      })

      // Optionally refresh parent component data if needed
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading approved TCs...</div>
  }

  if (approvedTCs.length === 0) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-400 font-medium">No approved TC assigned</p>
            <p className="text-yellow-400 text-sm mt-1">
              You need to have an approved Transaction Coordinator assigned before creating transactions.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-blue-500">
      <h3 className="text-lg font-bold text-white mb-6">Create New Transaction</h3>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Transaction Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., 123 Main Street - Residential Sale"
            className="w-full border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Transaction Type
            </label>
            <select
              value={formData.transactionType}
              onChange={(e) => setFormData({ ...formData, transactionType: e.target.value })}
              className="w-full border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            >
              <option value="sale">Sale</option>
              <option value="purchase">Purchase</option>
              <option value="lease">Lease</option>
              <option value="refinance">Refinance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Expected Close Date
            </label>
            <input
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
              className="w-full border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Assign Transaction Coordinator
          </label>
          <select
            value={formData.selectedTC}
            onChange={(e) => setFormData({ ...formData, selectedTC: e.target.value })}
            className="w-full border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
          >
            <option value="">-- Select a TC --</option>
            {approvedTCs.map((tc) => (
              <option key={tc.tc_id} value={tc.tc_id}>
                TC - {tc.tc_id.slice(0, 8)} ({tc.commission_split}% commission)
              </option>
            ))}
          </select>
          <p className="text-gray-400 text-xs mt-1">
            Select which approved TC will handle this transaction
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !formData.selectedTC}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Creating...' : 'Create Transaction'}
        </button>
      </form>
    </div>
  )
}
