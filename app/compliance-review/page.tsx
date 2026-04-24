'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ComplianceNotifications from '../components/compliance-notifications'

interface ComplianceSubmission {
  id: string
  agent_id: string
  agent_name: string
  deal_id: string
  deal_name: string
  stage: string
  document_name: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_needed'
  submitted_at: string
  reviewed_at?: string
  rejection_reason?: string
  ai_analysis?: {
    issues: string[]
    compliance_score: number
    success: boolean
  }
}

export default function ComplianceReviewPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [submissions, setSubmissions] = useState<ComplianceSubmission[]>([])
  const [supabase, setSupabase] = useState<any>(null)
  const [selectedSubmission, setSelectedSubmission] = useState<ComplianceSubmission | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }

    // Only brokers/admins can access this page
    if (!loading && user && role !== 'broker' && role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, loading, role, router])

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey)
      setSupabase(client)
      loadSubmissions(client)
    }
  }, [])

  const loadSubmissions = async (client: any) => {
    try {
      // Load all compliance submissions (for broker review)
      const { data, error } = await client
        .from('compliance_submissions')
        .select('*')
        .order('submitted_at', { ascending: false })

      if (data) {
        setSubmissions(data)
      }
    } catch (err) {
      console.error('Error loading submissions:', err)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const createNotificationForAgent = async (
    agentId: string,
    type: 'approval' | 'rejection' | 'revision_needed',
    title: string,
    message: string,
    submissionId: string
  ) => {
    if (!supabase) return

    try {
      await supabase.from('compliance_notifications').insert({
        user_id: agentId,
        type,
        title,
        message,
        document_id: submissionId,
        read: false
      })
    } catch (err) {
      console.error('Error creating notification:', err)
    }
  }

  const handleApprove = async (submission: ComplianceSubmission) => {
    if (!supabase) return

    setIsSubmitting(true)
    try {
      // Update submission status
      await supabase
        .from('compliance_submissions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submission.id)

      // Create notification for agent
      await createNotificationForAgent(
        submission.agent_id,
        'approval',
        'Compliance Document Approved ✅',
        `Your ${submission.stage} stage document "${submission.document_name}" has been approved.`,
        submission.id
      )

      // Reload submissions
      await loadSubmissions(supabase)
      setSelectedSubmission(null)
    } catch (err) {
      console.error('Error approving submission:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async (submission: ComplianceSubmission) => {
    if (!supabase || !rejectionReason.trim()) return

    setIsSubmitting(true)
    try {
      // Update submission status
      await supabase
        .from('compliance_submissions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submission.id)

      // Create notification for agent
      await createNotificationForAgent(
        submission.agent_id,
        'rejection',
        'Compliance Document Rejected ❌',
        `Your ${submission.stage} stage document requires revision: ${rejectionReason}`,
        submission.id
      )

      // Reload submissions
      await loadSubmissions(supabase)
      setSelectedSubmission(null)
      setRejectionReason('')
    } catch (err) {
      console.error('Error rejecting submission:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRequestRevision = async (submission: ComplianceSubmission) => {
    if (!supabase || !rejectionReason.trim()) return

    setIsSubmitting(true)
    try {
      // Update submission status
      await supabase
        .from('compliance_submissions')
        .update({
          status: 'revision_needed',
          rejection_reason: rejectionReason,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submission.id)

      // Create notification for agent
      await createNotificationForAgent(
        submission.agent_id,
        'revision_needed',
        'Revision Needed for Compliance Document 🔄',
        `Your ${submission.stage} stage document needs revision: ${rejectionReason}`,
        submission.id
      )

      // Reload submissions
      await loadSubmissions(supabase)
      setSelectedSubmission(null)
      setRejectionReason('')
    } catch (err) {
      console.error('Error requesting revision:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-3 py-1 bg-green-500/15 text-green-400 rounded-full text-sm font-medium">✅ Approved</span>
      case 'rejected':
        return <span className="px-3 py-1 bg-red-500/15 text-red-800 rounded-full text-sm font-medium">❌ Rejected</span>
      case 'revision_needed':
        return <span className="px-3 py-1 bg-yellow-500/15 text-yellow-400 rounded-full text-sm font-medium">🔄 Revision Needed</span>
      default:
        return <span className="px-3 py-1 bg-blue-500/15 text-blue-400 rounded-full text-sm font-medium">⏳ Pending Review</span>
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user || (role !== 'broker' && role !== 'admin')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Compliance Review Dashboard</h1>
            <p className="text-sm text-gray-400">Review and approve agent compliance submissions</p>
          </div>
          <div className="flex items-center gap-4">
            <ComplianceNotifications userId={user?.id} role={role} />
            <button
              onClick={handleSignOut}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-2">
            <div className="bg-[#0a0a0f] rounded-lg shadow">
              <div className="p-6 border-b border-[#1a1a2e]">
                <h2 className="font-bold text-white text-lg">Pending & Recent Submissions</h2>
              </div>

              <div className="divide-y divide-[#1a1a2e]">
                {submissions.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No compliance submissions to review</p>
                  </div>
                ) : (
                  submissions.map(submission => (
                    <div
                      key={submission.id}
                      className={`p-6 hover:bg-[#0a0a0f] cursor-pointer transition ${
                        selectedSubmission?.id === submission.id ? 'bg-blue-500/10' : ''
                      }`}
                      onClick={() => setSelectedSubmission(submission)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-white">{submission.agent_name}</p>
                          <p className="text-sm text-gray-400">{submission.deal_name} • {submission.stage}</p>
                        </div>
                        {getStatusBadge(submission.status)}
                      </div>
                      <p className="text-sm text-gray-200 mb-2">{submission.document_name}</p>
                      <p className="text-xs text-gray-400">
                        Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Review Panel */}
          {selectedSubmission && (
            <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
              <h3 className="font-bold text-white mb-4">Review Submission</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Agent</label>
                  <p className="text-white">{selectedSubmission.agent_name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Deal</label>
                  <p className="text-white">{selectedSubmission.deal_name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Stage</label>
                  <p className="text-white capitalize">{selectedSubmission.stage}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Document</label>
                  <p className="text-white">{selectedSubmission.document_name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Status</label>
                  <div>{getStatusBadge(selectedSubmission.status)}</div>
                </div>

                {/* AI Compliance Analysis */}
                {selectedSubmission.ai_analysis && (
                  <div className={`border-2 rounded-lg p-4 ${
                    selectedSubmission.ai_analysis.issues && selectedSubmission.ai_analysis.issues.length > 0
                      ? 'bg-yellow-500/10 border-yellow-300'
                      : 'bg-green-500/10 border-green-300'
                  }`}>
                    <h4 className="font-semibold text-sm mb-3">
                      {selectedSubmission.ai_analysis.issues && selectedSubmission.ai_analysis.issues.length > 0
                        ? '⚠️ Compliance Issues'
                        : '✅ Compliant'}
                    </h4>

                    {selectedSubmission.ai_analysis.compliance_score && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">Score: {selectedSubmission.ai_analysis.compliance_score}%</span>
                        </div>
                        <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              selectedSubmission.ai_analysis.compliance_score >= 80
                                ? 'bg-green-600'
                                : selectedSubmission.ai_analysis.compliance_score >= 60
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${selectedSubmission.ai_analysis.compliance_score}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {selectedSubmission.ai_analysis.issues && selectedSubmission.ai_analysis.issues.length > 0 && (
                      <ul className="text-xs space-y-1">
                        {selectedSubmission.ai_analysis.issues.map((issue: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-yellow-600 font-bold">•</span>
                            <span className="text-yellow-400">{issue}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {selectedSubmission.status === 'pending' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Notes / Rejection Reason (if rejecting)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full px-3 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        rows={3}
                        placeholder="Optional: Add notes about why this needs revision..."
                      />
                    </div>

                    <div className="space-y-2 pt-4">
                      <button
                        onClick={() => handleApprove(selectedSubmission)}
                        disabled={isSubmitting}
                        className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium disabled:bg-gray-700"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleRequestRevision(selectedSubmission)}
                        disabled={isSubmitting || !rejectionReason.trim()}
                        className="w-full bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition font-medium disabled:bg-gray-700"
                      >
                        🔄 Request Revision
                      </button>
                      <button
                        onClick={() => handleReject(selectedSubmission)}
                        disabled={isSubmitting || !rejectionReason.trim()}
                        className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition font-medium disabled:bg-gray-700"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </>
                )}

                {selectedSubmission.status !== 'pending' && (
                  <div className="bg-[#050507] p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-200 mb-2">Review Notes</p>
                    <p className="text-white">{selectedSubmission.rejection_reason || 'No notes'}</p>
                    <p className="text-xs text-gray-400 mt-3">
                      Reviewed: {new Date(selectedSubmission.reviewed_at || '').toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
