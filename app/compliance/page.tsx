'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import {
  CheckCircle2, Upload, AlertCircle, XCircle, FileText, ChevronRight,
  ChevronDown, FolderOpen, Shield, Clock, Search, Filter, ArrowLeft
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'

interface ComplianceTransaction {
  id: string
  type: string
  status: string
  property_address: string
  city: string
  state: string
  client_name: string
  contract_price: number
  closing_date: string
  contract_date: string
  agent_id: string
  agent_name?: string
  compliance: {
    required_docs: number
    total_docs: number
    uploaded: number
    approved: number
    progress: number
  }
}

interface ChecklistItem {
  requirement_id: string | null
  doc_label: string
  is_required: boolean
  folder: string
  sort_order: number
  document: {
    id: string
    name: string
    status: string
    file_path: string
    file_size: number
    mime_type: string
    upload_date: string
    verified_date: string | null
  } | null
  status: 'approved' | 'uploaded' | 'rejected' | 'missing'
}

interface ChecklistFolder {
  id: string
  label: string
  items: ChecklistItem[]
  stats: { total: number; required: number; uploaded: number; approved: number }
}

interface TransactionDetail {
  id: string
  type: string
  status: string
  property_address: string
  city: string
  state: string
  client_name: string
  contract_price: number
  closing_date: string
  contract_date: string
  agent_name: string
  agent_email: string
}

export default function CompliancePage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  // State
  const [transactions, setTransactions] = useState<ComplianceTransaction[]>([])
  const [selectedTx, setSelectedTx] = useState<TransactionDetail | null>(null)
  const [folders, setFolders] = useState<ChecklistFolder[]>([])
  const [stats, setStats] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('agent')
  const [loadingTx, setLoadingTx] = useState(true)
  const [loadingChecklist, setLoadingChecklist] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState<string | null>(null) // doc_label being uploaded
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{ docLabel: string; folder: string } | null>(null)

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!user) return
    setLoadingTx(true)
    try {
      const res = await fetch('/api/compliance/transactions')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setTransactions(data.transactions || [])
      setUserRole(data.role || 'agent')
    } catch (err) {
      console.error('Failed to load transactions:', err)
    } finally {
      setLoadingTx(false)
    }
  }, [user])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  // Load checklist for a transaction
  const loadChecklist = useCallback(async (txId: string) => {
    setLoadingChecklist(true)
    try {
      const res = await fetch(`/api/compliance/checklist?transaction_id=${txId}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setSelectedTx(data.transaction)
      setFolders(data.folders || [])
      setStats(data.stats)
      setUserRole(data.role || 'agent')
      // Expand all folders by default
      setExpandedFolders(new Set((data.folders || []).map((f: any) => f.id)))
    } catch (err) {
      console.error('Failed to load checklist:', err)
    } finally {
      setLoadingChecklist(false)
    }
  }, [])

  // Toggle folder
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  // Upload handler
  const handleUploadClick = (docLabel: string, folder: string) => {
    setPendingUpload({ docLabel, folder })
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUpload || !selectedTx) return

    setUploading(pendingUpload.docLabel)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('transaction_id', selectedTx.id)
      formData.append('doc_label', pendingUpload.docLabel)
      formData.append('folder', pendingUpload.folder)

      const res = await fetch('/api/compliance/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }

      // Reload checklist
      await loadChecklist(selectedTx.id)
    } catch (err: any) {
      alert(err.message || 'Failed to upload document')
    } finally {
      setUploading(null)
      setPendingUpload(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Broker review
  const handleReview = async (documentId: string, action: 'approve' | 'reject') => {
    if (!selectedTx) return
    try {
      const res = await fetch('/api/compliance/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId, action }),
      })
      if (!res.ok) throw new Error('Review failed')
      await loadChecklist(selectedTx.id)
    } catch (err) {
      alert('Failed to review document')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      approved: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, label: 'Approved' },
      uploaded: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: Clock, label: 'Pending Review' },
      rejected: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Rejected' },
      missing: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', icon: AlertCircle, label: 'Not Uploaded' },
    }
    const c = config[status] || config.missing
    const Icon = c.icon
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {c.label}
      </span>
    )
  }

  // Requirement badge
  const RequirementBadge = ({ required }: { required: boolean }) => (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
      required ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-600'
    }`}>
      {required ? 'Required' : 'Optional'}
    </span>
  )

  // Progress bar
  const ProgressBar = ({ value, max }: { value: number; max: number }) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 font-medium w-16 text-right">
          {value} / {max}
        </span>
      </div>
    )
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const typeLabels: Record<string, string> = {
    buyer: 'Buyer', seller: 'Seller', lease: 'Lease',
    referral: 'Referral', wholesale: 'Wholesale', double_close: 'Double Close',
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    submitted: 'bg-blue-100 text-blue-700',
    pending_review: 'bg-amber-100 text-amber-700',
    revisions_required: 'bg-red-100 text-red-700',
    approved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-purple-100 text-purple-700',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  // Filtered transactions
  const filtered = transactions.filter(tx => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!tx.property_address?.toLowerCase().includes(q) &&
          !tx.client_name?.toLowerCase().includes(q) &&
          !tx.agent_name?.toLowerCase().includes(q)) return false
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'incomplete' && tx.compliance.progress >= 100) return false
      if (filterStatus === 'complete' && tx.compliance.progress < 100) return false
    }
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <SidebarNav onSignOut={handleSignOut} userName={user?.user_metadata?.full_name} role={role} />
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff" onChange={handleFileSelect} />

      <div className="flex-1 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {selectedTx ? (
            <button onClick={() => { setSelectedTx(null); setFolders([]); setStats(null) }}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-3">
              <ArrowLeft className="w-4 h-4" /> Back to Transactions
            </button>
          ) : null}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Compliance Checker
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {selectedTx
                  ? `${selectedTx.property_address}, ${selectedTx.city}`
                  : userRole === 'agent'
                    ? 'Track and upload required documents for your transactions'
                    : 'Review agent compliance documents across all transactions'}
              </p>
            </div>
          </div>
        </div>

        {/* TRANSACTION LIST VIEW */}
        {!selectedTx && (
          <>
            {/* Search + Filter */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by address, client, or agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
              >
                <option value="all">All Transactions</option>
                <option value="incomplete">Incomplete Docs</option>
                <option value="complete">Complete</option>
              </select>
            </div>

            {loadingTx ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-lg font-medium text-gray-500">No transactions found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {transactions.length === 0
                    ? 'Create a transaction in the Vault to get started'
                    : 'Try adjusting your search or filter'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(tx => (
                  <button
                    key={tx.id}
                    onClick={() => loadChecklist(tx.id)}
                    className="w-full bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {tx.property_address}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${statusColors[tx.status] || 'bg-gray-100 text-gray-600'}`}>
                            {tx.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{tx.client_name || 'No client'}</span>
                          <span className="text-gray-300">|</span>
                          <span>{typeLabels[tx.type] || tx.type}</span>
                          {tx.contract_price > 0 && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span>{formatCurrency(tx.contract_price)}</span>
                            </>
                          )}
                          {tx.closing_date && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span>Close: {formatDate(tx.closing_date)}</span>
                            </>
                          )}
                          {userRole !== 'agent' && tx.agent_name && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="font-medium">{tx.agent_name}</span>
                            </>
                          )}
                        </div>
                        <div className="mt-3 max-w-md">
                          <ProgressBar value={tx.compliance.uploaded} max={tx.compliance.required_docs} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            tx.compliance.progress >= 100 ? 'text-emerald-600'
                            : tx.compliance.progress >= 50 ? 'text-blue-600'
                            : 'text-amber-600'
                          }`}>
                            {tx.compliance.progress}%
                          </p>
                          <p className="text-[11px] text-gray-400 font-medium">
                            {tx.compliance.approved} approved
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* TRANSACTION DETAIL / CHECKLIST VIEW */}
        {selectedTx && (
          <>
            {loadingChecklist ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <>
                {/* Transaction Info Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selectedTx.property_address}</h2>
                      <p className="text-sm text-gray-500">{selectedTx.city}, {selectedTx.state}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${statusColors[selectedTx.status] || 'bg-gray-100 text-gray-600'}`}>
                          {selectedTx.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span className="text-gray-500">{typeLabels[selectedTx.type] || selectedTx.type}</span>
                        <span className="text-gray-500">Client: <strong>{selectedTx.client_name}</strong></span>
                        {selectedTx.contract_price > 0 && (
                          <span className="text-gray-500">{formatCurrency(selectedTx.contract_price)}</span>
                        )}
                      </div>
                    </div>
                    {stats && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          <span className="font-bold text-gray-900">{stats.uploaded}</span> of{' '}
                          <span className="font-bold text-gray-900">{stats.total_required}</span> required docs uploaded
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {stats.approved} approved
                          </span>
                          {stats.rejected > 0 && (
                            <span className="flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 text-red-500" /> {stats.rejected} rejected
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-gray-400" /> {stats.missing} missing
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Document Folders */}
                <div className="space-y-3">
                  {folders.map(folder => {
                    const isExpanded = expandedFolders.has(folder.id)
                    const folderComplete = folder.stats.required > 0
                      ? folder.stats.uploaded >= folder.stats.required
                      : folder.stats.uploaded > 0

                    return (
                      <div key={folder.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {/* Folder Header */}
                        <button
                          onClick={() => toggleFolder(folder.id)}
                          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-3">
                            <FolderOpen className={`w-5 h-5 ${folderComplete ? 'text-emerald-500' : 'text-gray-400'}`} />
                            <span className="font-semibold text-gray-900">{folder.label}</span>
                            {folderComplete && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                              {folder.stats.uploaded} of {folder.stats.total} uploaded
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Folder Items */}
                        {isExpanded && (
                          <div className="border-t border-gray-100">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-4 px-5 py-2.5 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                              <div className="col-span-1">Status</div>
                              <div className="col-span-2">Requirement</div>
                              <div className="col-span-4">Document</div>
                              <div className="col-span-2">Date</div>
                              <div className="col-span-3 text-right">Actions</div>
                            </div>

                            {folder.items.map((item, idx) => (
                              <div
                                key={item.requirement_id || idx}
                                className={`grid grid-cols-12 gap-4 px-5 py-3.5 items-center border-t border-gray-100 ${
                                  item.status === 'missing' && item.is_required ? 'bg-red-50/30' : ''
                                }`}
                              >
                                <div className="col-span-1">
                                  <StatusBadge status={item.status} />
                                </div>
                                <div className="col-span-2">
                                  <RequirementBadge required={item.is_required} />
                                </div>
                                <div className="col-span-4">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {item.doc_label}
                                    </span>
                                  </div>
                                  {item.document && (
                                    <p className="text-[11px] text-gray-400 mt-0.5 ml-6">
                                      {(item.document.file_size / 1024).toFixed(0)} KB
                                    </p>
                                  )}
                                </div>
                                <div className="col-span-2 text-xs text-gray-500">
                                  {item.document?.upload_date
                                    ? formatDate(item.document.upload_date)
                                    : '--'}
                                </div>
                                <div className="col-span-3 flex items-center justify-end gap-2">
                                  {/* Upload button */}
                                  {(item.status === 'missing' || item.status === 'rejected') && (
                                    <button
                                      onClick={() => handleUploadClick(item.doc_label, item.folder)}
                                      disabled={uploading === item.doc_label}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      {uploading === item.doc_label ? 'Uploading...' : 'Upload'}
                                    </button>
                                  )}
                                  {/* Replace button for uploaded docs */}
                                  {item.status === 'uploaded' && (
                                    <button
                                      onClick={() => handleUploadClick(item.doc_label, item.folder)}
                                      disabled={uploading === item.doc_label}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      Replace
                                    </button>
                                  )}
                                  {/* Broker approve/reject */}
                                  {item.document && item.status === 'uploaded' && ['broker', 'admin'].includes(userRole) && (
                                    <>
                                      <button
                                        onClick={() => handleReview(item.document!.id, 'approve')}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                      </button>
                                      <button
                                        onClick={() => handleReview(item.document!.id, 'reject')}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 transition"
                                      >
                                        <XCircle className="w-3.5 h-3.5" /> Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Empty state */}
                {folders.length === 0 && !loadingChecklist && (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-lg font-medium text-gray-500">No document requirements found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      This transaction type may not have compliance requirements configured yet.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
