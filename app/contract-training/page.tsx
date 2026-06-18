'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import { authFetch } from '@/lib/supabase'
import {
  BookOpen,
  Search,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Tag,
  Calendar,
  User,
  Hash,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface TrainingDocument {
  id: string
  title: string
  description: string | null
  category: string
  form_number: string | null
  file_url: string | null
  file_name: string | null
  status: 'active' | 'draft' | 'archived'
  version: string | null
  tags: string[]
  author: string | null
  revision_date: string | null
  created_at: string
  updated_at: string
}

interface Category {
  category: string
  count: number
}

// ============================================================================
// Component
// ============================================================================

export default function ContractTrainingPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  const [documents, setDocuments] = useState<TrainingDocument[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Auth redirect
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await authFetch('/api/broker/contract-training/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }, [])

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setDataLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const qs = params.toString()

      const res = await authFetch(`/api/broker/contract-training${qs ? `?${qs}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        // Filter out archived documents on the client side as well
        const docs = (data.documents || []).filter(
          (d: TrainingDocument) => d.status !== 'archived'
        )
        setDocuments(docs)
      } else {
        console.error('Failed to fetch documents:', res.status)
        setDocuments([])
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err)
      setDocuments([])
    } finally {
      setDataLoading(false)
    }
  }, [selectedCategory, debouncedSearch])

  useEffect(() => {
    if (user) {
      fetchCategories()
    }
  }, [user, fetchCategories])

  useEffect(() => {
    if (user) {
      fetchDocuments()
    }
  }, [user, fetchDocuments])

  // Helpers
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function truncate(text: string | null, maxLen: number): string {
    if (!text) return ''
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  // Total document count across all non-archived
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060611] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-[#060611]">
      <SidebarNav onSignOut={signOut} userName={user.email || ''} role={role || ''} />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#C9A84C]/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-[#C9A84C]" />
            </div>
            <h1 className="text-2xl font-bold text-white">Contract Training Center</h1>
          </div>
          <p className="text-gray-400 ml-[52px]">
            Access HartFelt-approved contract guides, checklists, forms, and transaction resources.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a1a] border border-[#1a1a2e] rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#C9A84C] text-black'
                  : 'bg-[#0a0a1a] text-gray-400 border border-[#1a1a2e] hover:border-[#C9A84C]/30 hover:text-white'
              }`}
            >
              All ({totalCount})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.category
                    ? 'bg-[#C9A84C] text-black'
                    : 'bg-[#0a0a1a] text-gray-400 border border-[#1a1a2e] hover:border-[#C9A84C]/30 hover:text-white'
                }`}
              >
                {cat.category} ({cat.count})
              </button>
            ))}
          </div>
        </div>

        {/* Document Grid */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">No training documents available in this category.</p>
            {debouncedSearch && (
              <p className="text-gray-500 text-sm mt-2">
                Try adjusting your search or selecting a different category.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-[#0a0a1a] border border-[#1a1a2e] rounded-xl p-5 hover:border-[#C9A84C]/20 transition-all duration-200 flex flex-col"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-white font-semibold text-sm leading-tight flex-1">
                    {doc.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${getStatusColor(
                      doc.status
                    )}`}
                  >
                    {doc.status}
                  </span>
                </div>

                {/* Form Number + Category */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {doc.form_number && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded text-xs font-medium">
                      <Hash className="w-3 h-3" />
                      {doc.form_number}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
                    {doc.category}
                  </span>
                </div>

                {/* Description */}
                {doc.description && (
                  <p className="text-gray-400 text-xs leading-relaxed mb-3 flex-1">
                    {truncate(doc.description, 140)}
                  </p>
                )}
                {!doc.description && <div className="flex-1" />}

                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1a1a2e] text-gray-400 rounded text-[10px]"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-4">
                  {doc.version && (
                    <span className="flex items-center gap-1">
                      v{doc.version}
                    </span>
                  )}
                  {doc.revision_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(doc.revision_date)}
                    </span>
                  )}
                  {doc.author && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {doc.author}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-[#1a1a2e]">
                  {doc.file_url && (
                    <>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg text-xs font-medium hover:bg-[#C9A84C]/20 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View PDF
                      </a>
                      <a
                        href={doc.file_url}
                        download={doc.file_name || doc.title}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-[#0a0a1a] border border-[#1a1a2e] text-gray-400 rounded-lg text-xs font-medium hover:text-white hover:border-gray-600 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </>
                  )}
                  {!doc.file_url && (
                    <span className="flex-1 text-center text-gray-600 text-xs py-2">
                      No file attached
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
