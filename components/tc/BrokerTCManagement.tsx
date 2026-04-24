'use client'

import { useEffect, useState } from 'react'
import { Plus, Check, X, Users, FileText } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import BrokerTCCreationApprovals from './BrokerTCCreationApprovals'
import BrokerReviewDashboard from '../broker/BrokerReviewDashboard'

interface TC {
  id: string
  agent_id: string
  tc_user_id: string
  status: string
  hire_date: string
  created_at: string
}

interface Assignment {
  id: string
  agent_id: string
  tc_id: string
  status: string
  commission_split: number
  requested_at: string
}

export default function BrokerTCManagement({ userId, userRole }: { userId: string; userRole: string }) {
  const [tcs, setTCs] = useState<TC[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)

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

      // Fetch TCs
      const tcsResponse = await fetch('/api/broker/tc/coordinators', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })
      if (tcsResponse.ok) {
        const tcsData = await tcsResponse.json()
        setTCs(tcsData.data || [])
      }

      // Fetch Assignments
      const assignResponse = await fetch('/api/broker/tc/assignments', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })
      if (assignResponse.ok) {
        const assignData = await assignResponse.json()
        setAssignments(assignData.data || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToChanges = () => {
    try {
      // Subscribe to assignment changes
      const channel = supabase
        .channel(`broker-tc-management:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tc_assignments',
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

  const handleApprove = async (assignmentId: string) => {
    try {
      setApprovingId(assignmentId)
      setError(null)

      const response = await fetch('/api/broker/tc/assignments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          assignment_id: assignmentId,
          action: 'approve',
        }),
      })

      if (response.ok) {
        // Refresh assignments
        await fetchData()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to approve assignment')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve assignment')
    } finally {
      setApprovingId(null)
    }
  }

  const handleDeny = async (assignmentId: string) => {
    try {
      setDenyingId(assignmentId)
      setError(null)

      const response = await fetch('/api/broker/tc/assignments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          assignment_id: assignmentId,
          action: 'deny',
        }),
      })

      if (response.ok) {
        // Refresh assignments
        await fetchData()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to deny assignment')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny assignment')
    } finally {
      setDenyingId(null)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading TC management...</div>
  }

  const pendingAssignments = assignments.filter((a) => a.status === 'pending_approval')
  const activeTCs = tcs.filter((t) => t.status === 'active')

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Transaction Coordinator Management</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create TC
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-gray-400 text-sm font-medium mb-1">Total TCs</p>
          <p className="text-3xl font-bold text-white">{tcs.length}</p>
        </div>
        <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-green-500">
          <p className="text-gray-400 text-sm font-medium mb-1">Active TCs</p>
          <p className="text-3xl font-bold text-white">{activeTCs.length}</p>
        </div>
        <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <p className="text-gray-400 text-sm font-medium mb-1">Pending Assignments</p>
          <p className="text-3xl font-bold text-white">{pendingAssignments.length}</p>
        </div>
        <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-purple-500">
          <p className="text-gray-400 text-sm font-medium mb-1">Total Assignments</p>
          <p className="text-3xl font-bold text-white">{assignments.length}</p>
        </div>
        <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-indigo-500">
          <p className="text-gray-400 text-sm font-medium mb-1">Avg Commission</p>
          <p className="text-3xl font-bold text-white">
            {assignments.length > 0
              ? (
                  assignments.reduce((sum, a) => sum + (a.commission_split || 0), 0) / assignments.length
                ).toFixed(1)
              : '0'}
            %
          </p>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-bold text-white mb-4">Create Transaction Coordinator</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Agent Email"
              className="border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            />
            <input
              type="email"
              placeholder="TC Email"
              className="border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            />
            <input
              type="number"
              placeholder="Commission Split (%)"
              className="border border-[#1a1a2e] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            />
            <button className="bg-blue-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-blue-700 transition">
              Create
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#1a1a2e]">
        <div className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'tcs', label: 'Transaction Coordinators' },
            { id: 'assignments', label: 'Assignments' },
            { id: 'pending', label: 'Pending Approvals' },
            { id: 'reviews', label: 'Deal Reviews' },
            { id: 'tc-creation', label: 'TC Creation Requests' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Recent TC Hires
              </h3>
              {tcs.length > 0 ? (
                <div className="space-y-2">
                  {tcs.slice(-3).map((tc) => (
                    <div key={tc.id} className="p-3 bg-[#050507] rounded-lg text-sm">
                      <p className="font-medium text-white">TC-{tc.id.substring(0, 8)}</p>
                      <p className="text-gray-400">Status: {tc.status}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No TCs hired yet</p>
              )}
            </div>

            <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Pending Actions
              </h3>
              <div className="space-y-2">
                {pendingAssignments.length > 0 ? (
                  <>
                    <p className="font-medium text-white">{pendingAssignments.length} Assignment Requests</p>
                    <p className="text-sm text-gray-400">Review and approve in the Assignments tab</p>
                  </>
                ) : (
                  <p className="text-gray-400 text-sm">No pending actions</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tcs' && (
          <div className="bg-[#0a0a0f] rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#050507]">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">TC ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Hire Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tcs.map((tc) => (
                    <tr key={tc.id} className="hover:bg-[#0a0a0f]">
                      <td className="px-6 py-3 text-sm font-medium">TC-{tc.id.substring(0, 8)}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tc.status)}`}>
                          {tc.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm">{new Date(tc.hire_date).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-sm">
                        <button className="text-blue-600 hover:text-blue-900 font-medium">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="bg-[#0a0a0f] rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#050507]">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Agent ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">TC ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Commission</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.map((assign) => (
                    <tr key={assign.id} className="hover:bg-[#0a0a0f]">
                      <td className="px-6 py-3 text-sm">{assign.agent_id.substring(0, 8)}</td>
                      <td className="px-6 py-3 text-sm">{assign.tc_id.substring(0, 8)}</td>
                      <td className="px-6 py-3 text-sm">{assign.commission_split}%</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assign.status)}`}>
                          {assign.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm">{new Date(assign.requested_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingAssignments.map((assign) => (
              <div key={assign.id} className="bg-[#0a0a0f] rounded-lg shadow p-6 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">
                    Agent {assign.agent_id.substring(0, 8)} requesting TC assignment
                  </p>
                  <p className="text-sm text-gray-400">Commission split: {assign.commission_split}%</p>
                  <p className="text-sm text-gray-400">Requested: {new Date(assign.requested_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(assign.id)}
                    disabled={approvingId === assign.id}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {approvingId === assign.id ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleDeny(assign.id)}
                    disabled={denyingId === assign.id}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {denyingId === assign.id ? 'Denying...' : 'Deny'}
                  </button>
                </div>
              </div>
            ))}
            {pendingAssignments.length === 0 && (
              <div className="bg-[#0a0a0f] rounded-lg shadow p-6 text-center text-gray-400">No pending assignments</div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <BrokerReviewDashboard userId={userId} userRole={userRole} />
        )}

        {activeTab === 'tc-creation' && (
          <BrokerTCCreationApprovals userId={userId} userRole={userRole} />
        )}
      </div>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'approved':
      return 'bg-green-500/15 text-green-400'
    case 'pending_approval':
      return 'bg-yellow-500/15 text-yellow-400'
    case 'inactive':
      return 'bg-[#0a0a0f] text-white'
    default:
      return 'bg-[#0a0a0f] text-white'
  }
}
