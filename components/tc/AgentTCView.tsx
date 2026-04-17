'use client'

import { useEffect, useState } from 'react'
import { FileText, CheckCircle, AlertCircle, Calendar } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import DocumentUploadForm from './DocumentUploadForm'
import MilestoneForm from './MilestoneForm'
import MilestoneList from './MilestoneList'
import MilestoneTracker from './MilestoneTracker'
import MilestoneTimeline from './MilestoneTimeline'
import AgentReviewStatus from '../broker/AgentReviewStatus'

interface TCTransaction {
  id: string
  title: string
  status: string
  transaction_type: string
  expected_close_date?: string
  created_at: string
}

interface TCDocument {
  id: string
  file_name: string
  doc_type: string
  status: string
  uploaded_at: string
}

interface TCMilestone {
  id: string
  milestone_name: string
  description?: string
  due_date: string
  status: string
  completed_date?: string
  order?: number
  is_deleted?: boolean
}

export default function AgentTCView({ userId, userRole }: { userId: string; userRole: string }) {
  const [transactions, setTransactions] = useState<TCTransaction[]>([])
  const [documents, setDocuments] = useState<TCDocument[]>([])
  const [milestones, setMilestones] = useState<TCMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)

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

      // Fetch transactions
      const txnResponse = await fetch('/api/broker/tc/transactions', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })
      if (txnResponse.ok) {
        const txnData = await txnResponse.json()
        setTransactions(txnData.data || [])
      }

      // Fetch documents
      const docResponse = await fetch('/api/broker/tc/documents', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })
      if (docResponse.ok) {
        const docData = await docResponse.json()
        setDocuments(docData.data || [])
      }

      // Fetch milestones
      const msResponse = await fetch('/api/broker/tc/milestones', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
      })
      if (msResponse.ok) {
        const msData = await msResponse.json()
        setMilestones(msData.data || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleMilestoneStatusToggle = async (milestoneId: string, currentStatus: string) => {
    if (currentStatus === 'completed') {
      return // Already completed, don't allow toggling back
    }

    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending'

    try {
      const response = await fetch('/api/broker/tc/milestones/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          milestone_id: milestoneId,
          status: newStatus,
        }),
      })

      if (response.ok) {
        // Update will be handled by subscription
        fetchData()
      }
    } catch (err) {
      console.error('Error updating milestone:', err)
    }
  }

  const subscribeToChanges = () => {
    try {
      // Subscribe to transactions
      const txnChannel = supabase
        .channel(`transactions:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tc_transactions',
            filter: `agent_id=eq.${userId}`,
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              setTransactions((prev) => [payload.new as TCTransaction, ...prev])
            } else if (payload.eventType === 'UPDATE') {
              setTransactions((prev) =>
                prev.map((t) => (t.id === (payload.new as TCTransaction).id ? (payload.new as TCTransaction) : t))
              )
            }
          }
        )
        .subscribe()

      // Subscribe to documents
      const docChannel = supabase
        .channel(`documents:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tc_documents',
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              setDocuments((prev) => [payload.new as TCDocument, ...prev])
            } else if (payload.eventType === 'UPDATE') {
              setDocuments((prev) =>
                prev.map((d) => (d.id === (payload.new as TCDocument).id ? (payload.new as TCDocument) : d))
              )
            }
          }
        )
        .subscribe()

      // Subscribe to milestones
      const msChannel = supabase
        .channel(`milestones:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tc_milestones',
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              setMilestones((prev) => [payload.new as TCMilestone, ...prev])
            } else if (payload.eventType === 'UPDATE') {
              setMilestones((prev) =>
                prev.map((m) => (m.id === (payload.new as TCMilestone).id ? (payload.new as TCMilestone) : m))
              )
            }
          }
        )
        .subscribe()

      return () => {
        txnChannel.unsubscribe()
        docChannel.unsubscribe()
        msChannel.unsubscribe()
      }
    } catch (err) {
      console.error('Error subscribing to changes:', err)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading your TC's work...</div>
  }

  const activeTransactions = transactions.filter((t) => t.status !== 'completed' && t.status !== 'stalled')
  const pendingDocs = documents.filter((d) => d.status === 'pending')
  const overdueMilestones = milestones.filter((m) => m.status === 'overdue')

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium mb-1">Active Transactions</p>
          <p className="text-3xl font-bold text-gray-900">{activeTransactions.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm font-medium mb-1">Pending Documents</p>
          <p className="text-3xl font-bold text-gray-900">{pendingDocs.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm font-medium mb-1">Overdue Milestones</p>
          <p className="text-3xl font-bold text-gray-900">{overdueMilestones.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium mb-1">Total Transactions</p>
          <p className="text-3xl font-bold text-gray-900">{transactions.length}</p>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Your TC's Transactions</h2>
        </div>
        {transactions.length > 0 ? (
          <div className="space-y-4 p-6">
            {transactions.map((txn) => (
              <div key={txn.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{txn.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Type: {txn.transaction_type.replace('_', ' ')} • Close: {txn.expected_close_date ? new Date(txn.expected_close_date).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(txn.status)}`}>
                    {txn.status.replace('_', ' ')}
                  </span>
                </div>
                {/* Review Status */}
                <AgentReviewStatus
                  transactionId={txn.id}
                  userId={userId}
                  userRole={userRole}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-600">No transactions yet</div>
        )}
      </div>

      {/* Document Upload Section */}
      {selectedTransactionId && (
        <DocumentUploadForm
          transactionId={selectedTransactionId}
          userId={userId}
          userRole={userRole}
          onDocumentUploaded={fetchData}
        />
      )}

      {/* Documents */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Documents</h2>
        </div>
        {documents.length > 0 ? (
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <FileText className="w-6 h-6 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{doc.file_name}</p>
                    <p className="text-sm text-gray-600 capitalize">{doc.doc_type}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDocStatusColor(doc.status)}`}>
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-600">No documents uploaded</div>
        )}
      </div>

      {/* Milestone Tracker */}
      {milestones.length > 0 && (
        <MilestoneTracker
          transactionId={selectedTransactionId || (transactions[0]?.id ?? '')}
          userId={userId}
          userRole={userRole}
          showDetails={true}
        />
      )}

      {/* Milestone Creation Section */}
      {selectedTransactionId && (
        <MilestoneForm
          transactionId={selectedTransactionId}
          userId={userId}
          userRole={userRole}
          onMilestoneCreated={fetchData}
        />
      )}

      {/* Milestones List */}
      {milestones.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Your Milestones</h2>
          <MilestoneList
            milestones={milestones}
            userId={userId}
            userRole={userRole}
            transactionId={selectedTransactionId || ''}
            onMilestoneUpdated={fetchData}
            onMilestoneDeleted={fetchData}
          />
        </div>
      )}

      {/* Milestone Timeline */}
      {milestones.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Timeline View</h2>
          <MilestoneTimeline milestones={milestones} />
        </div>
      )}
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800'
    case 'pending_docs':
      return 'bg-yellow-100 text-yellow-800'
    case 'stalled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getDocStatusColor(status: string): string {
  switch (status) {
    case 'verified':
      return 'bg-green-100 text-green-800'
    case 'received':
      return 'bg-blue-100 text-blue-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getMilestoneStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'pending':
      return 'bg-blue-100 text-blue-800'
    case 'overdue':
      return 'bg-red-100 text-red-800'
    case 'skipped':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
