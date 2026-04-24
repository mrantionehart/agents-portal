'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../../providers'
import Link from 'next/link'
import { ArrowLeft, Plus, Upload, Mail, CheckCircle, Clock, AlertCircle, Trash2, Download, Eye, Send } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../../components/compliance-notifications'

interface OnboardingDocument {
  id: string
  name: string
  fileName: string
  uploadedAt: string
  uploadedBy: string
}

interface OnboardingInvite {
  id: string
  firstName: string
  lastName: string
  email: string
  docusignEnvelopeId?: string
  status: 'pending_invite' | 'signing' | 'signed' | 'awaiting_approval' | 'approved' | 'provisioned'
  provisionedEmail?: string
  signingLink?: string
  signedAt?: string
  approvedAt?: string
  provisionedAt?: string
  createdAt: string
}

const STATUS_CONFIG = {
  pending_invite: { label: 'Pending Invite', color: 'bg-[#0a0a0f]', textColor: 'text-white', icon: '📧' },
  signing: { label: 'Signing', color: 'bg-blue-500/15', textColor: 'text-blue-400', icon: '✍️' },
  signed: { label: 'Signed', color: 'bg-yellow-500/15', textColor: 'text-yellow-400', icon: '📝' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'bg-orange-500/15', textColor: 'text-orange-800', icon: '⏳' },
  approved: { label: 'Approved', color: 'bg-purple-500/15', textColor: 'text-purple-800', icon: '✅' },
  provisioned: { label: 'Provisioned', color: 'bg-green-500/15', textColor: 'text-green-400', icon: '🎉' },
}

export default function OnboardingPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [documents, setDocuments] = useState<OnboardingDocument[]>([])
  const [invites, setInvites] = useState<OnboardingInvite[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDocUpload, setShowDocUpload] = useState(false)
  const [showNewInvite, setShowNewInvite] = useState(false)
  const [activeTab, setActiveTab] = useState<'documents' | 'invites' | 'approval'>('documents')

  const [newDocName, setNewDocName] = useState('')
  const [newInvite, setNewInvite] = useState({
    firstName: '',
    lastName: '',
    email: '',
  })

  useEffect(() => {
    if (user && (role === 'broker' || role === 'admin')) {
      loadOnboardingData()
    }
  }, [user, role])

  const loadOnboardingData = async () => {
    if (!user || (role !== 'broker' && role !== 'admin')) return

    try {
      setDataLoading(true)
      setError(null)

      // Placeholder: In production, fetch from Vault API
      // const result = await vaultAPI.onboarding.list()
      setDocuments([])
      setInvites([])
    } catch (err) {
      console.error('Error loading onboarding data:', err)
      setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDataLoading(false)
    }
  }

  const handleUploadDocument = () => {
    if (!newDocName.trim()) {
      alert('Please enter document name')
      return
    }

    const newDoc: OnboardingDocument = {
      id: `doc${Date.now()}`,
      name: newDocName,
      fileName: `${newDocName.toLowerCase().replace(/\s+/g, '_')}.pdf`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.email || '',
    }

    setDocuments([...documents, newDoc])
    setNewDocName('')
    setShowDocUpload(false)
  }

  const handleSendInvite = async () => {
    if (!newInvite.firstName || !newInvite.lastName || !newInvite.email) {
      alert('Please fill in all fields')
      return
    }

    const invite: OnboardingInvite = {
      id: `inv${Date.now()}`,
      ...newInvite,
      status: 'pending_invite',
      signingLink: `https://docusign.example.com/signing/${Date.now()}`, // Placeholder
      createdAt: new Date().toISOString(),
    }

    setInvites([...invites, invite])
    setNewInvite({
      firstName: '',
      lastName: '',
      email: '',
    })
    setShowNewInvite(false)

    // In production, this would:
    // 1. Call DocuSign API to send envelope
    // 2. Get back envelope ID and signing link
    // 3. Send email to agent with signing link
  }

  const handleApproveAgent = async (inviteId: string) => {
    setInvites(
      invites.map((inv) =>
        inv.id === inviteId
          ? {
              ...inv,
              status: 'approved',
              approvedAt: new Date().toISOString(),
            }
          : inv
      )
    )

    // In production, this would call provisioning endpoint
    // await vaultAPI.onboarding.approveAndProvision(inviteId)
  }

  const handleSendCredentials = async (inviteId: string) => {
    const invite = invites.find((inv) => inv.id === inviteId)
    if (!invite || invite.status !== 'approved') return

    setInvites(
      invites.map((inv) =>
        inv.id === inviteId
          ? {
              ...inv,
              status: 'provisioned',
              provisionedEmail: `${invite.firstName.toLowerCase()}.${invite.lastName.toLowerCase()}@hartfeltrealestate.com`,
              provisionedAt: new Date().toISOString(),
            }
          : inv
      )
    )

    // In production, this would:
    // 1. Create Google Workspace account
    // 2. Create Supabase user
    // 3. Send welcome email with credentials
  }

  const handleDeleteDocument = (docId: string) => {
    if (confirm('Delete this document?')) {
      setDocuments(documents.filter((d) => d.id !== docId))
    }
  }

  const handleDeleteInvite = (inviteId: string) => {
    if (confirm('Delete this invite?')) {
      setInvites(invites.filter((i) => i.id !== inviteId))
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user || (role !== 'broker' && role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">Only brokers and admins can access this page.</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const pendingApproval = invites.filter((i) => i.status === 'signed' || i.status === 'awaiting_approval')
  const provisioned = invites.filter((i) => i.status === 'provisioned')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">Agent Onboarding</h1>
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
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[#1a1a2e]">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'invites'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Invites ({invites.length})
          </button>
          <button
            onClick={() => setActiveTab('approval')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'approval'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Approvals <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full ml-2">{pendingApproval.length}</span>
          </button>
        </div>

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <>
            <div className="mb-8">
              <button
                onClick={() => setShowDocUpload(!showDocUpload)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                {showDocUpload ? 'Cancel' : 'Upload Document'}
              </button>
            </div>

            {showDocUpload && (
              <div className="bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 p-8 mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Upload Onboarding Document</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Document Name *</label>
                    <input
                      type="text"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      placeholder="e.g., HartFelt Agent Agreement"
                      className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">PDF File</label>
                    <div className="border-2 border-dashed border-[#1a1a2e] rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">Click to upload PDF</p>
                      <p className="text-xs text-gray-400 mt-1">Max 10MB</p>
                    </div>
                  </div>

                  <button
                    onClick={handleUploadDocument}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Upload Document
                  </button>
                </div>
              </div>
            )}

            {/* Documents List */}
            {documents.length > 0 ? (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="bg-[#0a0a0f] rounded-lg shadow p-6 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-white">{doc.name}</h3>
                      <p className="text-sm text-gray-400">
                        Uploaded by {doc.uploadedBy} on {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-blue-500/10 text-blue-600 rounded-lg hover:bg-blue-500/15 transition flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="px-4 py-2 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/15 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#0a0a0f] rounded-lg shadow p-12 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">No documents yet</p>
                <p className="text-gray-400 text-sm">Upload onboarding documents that agents will sign</p>
              </div>
            )}
          </>
        )}

        {/* Invites Tab */}
        {activeTab === 'invites' && (
          <>
            <div className="mb-8">
              <button
                onClick={() => setShowNewInvite(!showNewInvite)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {showNewInvite ? 'Cancel' : 'Send New Invite'}
              </button>
            </div>

            {showNewInvite && (
              <div className="bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 p-8 mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Send Signing Invite</h2>
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={newInvite.firstName}
                      onChange={(e) => setNewInvite({ ...newInvite, firstName: e.target.value })}
                      placeholder="John"
                      className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={newInvite.lastName}
                      onChange={(e) => setNewInvite({ ...newInvite, lastName: e.target.value })}
                      placeholder="Smith"
                      className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Email *</label>
                    <input
                      type="email"
                      value={newInvite.email}
                      onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                      placeholder="john@example.com"
                      className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendInvite}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Send Signing Invite
                </button>
              </div>
            )}

            {/* Invites List */}
            {invites.length > 0 ? (
              <div className="space-y-4">
                {invites.map((invite) => {
                  const statusConfig = STATUS_CONFIG[invite.status]
                  return (
                    <div key={invite.id} className={`rounded-lg shadow p-6 ${statusConfig.color}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{statusConfig.icon}</span>
                            <h3 className={`text-lg font-bold ${statusConfig.textColor}`}>
                              {invite.firstName} {invite.lastName}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-400">{invite.email}</p>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusConfig.color} ${statusConfig.textColor} border`}>
                          {statusConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm mb-4">
                        {invite.signingLink && invite.status === 'pending_invite' && (
                          <a
                            href={invite.signingLink}
                            className="text-blue-600 hover:text-blue-400 font-medium"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Signing Link
                          </a>
                        )}
                        {invite.signedAt && (
                          <span className="text-gray-200">
                            Signed: {new Date(invite.signedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {invite.status === 'signed' && (
                          <button
                            onClick={() => handleApproveAgent(invite.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Mark Approved
                          </button>
                        )}

                        {invite.status === 'approved' && (
                          <button
                            onClick={() => handleSendCredentials(invite.id)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            Send Credentials
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteInvite(invite.id)}
                          className="px-4 py-2 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/15 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-[#0a0a0f] rounded-lg shadow p-12 text-center">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">No invites sent yet</p>
                <p className="text-gray-400 text-sm">Send signing invites to new agents</p>
              </div>
            )}
          </>
        )}

        {/* Approval Tab */}
        {activeTab === 'approval' && (
          <>
            {pendingApproval.length > 0 ? (
              <div className="space-y-4">
                {pendingApproval.map((invite) => {
                  const statusConfig = STATUS_CONFIG[invite.status]
                  return (
                    <div key={invite.id} className="bg-[#0a0a0f] rounded-lg shadow p-6 border-l-4 border-orange-500">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white">
                            {invite.firstName} {invite.lastName}
                          </h3>
                          <p className="text-sm text-gray-400">{invite.email}</p>
                          {invite.signedAt && (
                            <p className="text-sm text-green-600 mt-1">
                              ✓ Signed on {new Date(invite.signedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-blue-500/10 p-4 rounded-lg mb-4">
                        <p className="text-sm font-medium text-white mb-2">Next Steps:</p>
                        <ol className="text-sm text-gray-200 space-y-1 list-decimal list-inside">
                          <li>Review signed onboarding documents</li>
                          <li>Click "Approve" to create email account</li>
                          <li>Click "Send Credentials" to notify agent</li>
                          <li>Email: {invite.firstName.toLowerCase()}.{invite.lastName.toLowerCase()}@hartfeltrealestate.com</li>
                        </ol>
                      </div>

                      <div className="flex gap-2">
                        {invite.status === 'signed' && (
                          <button
                            onClick={() => handleApproveAgent(invite.id)}
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Approve & Create Email
                          </button>
                        )}

                        {invite.status === 'approved' && (
                          <button
                            onClick={() => handleSendCredentials(invite.id)}
                            className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center gap-2"
                          >
                            <Send className="w-5 h-5" />
                            Send Credentials to Agent
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-[#0a0a0f] rounded-lg shadow p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">All caught up!</p>
                <p className="text-gray-400 text-sm">No agents awaiting approval right now</p>
              </div>
            )}
          </>
        )}

        {/* Provisioned Agents */}
        {provisioned.length > 0 && (
          <div className="mt-12 pt-8 border-t border-[#1a1a2e]">
            <h2 className="text-2xl font-bold text-white mb-6">✅ Recently Provisioned</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {provisioned.slice(0, 4).map((invite) => (
                <div key={invite.id} className="bg-green-500/10 rounded-lg shadow p-6 border-l-4 border-green-500">
                  <h3 className="font-bold text-white">{invite.firstName} {invite.lastName}</h3>
                  <p className="text-sm text-gray-400 mb-2">{invite.provisionedEmail}</p>
                  <p className="text-xs text-gray-400">
                    Provisioned: {invite.provisionedAt && new Date(invite.provisionedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mt-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Onboarding Workflow</p>
              <p className="text-sm text-blue-400">
                1) Upload templates → 2) Send invite → 3) Agent signs → 4) You approve → 5) Email created → 6) Credentials sent. Agent can then login to Portal and EASE app.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
