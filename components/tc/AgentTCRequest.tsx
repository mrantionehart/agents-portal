'use client'

import { useEffect, useState } from 'react'
import { Send, AlertCircle, CheckCircle } from 'lucide-react'

interface TC {
  id: string
  agent_id: string
  tc_user_id: string
  status: string
  hire_date: string
  created_at: string
}

interface ExistingAssignment {
  id: string
  tc_id: string
  status: string
}

export default function AgentTCRequest({ userId, userRole }: { userId: string; userRole: string }) {
  const [tcs, setTCs] = useState<TC[]>([])
  const [selectedTCId, setSelectedTCId] = useState<string>('')
  const [commissionSplit, setCommissionSplit] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [existingAssignments, setExistingAssignments] = useState<ExistingAssignment[]>([])

  useEffect(() => {
    fetchTCs()
    fetchExistingAssignments()
  }, [userId])

  const fetchTCs = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/broker/tc/coordinators', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Filter to active TCs only
        const activeTCs = (data.data || []).filter((tc: TC) => tc.status === 'active')
        setTCs(activeTCs)
      } else {
        setError('Failed to load available Transaction Coordinators')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TCs')
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingAssignments = async () => {
    try {
      const response = await fetch('/api/broker/tc/assignments', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setExistingAssignments(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching existing assignments:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTCId) {
      setError('Please select a Transaction Coordinator')
      return
    }

    if (commissionSplit <= 0 || commissionSplit > 100) {
      setError('Commission split must be between 0 and 100')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/broker/tc/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          tc_id: selectedTCId,
          commission_split: commissionSplit,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('TC assignment request submitted successfully! Waiting for broker approval.')
        setSelectedTCId('')
        setCommissionSplit(0)
        // Refresh assignments
        await fetchExistingAssignments()
      } else {
        setError(data.error || 'Failed to submit request')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const hasPendingRequest = existingAssignments.some((a) => a.status === 'pending_approval')
  const hasApprovedAssignment = existingAssignments.some((a) => a.status === 'approved')

  if (loading) {
    return <div className="text-center py-8">Loading available Transaction Coordinators...</div>
  }

  return (
    <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-blue-500">
      <h3 className="text-lg font-bold text-white mb-4">Request Transaction Coordinator</h3>

      {hasApprovedAssignment && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-green-400 font-medium">You have an approved TC assignment</p>
            <p className="text-green-400 text-sm mt-1">You can view your TC's work in the TC Work view below</p>
          </div>
        </div>
      )}

      {hasPendingRequest && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-400 font-medium">Pending request awaiting broker approval</p>
            <p className="text-yellow-400 text-sm mt-1">Your TC request has been submitted and is pending approval from your broker</p>
          </div>
        </div>
      )}

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

      {!hasApprovedAssignment && !hasPendingRequest && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Select Transaction Coordinator
            </label>
            {tcs.length === 0 ? (
              <p className="text-gray-400 text-sm">No active Transaction Coordinators available</p>
            ) : (
              <select
                value={selectedTCId}
                onChange={(e) => setSelectedTCId(e.target.value)}
                className="w-full border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              >
                <option value="">-- Select a TC --</option>
                {tcs.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    TC {tc.tc_user_id.slice(0, 8)} (Hired: {new Date(tc.hire_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Commission Split (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={commissionSplit || ''}
              onChange={(e) => setCommissionSplit(parseFloat(e.target.value) || 0)}
              placeholder="0.0"
              className="w-full border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            />
            <p className="text-gray-400 text-xs mt-1">What percentage of your commission will the TC receive?</p>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedTCId}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit TC Request'}
          </button>
        </form>
      )}
    </div>
  )
}
