'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { Folder, FileText, Download } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'

export default function DocumentsPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [documents, setDocuments] = useState<Record<string, any[]>>({})
  const [docsLoading, setDocsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fallback documents if Vault has no documents yet
  const defaultDocuments = {
    'Listing Agreements': ['Master Listing Agreement', 'Exclusive Listing Agreement', 'Open Listing Agreement'],
    'Buyer Documents': ['Buyer Representation Agreement', 'Buyer Disclosure', 'Agency Disclosure'],
    'Offer & Contract': ['Purchase Agreement', 'Counter Offer Form', 'Addendum Templates'],
    'Closing Documents': ['Closing Checklist', 'Title Requirements', 'Final Walk-Through Form'],
  }

  useEffect(() => {
    if (user) {
      fetchDocuments()
    }
  }, [user])

  const fetchDocuments = async () => {
    try {
      setDocsLoading(true)
      const result = await vaultAPI.documents.list(user!.id, role)

      // Group documents by category if they have one
      if (result.documents && Array.isArray(result.documents)) {
        const grouped: Record<string, any[]> = {}
        result.documents.forEach((doc: any) => {
          const category = doc.category || 'Other Documents'
          if (!grouped[category]) {
            grouped[category] = []
          }
          grouped[category].push(doc)
        })
        setDocuments(grouped)
      } else {
        // Use default documents if API returns empty
        setDocuments(defaultDocuments)
      }
    } catch (err) {
      // Fall back to default documents on error
      setDocuments(defaultDocuments)
      setError(`Note: Using default templates. ${err instanceof Error ? err.message : ''}`)
    } finally {
      setDocsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Contracts & Documents</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {error && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">{error}</p>
          </div>
        )}

        {docsLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600">Loading documents...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {Object.entries(documents).map(([category, docs]) => (
              <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-blue-600" />
                    {category}
                  </h3>
                </div>
                <ul className="divide-y">
                  {docs.map((doc: any) => (
                    <li
                      key={doc.id || doc.name}
                      className="p-4 hover:bg-blue-50 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-gray-900 group-hover:text-blue-600 cursor-pointer font-medium">
                            {doc.name || doc}
                          </p>
                          {doc.size && (
                            <p className="text-xs text-gray-600">{(doc.size / 1024).toFixed(2)} KB</p>
                          )}
                        </div>
                      </div>
                      <Download className="w-5 h-5 text-gray-400 group-hover:text-blue-600 cursor-pointer opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Florida Realtors Forms Section */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Florida Realtors Forms Library</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-8">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Access Florida Realtors Official Forms</h3>
                  <p className="text-gray-600 mb-4">
                    Browse and download all official Florida Realtors forms and contracts. Keep your documents up-to-date with the latest state requirements.
                  </p>
                  <a
                    href="https://forms.floridarealtors.org/formslibrary/formslibrary"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    <FileText className="w-5 h-5" />
                    Go to Forms Library
                  </a>
                </div>
                <Folder className="w-16 h-16 text-blue-300 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
