'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { CheckCircle, Upload, AlertCircle, Bell } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import { createClient } from '@supabase/supabase-js'
import ComplianceNotifications from '../components/compliance-notifications'

export default function CompliancePage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [deals, setDeals] = useState<any[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)
  const [supabase, setSupabase] = useState<any>(null)
  const [brokers, setBrokers] = useState<any[]>([])

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey)
      setSupabase(client)
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadDeals()
      // Load broker list for admin users
      if (role === 'broker' || role === 'admin') {
        loadBrokersList()
      }
    }
  }, [user])

  const loadDeals = async () => {
    try {
      setDealsLoading(true)
      const result = await vaultAPI.deals.list(user!.id, role)
      const dealsArray = result.deals || result.data || []
      setDeals(Array.isArray(dealsArray) ? dealsArray : [])
    } catch (err) {
      console.error('Error loading deals:', err)
      setError(`Failed to load deals: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDealsLoading(false)
    }
  }

  const loadBrokersList = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'broker')
        .limit(10)

      if (data) {
        setBrokers(data)
      }
    } catch (err) {
      console.error('Error loading brokers:', err)
    }
  }

  const createNotification = async (
    recipientUserId: string,
    type: 'submission' | 'approval' | 'rejection' | 'review_pending' | 'revision_needed',
    title: string,
    message: string,
    dealId?: string,
    documentId?: string
  ) => {
    if (!supabase) return

    try {
      await supabase.from('compliance_notifications').insert({
        user_id: recipientUserId,
        type,
        title,
        message,
        deal_id: dealId,
        document_id: documentId,
        read: false
      })
    } catch (err) {
      console.error('Error creating notification:', err)
    }
  }

  const notifyBrokersOfSubmission = async (dealId: string, documentName: string, agentName: string) => {
    // Notify all brokers of new compliance submission
    for (const broker of brokers) {
      await createNotification(
        broker.id,
        'review_pending',
        'New Compliance Document',
        `Agent ${agentName} submitted: ${documentName}`,
        dealId,
        documentName
      )
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files))
      setError(null)
    }
  }

  const handleUploadAndAnalyze = async () => {
    if (!user || !selectedStage || !selectedDeal || uploadedFiles.length === 0) {
      setError('Please select a deal, stage, and upload documents')
      return
    }

    try {
      setIsUploading(true)
      setError(null)

      // For each file, analyze and upload
      for (const file of uploadedFiles) {
        // Analyze document with AI
        const analysis = await vaultAPI.ai.analyzeDocument(file, user.id, role)
        setAnalysisResult(analysis)

        // Upload document to Vault with deal ID and stage
        await vaultAPI.documents.upload(file, selectedDeal, user.id, selectedStage, role)
      }

      // Create notification for brokers that new compliance documents were submitted
      if (brokers.length > 0) {
        const deal = deals.find(d => d.id === selectedDeal)
        const agentName = user?.user_metadata?.name || user?.email || 'Agent'
        await notifyBrokersOfSubmission(selectedDeal, uploadedFiles[0]?.name || 'Compliance Documents', agentName)
      }

      // Create notification for agent that documents were submitted
      await createNotification(
        user!.id,
        'submission',
        'Compliance Documents Submitted',
        `Your ${selectedStage} stage documents have been submitted for review`,
        selectedDeal
      )

      setUploadedFiles([])
      // Optionally reset after successful upload
      setTimeout(() => {
        setAnalysisResult(null)
      }, 5000)
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsUploading(false)
    }
  }

  const complianceStages = [
    {
      stage: 'Listing',
      title: 'Listing Compliance',
      description: 'Documents required when an agent takes a listing.',
      documents: ['Listing Agreement', 'Seller Disclosure', 'Property Disclosures'],
    },
    {
      stage: 'Under Contract',
      title: 'Under Contract Compliance',
      description: 'Documents required once a property goes under contract.',
      documents: ['Purchase Agreement', 'Inspection Reports', 'Appraisal'],
    },
    {
      stage: 'Closing',
      title: 'Closing Compliance',
      description: 'Documents required before closing and commission payout.',
      documents: ['Closing Disclosure', 'Title Insurance', 'Final Walk-Through'],
    },
  ]

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Compliance & Commission Approval</h1>
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
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Deal Selection */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Select a Deal</h2>
          {dealsLoading ? (
            <div className="text-center py-8 text-gray-600">Loading deals...</div>
          ) : deals.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => setSelectedDeal(deal.id)}
                  className={`bg-white rounded-lg shadow p-6 cursor-pointer transition ${
                    selectedDeal === deal.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <p className="text-sm text-gray-600 mb-2">Property</p>
                  <h3 className="font-bold text-gray-900 mb-2">{deal.property_address}</h3>
                  <p className="text-sm text-gray-600 mb-4">Type: {deal.type}</p>
                  <p className="text-lg font-semibold text-blue-600">${(deal.contract_price || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No deals found. Start a new transaction to upload compliance documents.</p>
            </div>
          )}
        </div>

        {/* Analysis Result - Enhanced Compliance Display */}
        {analysisResult && (
          <div className={`border-2 rounded-lg p-6 mb-6 ${
            analysisResult.issues && analysisResult.issues.length > 0
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-green-50 border-green-300'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {analysisResult.issues && analysisResult.issues.length > 0 ? (
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`font-bold text-lg mb-2 ${
                  analysisResult.issues && analysisResult.issues.length > 0
                    ? 'text-yellow-900'
                    : 'text-green-900'
                }`}>
                  {analysisResult.issues && analysisResult.issues.length > 0
                    ? '⚠️ Compliance Issues Found'
                    : '✅ Document is Compliant'}
                </h3>

                {analysisResult.issues && analysisResult.issues.length > 0 && (
                  <div className="mt-4">
                    <p className="font-semibold text-yellow-900 mb-3">Please address the following issues before submission:</p>
                    <ul className="space-y-2">
                      {analysisResult.issues.map((issue: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-yellow-600 font-bold mt-0.5">•</span>
                          <span className="text-yellow-800">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!analysisResult.issues || analysisResult.issues.length === 0 && (
                  <p className="text-green-800">All required compliance checks have been passed. You may proceed with submission.</p>
                )}

                {analysisResult.compliance_score && (
                  <div className="mt-4 pt-4 border-t border-opacity-30 border-current">
                    <p className="text-sm font-medium mb-2">Compliance Score</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-white rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition ${
                            analysisResult.compliance_score >= 80
                              ? 'bg-green-600'
                              : analysisResult.compliance_score >= 60
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${analysisResult.compliance_score}%` }}
                        />
                      </div>
                      <span className={`font-bold text-lg ${
                        analysisResult.compliance_score >= 80
                          ? 'text-green-600'
                          : analysisResult.compliance_score >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {analysisResult.compliance_score}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compliance Stages */}
        {selectedDeal ? (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Transaction Stage</h2>
            <div className="grid grid-cols-3 gap-6">
              {complianceStages.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedStage(item.stage)}
                  className={`bg-white rounded-lg shadow p-8 cursor-pointer transition ${
                    selectedStage === item.stage ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                >
              <div className="text-sm text-gray-600 font-medium mb-2 uppercase">{item.stage}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
              <p className="text-gray-600 mb-6">{item.description}</p>

              <div className="mb-6 space-y-2">
                {item.documents.map((doc) => (
                  <div key={doc} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700">{doc}</span>
                  </div>
                ))}
              </div>

              <div className={`py-2 rounded-lg text-center font-medium transition ${
                selectedStage === item.stage
                  ? 'bg-blue-600 text-white'
                  : 'border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
              }`}>
                {selectedStage === item.stage ? '✓ Selected' : 'Select Stage'}
              </div>
            </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-12 text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Select a deal above to continue</p>
          </div>
        )}

        {/* Commission Policy */}
        <div className="bg-gray-900 text-white rounded-lg p-6 mb-12 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-2">Commission Policy</p>
            <p className="text-gray-300">
              Commission will only be paid once all required transaction documents have been uploaded and approved by the compliance admin.
            </p>
          </div>
        </div>

        {/* Document Upload Section */}
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Upload Documents</h2>

          {!selectedStage ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Select a transaction stage above to upload documents</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Input */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input"
                  disabled={isUploading}
                />
                <label
                  htmlFor="file-input"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Upload className="w-10 h-10 text-gray-400 mb-3" />
                  <span className="text-lg font-medium text-gray-900">Click to upload or drag and drop</span>
                  <span className="text-sm text-gray-600 mt-1">PDF, DOC, DOCX, PNG, JPG</span>
                </label>
              </div>

              {/* Selected Files */}
              {uploadedFiles.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-3">Selected Files:</p>
                  <ul className="space-y-2">
                    {uploadedFiles.map((file) => (
                      <li key={file.name} className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleUploadAndAnalyze}
                disabled={isUploading || uploadedFiles.length === 0}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-blue-300"
              >
                {isUploading ? 'Analyzing & Uploading...' : 'Analyze & Upload Documents'}
              </button>
            </div>
          )}
        </div>

        {/* Process Steps */}
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Process Overview</h2>

          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Select Transaction Stage</h3>
                <p className="text-gray-600">Choose the transaction stage (Listing, Under Contract, or Closing).</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Upload Documents</h3>
                <p className="text-gray-600">Upload all required documents. AI will analyze them for completeness and compliance.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">AI Analysis</h3>
                <p className="text-gray-600">Documents are analyzed for missing information, signatures, and compliance requirements.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Compliance Review</h3>
                <p className="text-gray-600">Our compliance team reviews AI findings and approves or requests corrections.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">5</div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Commission Approval</h3>
                <p className="text-gray-600">Once approved, your commission is calculated and scheduled for payment.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
