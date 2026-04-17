'use client'

import { useEffect, useState } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface TCCreationRequest {
  id: string
  agent_id: string
  tc_name: string
  tc_email: string
  commission_split: number
  status: string
  requested_at: string
}

export default function BrokerTCCreationApprovals({ userId, userRole }: { userId: string; userRole: string }) {
  const [requests, setRequests] = useState<TCCreationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [denialReason, setDenialReason] = useState<{ [key: string]: string }>({})

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  useEffect(() => {
    fetchRequests()
    subscribeToChanges()
  }, [userId])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/broker/tc/creation-requests', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setRequests(data.data || [])
      } else {
        setError('Failed to load TC creation requests')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToChanges = () => {
    try {
      // Subscribe to TC creation requests changes
      const channel = supabase
        .channel(`tc-creation-requests:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tc_creation_requests',
          },
          () => {
            fetchRequests()
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

  const handleApprove = async (requestId: string) => {
    try {
      setApprovingId(requestId)
      setError(null)

      const response = await fetch('/api/broker/tc/creation-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          request_id: requestId,
          action: 'approve',
        }),
      })

      if (response.ok) {
        await fetchRequests()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to approve request')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setApprovingId(null)
    }
  }

  const handleDeny = async (requestId: string) => {
    try {
      setDenyingId(requestId)
      setError(null)

      const response = await fetch('/api/broker/tc/creation-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          request_id: requestId,
          action: 'deny',
          denial_reason: denialReason[requestId] || null,
        }),
      })

      if (response.ok) {
        setDenialReason({ ...denialReason, [requestId]: '' })
        await fetchRequests()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to deny request')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny')
    } finally {
      setDenyingId(null)
    }
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending_approval')
  const approvedRequests = requests.filter((r) => r.status === 'approved')
  const deniedRequests = requests.filter((r) => r.status === 'denied')

  if (loading) {
    return <div className="text-center py-8">Loading TC creation requests...</div>
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Pending Approvals */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          Pending TC Creation Requests ({pendingRequests.length})
        </h3>
        {pendingRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
            No pending TC creation requests
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <div key={request.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{request.tc_name}</p>
                    <p className="text-sm text-gray-600">{request.tc_email}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Commission Split: <span className="font-medium">{request.commission_split}%</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Requested: {new Date(request.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Denial Reason (optional)
                    </label>
                    <textarea
                      value={denialReason[request.id] || ''}
                      onChange={(e) => setDenialReason({ ...denialReason, [request.id]: e.target.value })}
                      placeholder="Provide a reason if you're going to deny this request"
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={approvingId === request.id}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {approvingId === request.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleDeny(request.id)}
                      disabled={denyingId === request.id}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      {denyingId === request.id ? 'Denying...' : 'Deny'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Requests */}
      {approvedRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Approved Requests ({approvedRequests.length})</h3>
          <div className="space-y-3">
            {approvedRequests.map((request) => (
              <div key={request.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-semibold text-gray-900">{request.tc_name}</p>
                <p className="text-sm text-gray-600">{request.tc_email}</p>
                <p className="text-xs text-green-700 mt-2">✓ TC created and approved</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Denied Requests */}
      {deniedRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Denied Requests ({deniedRequests.length})</h3>
          <div className="space-y-3">
            {deniedRequests.map((request) => (
              <div key={request.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-semibold text-gray-900">{request.tc_name}</p>
                <p className="text-sm text-gray-600">{request.tc_email}</p>
                <p className="text-xs text-red-700 mt-2">✗ Request denied</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
