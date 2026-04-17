'use client'

import { useEffect, useState } from 'react'
import { Send, AlertCircle, CheckCircle, Plus } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface TC {
  id: string
  agent_id: string
  tc_user_id: string
  status: string
  hire_date: string
  created_at: string
}

interface TCCreationRequest {
  id: string
  tc_name: string
  tc_email: string
  status: string
  requested_at: string
}

interface ExistingAssignment {
  id: string
  tc_id: string
  status: string
}

export default function AgentTCRequestEnhanced({ userId, userRole }: { userId: string; userRole: string }) {
  const [tcs, setTCs] = useState<TC[]>([])
  const [tcCreationRequests, setTCCreationRequests] = useState<TCCreationRequest[]>([])
  const [selectedTCId, setSelectedTCId] = useState<string>('')
  const [commissionSplit, setCommissionSplit] = useState<number>(0)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [tcName, setTCName] = useState<string>('')
  const [tcEmail, setTCEmail] = useState<string>('')
  const [tcCommissionSplit, setTCCommissionSplit] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [existingAssignments, setExistingAssignments] = useState<ExistingAssignment[]>([])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  useEffect(() => {
    fetchData()
    subscribeToChanges()
  }, [userId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch available TCs
      const tcsRes = await fetch('/api/broker/tc/coordinators', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })
      if (tcsRes.ok) {
        const data = await tcsRes.json()
        const activeTCs = (data.data || []).filter((tc: TC) => tc.status === 'active')
        setTCs(activeTCs)
      }

      // Fetch existing assignments and TC creation requests
      const assignRes = await fetch('/api/broker/tc/assignments', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })
      if (assignRes.ok) {
        const data = await assignRes.json()
        setExistingAssignments(data.data || [])
      }

      // Fetch TC creation requests
      const tcReqRes = await fetch('/api/broker/tc/creation-requests', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })
      if (tcReqRes.ok) {
        const data = await tcReqRes.json()
        setTCCreationRequests(data.data || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToChanges = () => {
    try {
      // Subscribe to TC creation requests changes
      const channel = supabase
        .channel(`agent-tc-requests:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tc_creation_requests',
            filter: `agent_id=eq.${userId}`,
          },
          () => {
            fetchData()
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    } catch (err) {
      console.error('Error subscribing to changes:', err)
    }
  }

  const handleRequestTC = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTCId) {
      setError('Please select a Transaction Coordinator')
      return
    }

    if (commissionSplit < 0 || commissionSplit > 100) {
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
        setSuccess('TC assignment request submitted! Waiting for broker approval.')
        setSelectedTCId('')
        setCommissionSplit(0)
        await fetchData()
      } else {
        setError(data.error || 'Failed to submit request')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateTC = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tcName.trim()) {
      setError('TC name is required')
      return
    }

    if (!tcEmail.trim() || !tcEmail.includes('@')) {
      setError('Valid TC email is required')
      return
    }

    if (tcCommissionSplit < 0 || tcCommissionSplit > 100) {
      setError('Commission split must be between 0 and 100')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/broker/tc/creation-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          tc_name: tcName,
          tc_email: tcEmail,
          commission_split: tcCommissionSplit,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('TC creation request submitted! Your broker will review and approve.')
        setTCName('')
        setTCEmail('')
        setTCCommissionSplit(0)
        setShowCreateForm(false)
        await fetchData()
      } else {
        setError(data.error || 'Failed to submit TC creation request')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const hasPendingAssignment = existingAssignments.some((a) => a.status === 'pending_approval')
  const hasApprovedAssignment = existingAssignments.some((a) => a.status === 'approved')
  const hasPendingTCRequest = tcCreationRequests.some((r) => r.status === 'pending_approval')
  const hasApprovedTCRequest = tcCreationRequests.some((r) => r.status === 'approved')

  if (loading) {
    return <div className="text-center py-8">Loading Transaction Coordinators...</div>
  }

  return (
    <div className="space-y-6">
      {/* Existing Assignment */}
      {hasApprovedAssignment && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-green-800 font-medium">You have an approved TC assignment</p>
            <p className="text-green-700 text-sm mt-1">You can use this TC when creating transactions</p>
          </div>
        </div>
      )}

      {hasPendingAssignment && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-800 font-medium">Pending TC assignment approval</p>
            <p className="text-yellow-700 text-sm mt-1">Your request is waiting for broker approval</p>
          </div>
        </div>
      )}

      {hasPendingTCRequest && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-800 font-medium">TC creation request pending</p>
            <p className="text-blue-700 text-sm mt-1">Your TC creation request is being reviewed by your broker</p>
          </div>
        </div>
      )}

      {hasApprovedTCRequest && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-green-800 font-medium">Your TC has been created and approved</p>
            <p className="text-green-700 text-sm mt-1">You can now use this TC for your transactions</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      {/* Request Existing TC */}
      {!hasApprovedAssignment && !hasPendingAssignment && (
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Request Existing TC</h3>
          <form onSubmit={handleRequestTC} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Transaction Coordinator
              </label>
              {tcs.length === 0 ? (
                <p className="text-gray-500 text-sm">No active Transaction Coordinators available</p>
              ) : (
                <select
                  value={selectedTCId}
                  onChange={(e) => setSelectedTCId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a TC --</option>
                  {tcs.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      TC {tc.tc_user_id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission Split (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={commissionSplit !== undefined ? commissionSplit : ''}
                onChange={(e) => setCommissionSplit(parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedTCId}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Request TC'}
            </button>
          </form>
        </div>
      )}

      {/* Create New TC */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-500">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Request New TC</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            {showCreateForm ? 'Cancel' : 'Create TC'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateTC} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TC Name
              </label>
              <input
                type="text"
                value={tcName}
                onChange={(e) => setTCName(e.target.value)}
                placeholder="e.g., John Smith"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TC Email
              </label>
              <input
                type="email"
                value={tcEmail}
                onChange={(e) => setTCEmail(e.target.value)}
                placeholder="e.g., john@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission Split (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={tcCommissionSplit !== undefined ? tcCommissionSplit : ''}
                onChange={(e) => setTCCommissionSplit(parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit TC Creation Request'}
            </button>
          </form>
        )}

        {!showCreateForm && (
          <p className="text-gray-600 text-sm">Don't see the TC you need? Request a new one to be created and approved by your broker.</p>
        )}
      </div>
    </div>
  )
}
