'use client'

import { useEffect, useState } from 'react'
import { Upload, AlertCircle, CheckCircle } from 'lucide-react'

interface DocumentUploadFormProps {
  transactionId: string
  userId: string
  userRole: string
  onDocumentUploaded?: () => void
}

export default function DocumentUploadForm({
  transactionId,
  userId,
  userRole,
  onDocumentUploaded,
}: DocumentUploadFormProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('contract')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const docTypeOptions = [
    { value: 'contract', label: 'Contract' },
    { value: 'disclosure', label: 'Disclosure' },
    { value: 'inspection', label: 'Inspection Report' },
    { value: 'appraisal', label: 'Appraisal' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'title', label: 'Title Document' },
    { value: 'other', label: 'Other' },
  ]

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      setFile(files[0])
      setError(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setFile(files[0])
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!file) {
      setError('Please select a file to upload')
      return
    }

    if (!docType) {
      setError('Please select a document type')
      return
    }

    try {
      setUploading(true)
      setError(null)
      setSuccess(null)
      setUploadProgress(0)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_type', docType)
      formData.append('transaction_id', transactionId)

      const response = await fetch('/api/broker/tc/documents/upload', {
        method: 'POST',
        headers: {
          'X-User-ID': userId,
          'X-User-Role': userRole,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload document')
      }

      const responseData = await response.json()
      setSuccess(`Document "${file.name}" uploaded successfully!`)
      setFile(null)
      setDocType('contract')
      setUploadProgress(0)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 3000)

      // Call callback to refresh parent component
      if (onDocumentUploaded) {
        onDocumentUploaded()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document')
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Upload Document</h3>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Document Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Type
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            disabled={uploading}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
          >
            {docTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Drag and Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
            isDragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-green-600' : 'text-gray-400'}`} />
          <p className="text-sm font-medium text-gray-900 mb-1">
            Drag and drop your file here
          </p>
          <p className="text-xs text-gray-600 mb-4">or click to select a file</p>

          <input
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
            id="file-input"
          />
          <label
            htmlFor="file-input"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition cursor-pointer disabled:bg-gray-400"
          >
            Select File
          </label>
        </div>

        {/* File Preview */}
        {file && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">Selected file:</p>
            <p className="text-sm text-blue-700 break-all">
              {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && uploadProgress > 0 && (
          <div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2 text-center">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </form>
    </div>
  )
}
