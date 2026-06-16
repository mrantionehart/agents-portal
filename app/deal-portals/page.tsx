'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import { authFetch } from '@/lib/supabase'
import {
  Share2,
  ExternalLink,
  Copy,
  Eye,
  Clock,
  Loader2,
  CheckCircle2,
  User,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface DealPortal {
  id: string
  title: string
  status: string
  access_token: string
  share_url?: string
  view_count: number
  last_viewed_at: string | null
  created_at: string
  client_name: string | null
}

// ============================================================================
// Component
// ============================================================================

export default function DealPortalsPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  const [portals, setPortals] = useState<DealPortal[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Auth redirect
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Fetch portals
  const fetchPortals = useCallback(async () => {
    setDataLoading(true)
    try {
      const res = await authFetch('/api/broker/deal-portals/advisor')
      if (!res.ok) throw new Error('Failed to load portals')
      const data = await res.json()
      setPortals(data.portals || [])
    } catch (err) {
      console.error('Deal portals fetch error:', err)
      showToast('Failed to load deal portals', 'error')
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchPortals()
  }, [user, fetchPortals])

  // Helpers
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function getShareUrl(portal: DealPortal): string {
    if (portal.share_url) return portal.share_url
    // Fallback: construct URL from access_token
    return `https://hartfelt-vault.vercel.app/portal/${portal.access_token}`
  }

  async function copyLink(portal: DealPortal) {
    try {
      await navigator.clipboard.writeText(getShareUrl(portal))
      setCopiedId(portal.id)
      showToast('Link copied to clipboard!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showToast('Failed to copy link', 'error')
    }
  }

  function openPortal(portal: DealPortal) {
    window.open(getShareUrl(portal), '_blank')
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function timeAgo(dateStr: string): string {
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}d ago`
    return formatDate(dateStr)
  }

  if (loading || !user) return null

  return (
    <div className="flex h-screen bg-[#060611]">
      <SidebarNav onSignOut={signOut} userName={user?.email || ''} role={role || undefined} />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Deal Portals</h1>
                <p className="text-sm text-gray-400">Share curated property portals with your clients.</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Portals</p>
              <p className="text-2xl font-bold text-white">{portals.length}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Views</p>
              <p className="text-2xl font-bold text-[#C9A84C]">{portals.reduce((sum, p) => sum + (p.view_count || 0), 0)}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active</p>
              <p className="text-2xl font-bold text-emerald-400">{portals.filter(p => p.status === 'active').length}</p>
            </div>
          </div>

          {/* Loading */}
          {dataLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
              <span className="ml-3 text-gray-400 text-sm">Loading portals...</span>
            </div>
          )}

          {/* Empty state */}
          {!dataLoading && portals.length === 0 && (
            <div className="text-center py-20">
              <Share2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No deal portals yet</h3>
              <p className="text-sm text-gray-500">
                Create a deal portal from a client&apos;s profile in Client Intelligence.
              </p>
            </div>
          )}

          {/* Portal cards */}
          {!dataLoading && portals.length > 0 && (
            <div className="space-y-3">
              {portals.map(portal => (
                <div
                  key={portal.id}
                  className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-5 hover:border-[#C9A84C]/30 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white mb-1 truncate">{portal.title}</h3>

                      <div className="flex items-center gap-4 flex-wrap mt-2">
                        {/* Client name */}
                        {portal.client_name && (
                          <span className="flex items-center gap-1.5 text-xs text-gray-400">
                            <User className="w-3 h-3" />
                            {portal.client_name}
                          </span>
                        )}

                        {/* Created date */}
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatDate(portal.created_at)}
                        </span>

                        {/* View count */}
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Eye className="w-3 h-3" />
                          {portal.view_count || 0} {portal.view_count === 1 ? 'view' : 'views'}
                        </span>

                        {/* Last viewed */}
                        {portal.last_viewed_at && (
                          <span className="text-[10px] text-gray-600">
                            Last viewed {timeAgo(portal.last_viewed_at)}
                          </span>
                        )}

                        {/* Status badge */}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          portal.status === 'active'
                            ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                            : 'bg-gray-400/10 text-gray-400 border-gray-400/20'
                        }`}>
                          {portal.status || 'active'}
                        </span>
                      </div>

                      {/* Share URL (truncated) */}
                      <p className="text-[10px] text-gray-600 mt-2 truncate font-mono">
                        {getShareUrl(portal)}
                      </p>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => copyLink(portal)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                          copiedId === portal.id
                            ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                            : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#252535] hover:text-white'
                        }`}
                      >
                        {copiedId === portal.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Link
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => openPortal(portal)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
