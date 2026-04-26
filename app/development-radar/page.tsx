'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Radar, Search, Filter, ChevronDown, ChevronLeft, ChevronRight,
  Bookmark, BookmarkCheck, Share2, ExternalLink, Eye, Building2,
  TrendingUp, MapPin, Calendar, DollarSign, Users, ArrowUpDown,
  Loader2, AlertCircle, Sparkles, Trophy, BarChart3, X,
  BadgeDollarSign, Target, ClipboardCheck, CheckCircle2, Mail,
  FileText, Layers, Link2, BellPlus, UserCheck, Percent, Zap
} from 'lucide-react'

const VAULT_API = 'https://hartfelt-vault.vercel.app/api'

const STATUSES = ['Proposed', 'Approved', 'Under Construction', 'Pre-Sales', 'Completed'] as const
const ASSET_TYPES = ['Condo', 'Apartment', 'Townhome', 'Mixed Use', 'Retail', 'Industrial', 'Luxury SFH'] as const

type Tab = 'Feed' | 'Saved' | 'Developers' | 'City Rankings' | 'Pre-Sales'
type Status = typeof STATUSES[number]

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Proposed': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'Approved': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'Under Construction': { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  'Pre-Sales': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'Completed': { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getUserId(): string {
  if (typeof window === 'undefined') return 'anon'
  try {
    const stored = localStorage.getItem('hf_dev_radar_uid')
    if (stored) return stored
  } catch {}
  const uid = 'agent_' + Math.random().toString(36).slice(2, 10)
  try { localStorage.setItem('hf_dev_radar_uid', uid) } catch {}
  return uid
}

function formatCurrency(val: number | string | undefined | null): string {
  if (!val) return '--'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '--'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`
  return `$${num.toLocaleString()}`
}

function formatNumber(val: number | string | undefined | null): string {
  if (!val) return '--'
  const num = typeof val === 'string' ? parseInt(val) : val
  return isNaN(num) ? '--' : num.toLocaleString()
}

// ── Opportunity Score Ring ────────────────────────────────────────────────

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#C9A84C' : score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1a1a2e" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: 'bg-zinc-500/20', text: 'text-zinc-400' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${c.bg} ${c.text}`}>
      {status}
    </span>
  )
}

function AssetBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
      {type}
    </span>
  )
}

// ── Interfaces ───────────────────────────────────────────────────────────

interface Development {
  id: string
  project_name: string
  developer?: string
  city?: string
  county?: string
  status?: string
  asset_type?: string
  units?: number
  opportunity_score?: number
  estimated_value?: number
  estimated_completion?: string
  ai_summary?: string
  source_url?: string
  created_at?: string
}

interface DevStats {
  total_developments?: number
  total_units?: number
  total_estimated_value?: number
  avg_opportunity_score?: number
  active_developers?: number
}

interface Developer {
  developer: string
  project_count?: number
  total_units?: number
  avg_score?: number
}

interface CityRanking {
  city: string
  county?: string
  project_count?: number
  total_units?: number
  avg_score?: number
  total_value?: number
}

// ── Main Component ───────────────────────────────────────────────────────

export default function DevelopmentRadarPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Feed')
  const [userId] = useState(getUserId)

  // Stats
  const [stats, setStats] = useState<DevStats>({})
  const [statsLoading, setStatsLoading] = useState(true)

  // Feed
  const [developments, setDevelopments] = useState<Development[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedSearch, setFeedSearch] = useState('')
  const [feedStatus, setFeedStatus] = useState<string>('')
  const [feedAssetType, setFeedAssetType] = useState<string>('')
  const [feedSort, setFeedSort] = useState('opportunity_score')
  const [feedOrder, setFeedOrder] = useState<'desc' | 'asc'>('desc')
  const [feedPage, setFeedPage] = useState(1)
  const [feedTotal, setFeedTotal] = useState(0)
  const FEED_LIMIT = 20

  // Saved
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedDevelopments, setSavedDevelopments] = useState<Development[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedSort, setSavedSort] = useState<'date' | 'score'>('date')

  // Developers
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [devSearch, setDevSearch] = useState('')
  const [devLoading, setDevLoading] = useState(false)

  // City Rankings
  const [cityRankings, setCityRankings] = useState<CityRanking[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)

  // Pre-Sales
  const [presales, setPresales] = useState<any[]>([])
  const [presalesLoading, setPresalesLoading] = useState(false)
  const [presaleAlerts, setPresaleAlerts] = useState<any[]>([])
  const [presaleUnread, setPresaleUnread] = useState(0)
  const [presaleMatches, setPresaleMatches] = useState<any[]>([])
  const [matchingDevId, setMatchingDevId] = useState<string | null>(null)
  const [selectedPresale, setSelectedPresale] = useState<any>(null)

  // Toasts
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Fetch Stats ──────────────────────────────────────────────────────

  useEffect(() => {
    setStatsLoading(true)
    fetch(`${VAULT_API}/development-radar/stats`, { headers: { 'Content-Type': 'application/json' } })
      .then(r => r.json())
      .then(d => setStats(d?.data || d || {}))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  // ── Fetch Feed ───────────────────────────────────────────────────────

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true)
    const params = new URLSearchParams()
    if (feedSearch) params.set('search', feedSearch)
    if (feedStatus) params.set('status', feedStatus)
    if (feedAssetType) params.set('asset_type', feedAssetType)
    params.set('sort', feedSort)
    params.set('order', feedOrder)
    params.set('page', String(feedPage))
    params.set('limit', String(FEED_LIMIT))
    try {
      const r = await fetch(`${VAULT_API}/development-radar?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      const d = await r.json()
      setDevelopments(d?.data || d?.developments || [])
      setFeedTotal(d?.total || d?.count || 0)
    } catch { setDevelopments([]) }
    setFeedLoading(false)
  }, [feedSearch, feedStatus, feedAssetType, feedSort, feedOrder, feedPage])

  useEffect(() => { fetchFeed() }, [fetchFeed])

  // ── Fetch Saved ──────────────────────────────────────────────────────

  const fetchSaved = useCallback(async () => {
    setSavedLoading(true)
    try {
      const r = await fetch(`${VAULT_API}/development-radar/saves`, {
        headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
      })
      const d = await r.json()
      const items = d?.data || d?.saves || []
      setSavedDevelopments(items)
      setSavedIds(new Set(items.map((i: any) => i.id || i.development_id)))
    } catch {
      setSavedDevelopments([])
      setSavedIds(new Set())
    }
    setSavedLoading(false)
  }, [userId])

  useEffect(() => { fetchSaved() }, [fetchSaved])

  // ── Toggle Save ──────────────────────────────────────────────────────

  const toggleSave = async (devId: string) => {
    try {
      await fetch(`${VAULT_API}/development-radar/saves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
        body: JSON.stringify({ development_id: devId }),
      })
      const wasSaved = savedIds.has(devId)
      showToast(wasSaved ? 'Removed from saved' : 'Saved to collection')
      fetchSaved()
    } catch {
      showToast('Failed to update save')
    }
  }

  // ── Fetch Developers ─────────────────────────────────────────────────

  const fetchDevelopers = useCallback(async () => {
    setDevLoading(true)
    const params = new URLSearchParams()
    if (devSearch) params.set('search', devSearch)
    try {
      const r = await fetch(`${VAULT_API}/development-radar/developers?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      const d = await r.json()
      setDevelopers(d?.data || d?.developers || [])
    } catch { setDevelopers([]) }
    setDevLoading(false)
  }, [devSearch])

  useEffect(() => {
    if (activeTab === 'Developers') fetchDevelopers()
  }, [activeTab, fetchDevelopers])

  // ── Fetch City Rankings ──────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'City Rankings') return
    setCitiesLoading(true)
    fetch(`${VAULT_API}/development-radar/stats?group_by=city`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then(r => r.json())
      .then(d => setCityRankings(d?.data || d?.cities || []))
      .catch(() => setCityRankings([]))
      .finally(() => setCitiesLoading(false))
  }, [activeTab])

  // ── Pre-Sales Fetch ──────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'Pre-Sales') return
    fetchPresales()
    fetchPresaleAlerts()
  }, [activeTab])

  async function fetchPresales() {
    setPresalesLoading(true)
    try {
      const res = await fetch(`${VAULT_API}/development-radar/presales`, {
        headers: { 'X-User-ID': userId, 'X-User-Role': 'agent' },
      })
      if (res.ok) {
        const data = await res.json()
        setPresales(data.presales || [])
      }
    } catch (e) { console.error('Presales error:', e) }
    setPresalesLoading(false)
  }

  async function fetchPresaleAlerts() {
    try {
      const res = await fetch(`${VAULT_API}/development-radar/presales/notify?limit=20`, {
        headers: { 'X-User-ID': userId },
      })
      if (res.ok) {
        const data = await res.json()
        setPresaleAlerts(data.alerts || [])
        setPresaleUnread(data.unread_count || 0)
      }
    } catch (e) { console.error('Presale alerts error:', e) }
  }

  async function runMatchEngine(devId: string) {
    setMatchingDevId(devId)
    setSelectedPresale(devId)
    try {
      const res = await fetch(`${VAULT_API}/development-radar/presales/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
        body: JSON.stringify({ development_id: devId }),
      })
      if (res.ok) {
        const data = await res.json()
        setPresaleMatches(data.matches || [])
        showToast(`Found ${data.total_matches || 0} matching contacts`)
      }
    } catch (e) { console.error('Match error:', e) }
    setMatchingDevId(null)
  }

  async function registerForPresale(devId: string) {
    try {
      const res = await fetch(`${VAULT_API}/development-radar/presales/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
        body: JSON.stringify({ development_id: devId }),
      })
      if (res.ok) {
        showToast('Registered successfully!')
        fetchPresales()
      }
    } catch (e) { console.error('Register error:', e) }
  }

  async function markPresaleAlertsRead() {
    try {
      await fetch(`${VAULT_API}/development-radar/presales/notify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
        body: JSON.stringify({ mark_all: true }),
      })
      setPresaleUnread(0)
      setPresaleAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    } catch (e) { console.error('Mark read error:', e) }
  }

  // ── Sorted Saved ─────────────────────────────────────────────────────

  const sortedSaved = useMemo(() => {
    const arr = [...savedDevelopments]
    if (savedSort === 'score') arr.sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0))
    else arr.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    return arr
  }, [savedDevelopments, savedSort])

  const totalPages = Math.max(1, Math.ceil(feedTotal / FEED_LIMIT))

  const handleShare = (dev: Development) => {
    const text = `${dev.project_name} - ${dev.city || ''}, FL | ${dev.status || ''} | ${formatCurrency(dev.estimated_value)}`
    if (navigator.share) {
      navigator.share({ title: dev.project_name, text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'))
    }
  }

  // ── KPI Cards ────────────────────────────────────────────────────────

  const kpiCards = [
    { label: 'Total Developments', value: formatNumber(stats.total_developments), icon: Building2, accent: 'from-blue-500/20 to-blue-600/5' },
    { label: 'Total Units', value: formatNumber(stats.total_units), icon: Users, accent: 'from-emerald-500/20 to-emerald-600/5' },
    { label: 'Est. Pipeline Value', value: formatCurrency(stats.total_estimated_value), icon: DollarSign, accent: 'from-[#C9A84C]/20 to-[#C9A84C]/5' },
    { label: 'Avg Opportunity Score', value: stats.avg_opportunity_score ? Math.round(Number(stats.avg_opportunity_score)).toString() : '--', icon: TrendingUp, accent: 'from-purple-500/20 to-purple-600/5' },
    { label: 'Active Developers', value: formatNumber(stats.active_developers), icon: Sparkles, accent: 'from-amber-500/20 to-amber-600/5' },
  ]

  // ── Development Card ─────────────────────────────────────────────────

  const DevCard = ({ dev }: { dev: Development }) => {
    const isSaved = savedIds.has(dev.id)
    return (
      <div className="group bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl overflow-hidden hover:border-[#C9A84C]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#C9A84C]/5">
        {/* Top gradient bar */}
        <div className="h-0.5 bg-gradient-to-r from-[#C9A84C]/60 via-[#C9A84C]/20 to-transparent" />

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm leading-tight truncate group-hover:text-[#C9A84C] transition-colors">
                {dev.project_name}
              </h3>
              {dev.developer && (
                <p className="text-gray-500 text-xs mt-0.5 truncate">{dev.developer}</p>
              )}
            </div>
            {dev.opportunity_score != null && (
              <ScoreRing score={dev.opportunity_score} size={44} />
            )}
          </div>

          {/* Location */}
          {(dev.city || dev.county) && (
            <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-3">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{[dev.city, dev.county].filter(Boolean).join(', ')}, FL</span>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {dev.status && <StatusBadge status={dev.status} />}
            {dev.asset_type && <AssetBadge type={dev.asset_type} />}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-[#050507] rounded-lg px-2.5 py-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Units</p>
              <p className="text-sm font-semibold text-white mt-0.5">{formatNumber(dev.units)}</p>
            </div>
            <div className="bg-[#050507] rounded-lg px-2.5 py-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Value</p>
              <p className="text-sm font-semibold text-[#C9A84C] mt-0.5">{formatCurrency(dev.estimated_value)}</p>
            </div>
            <div className="bg-[#050507] rounded-lg px-2.5 py-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Complete</p>
              <p className="text-sm font-semibold text-white mt-0.5">
                {dev.estimated_completion ? new Date(dev.estimated_completion).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '--'}
              </p>
            </div>
          </div>

          {/* AI Summary */}
          {dev.ai_summary && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-gradient-to-r from-[#C9A84C]/5 to-transparent border border-[#C9A84C]/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3 h-3 text-[#C9A84C]" />
                <span className="text-[10px] font-medium text-[#C9A84C] uppercase tracking-wider">AI Insight</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{dev.ai_summary}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-[#1a1a2e]">
            <button
              onClick={() => toggleSave(dev.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSaved
                  ? 'bg-[#C9A84C]/15 text-[#C9A84C] hover:bg-[#C9A84C]/25'
                  : 'text-gray-400 hover:bg-[#1a1a2e] hover:text-white'
              }`}
            >
              {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => handleShare(dev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-[#1a1a2e] hover:text-white transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
            {dev.source_url && (
              <a
                href={dev.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-[#1a1a2e] hover:text-white transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Source
              </a>
            )}
            <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all">
              <Eye className="w-3.5 h-3.5" />
              Details
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[#0a0a0f] border border-[#C9A84C]/30 text-[#C9A84C] px-5 py-3 rounded-xl shadow-2xl shadow-[#C9A84C]/10 text-sm font-medium animate-in slide-in-from-top-2 fade-in duration-300">
          {toast}
        </div>
      )}

      {/* ── Premium Header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-[#1a1a2e]">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/5 via-transparent to-blue-600/3" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A84C]/3 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />

        <div className="relative px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#a88a3a] flex items-center justify-center shadow-lg shadow-[#C9A84C]/20">
              <Radar className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#C9A84C] to-[#E8D5A3]">
                Florida Development Radar
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Real-time intelligence on new construction and development projects
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div
                key={kpi.label}
                className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-4 hover:border-[#C9A84C]/20 transition-all duration-300 group"
              >
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${kpi.accent} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <Icon className="w-4.5 h-4.5 text-gray-500 group-hover:text-[#C9A84C] transition-colors" />
                    {statsLoading && <Loader2 className="w-3 h-3 text-gray-600 animate-spin" />}
                  </div>
                  <p className="text-xl font-bold text-white">{statsLoading ? '--' : kpi.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-1.5 w-fit">
          {(['Feed', 'Saved', 'Developers', 'City Rankings', 'Pre-Sales'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-[#C9A84C]/15 text-[#C9A84C] shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a1a2e]/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab Content ───────────────────────────────────────────────── */}

        {/* FEED TAB */}
        {activeTab === 'Feed' && (
          <div className="space-y-5">
            {/* Search & Filters Bar */}
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search developments, developers, cities..."
                  value={feedSearch}
                  onChange={(e) => { setFeedSearch(e.target.value); setFeedPage(1) }}
                  className="w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/40 focus:ring-1 focus:ring-[#C9A84C]/20 transition-all"
                />
                {feedSearch && (
                  <button onClick={() => { setFeedSearch(''); setFeedPage(1) }} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-gray-500 hover:text-white" />
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <select
                  value={feedSort}
                  onChange={(e) => { setFeedSort(e.target.value); setFeedPage(1) }}
                  className="appearance-none bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl pl-9 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/40 cursor-pointer"
                >
                  <option value="opportunity_score">Score</option>
                  <option value="estimated_value">Value</option>
                  <option value="units">Units</option>
                  <option value="created_at">Newest</option>
                  <option value="project_name">Name</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>

              {/* Order toggle */}
              <button
                onClick={() => setFeedOrder(feedOrder === 'desc' ? 'asc' : 'desc')}
                className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:border-[#C9A84C]/30 transition-all"
                title={feedOrder === 'desc' ? 'Descending' : 'Ascending'}
              >
                {feedOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setFeedStatus(''); setFeedPage(1) }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  !feedStatus ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30' : 'text-gray-400 border border-[#1a1a2e] hover:border-gray-600'
                }`}
              >
                All Statuses
              </button>
              {STATUSES.map((s) => {
                const c = STATUS_COLORS[s]
                const active = feedStatus === s
                return (
                  <button
                    key={s}
                    onClick={() => { setFeedStatus(active ? '' : s); setFeedPage(1) }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      active
                        ? `${c.bg} ${c.text} border-current`
                        : 'text-gray-400 border-[#1a1a2e] hover:border-gray-600'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>

            {/* Asset Type Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setFeedAssetType(''); setFeedPage(1) }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  !feedAssetType ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30' : 'text-gray-400 border border-[#1a1a2e] hover:border-gray-600'
                }`}
              >
                All Types
              </button>
              {ASSET_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => { setFeedAssetType(feedAssetType === t ? '' : t); setFeedPage(1) }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    feedAssetType === t
                      ? 'bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30'
                      : 'text-gray-400 border-[#1a1a2e] hover:border-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {feedLoading ? 'Loading...' : `${feedTotal.toLocaleString()} development${feedTotal !== 1 ? 's' : ''} found`}
              </p>
            </div>

            {/* Cards Grid */}
            {feedLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
              </div>
            ) : developments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <AlertCircle className="w-10 h-10 mb-3 text-gray-600" />
                <p className="text-sm font-medium">No developments found</p>
                <p className="text-xs mt-1">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {developments.map((dev) => (
                  <DevCard key={dev.id} dev={dev} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setFeedPage(Math.max(1, feedPage - 1))}
                  disabled={feedPage <= 1}
                  className="p-2 rounded-lg border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-[#C9A84C]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number
                    if (totalPages <= 5) page = i + 1
                    else if (feedPage <= 3) page = i + 1
                    else if (feedPage >= totalPages - 2) page = totalPages - 4 + i
                    else page = feedPage - 2 + i
                    return (
                      <button
                        key={page}
                        onClick={() => setFeedPage(page)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                          feedPage === page
                            ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30'
                            : 'text-gray-400 hover:text-white border border-transparent hover:border-[#1a1a2e]'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setFeedPage(Math.min(totalPages, feedPage + 1))}
                  disabled={feedPage >= totalPages}
                  className="p-2 rounded-lg border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-[#C9A84C]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* SAVED TAB */}
        {activeTab === 'Saved' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                {savedDevelopments.length} saved development{savedDevelopments.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort:</span>
                <button
                  onClick={() => setSavedSort('date')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    savedSort === 'date' ? 'bg-[#C9A84C]/15 text-[#C9A84C]' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Date Saved
                </button>
                <button
                  onClick={() => setSavedSort('score')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    savedSort === 'score' ? 'bg-[#C9A84C]/15 text-[#C9A84C]' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Score
                </button>
              </div>
            </div>

            {savedLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
              </div>
            ) : sortedSaved.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Bookmark className="w-10 h-10 mb-3 text-gray-600" />
                <p className="text-sm font-medium">No saved developments</p>
                <p className="text-xs mt-1">Save developments from the Feed tab to track them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedSaved.map((dev) => (
                  <DevCard key={dev.id} dev={dev} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* DEVELOPERS TAB */}
        {activeTab === 'Developers' && (
          <div className="space-y-5">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search developers..."
                value={devSearch}
                onChange={(e) => setDevSearch(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/40 focus:ring-1 focus:ring-[#C9A84C]/20 transition-all"
              />
            </div>

            {devLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
              </div>
            ) : developers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Building2 className="w-10 h-10 mb-3 text-gray-600" />
                <p className="text-sm font-medium">No developers found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {developers.map((dev, i) => (
                  <div
                    key={dev.developer + i}
                    className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-5 hover:border-[#C9A84C]/30 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C9A84C]/20 to-[#C9A84C]/5 flex items-center justify-center border border-[#C9A84C]/10">
                        <Building2 className="w-5 h-5 text-[#C9A84C]" />
                      </div>
                      <h3 className="text-white font-semibold text-sm truncate flex-1 group-hover:text-[#C9A84C] transition-colors">
                        {dev.developer}
                      </h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Projects</p>
                        <p className="text-sm font-bold text-white mt-0.5">{formatNumber(dev.project_count)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Units</p>
                        <p className="text-sm font-bold text-white mt-0.5">{formatNumber(dev.total_units)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Score</p>
                        <p className="text-sm font-bold text-[#C9A84C] mt-0.5">
                          {dev.avg_score ? Math.round(Number(dev.avg_score)) : '--'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CITY RANKINGS TAB */}
        {activeTab === 'City Rankings' && (
          <div className="space-y-4">
            {citiesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
              </div>
            ) : cityRankings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <BarChart3 className="w-10 h-10 mb-3 text-gray-600" />
                <p className="text-sm font-medium">No city data available</p>
              </div>
            ) : (
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#1a1a2e] text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">City</div>
                  <div className="col-span-2">County</div>
                  <div className="col-span-2 text-center">Projects</div>
                  <div className="col-span-2 text-center">Total Units</div>
                  <div className="col-span-2 text-center">Avg Score</div>
                </div>
                {/* Rows */}
                {cityRankings.map((city, i) => (
                  <div
                    key={city.city + i}
                    className={`grid grid-cols-12 gap-4 px-5 py-3.5 items-center transition-colors hover:bg-[#C9A84C]/5 ${
                      i < cityRankings.length - 1 ? 'border-b border-[#1a1a2e]/50' : ''
                    }`}
                  >
                    <div className="col-span-1">
                      {i < 3 ? (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-[#C9A84C]/20 text-[#C9A84C]' :
                          i === 1 ? 'bg-gray-400/20 text-gray-300' :
                          'bg-amber-700/20 text-amber-600'
                        }`}>
                          {i + 1}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 pl-1.5">{i + 1}</span>
                      )}
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-white">{city.city}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-400">{city.county || '--'}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-sm font-semibold text-white">{formatNumber(city.project_count)}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-sm font-semibold text-white">{formatNumber(city.total_units)}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      {city.avg_score ? (
                        <ScoreRing score={Math.round(Number(city.avg_score))} size={32} />
                      ) : (
                        <span className="text-sm text-gray-500">--</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Pre-Sales Tab ── */}
        {activeTab === 'Pre-Sales' && (
          <div className="space-y-4">
            {/* Pre-Sale Alerts Banner */}
            {presaleUnread > 0 && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-3">
                  <BellPlus className="text-purple-400" size={20} />
                  <div>
                    <p className="text-sm font-bold text-purple-300">{presaleUnread} New Pre-Sale Alert{presaleUnread > 1 ? 's' : ''}</p>
                    <p className="text-xs text-purple-400/70">New developments entering pre-sales in your area</p>
                  </div>
                </div>
                <button
                  onClick={markPresaleAlertsRead}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition"
                >
                  Mark all read
                </button>
              </div>
            )}

            {presalesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            ) : presales.length === 0 ? (
              <div className="text-center py-16">
                <BadgeDollarSign size={48} className="mx-auto text-gray-700 mb-4" />
                <p className="text-lg font-bold text-gray-400">No Pre-Sale Developments</p>
                <p className="text-sm text-gray-600 mt-1">Developments entering pre-sales will appear here with commission info and lead matching.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {presales.map((dev: any) => (
                  <div key={dev.id} className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-2xl overflow-hidden hover:border-purple-500/20 transition-all">
                    {/* Header */}
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-widest text-purple-400 font-bold">Pre-Sales</span>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute h-full w-full rounded-full bg-purple-400 opacity-75" />
                              <span className="relative rounded-full h-2 w-2 bg-purple-500" />
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-white">{dev.project_name}</h3>
                          <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                            <Building2 size={12} className="text-gray-600" />
                            {dev.developer}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin size={12} />
                            {dev.city}{dev.county ? `, ${dev.county}` : ''}
                          </p>
                        </div>

                        <div className="shrink-0 flex gap-3">
                          {/* Matched clients */}
                          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-purple-300">{dev.matched_clients || 0}</span>
                            <span className="text-[8px] text-purple-400 font-bold uppercase">Matches</span>
                          </div>
                          {/* Score */}
                          {dev.opportunity_score > 0 && (
                            <ScoreRing score={dev.opportunity_score} size={48} />
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-3 mt-4">
                        <div className="bg-[#111] rounded-xl p-3 text-center">
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Units</p>
                          <p className="text-sm font-bold text-white">{formatNumber(dev.units)}</p>
                        </div>
                        <div className="bg-[#111] rounded-xl p-3 text-center">
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Value</p>
                          <p className="text-sm font-bold text-[#C9A84C]">{formatCurrency(dev.estimated_value)}</p>
                        </div>
                        <div className="bg-[#111] rounded-xl p-3 text-center">
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Commission</p>
                          <p className="text-sm font-bold text-emerald-400">{dev.commission?.commission_rate ? `${dev.commission.commission_rate}%` : '—'}</p>
                        </div>
                        <div className="bg-[#111] rounded-xl p-3 text-center">
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Bonus</p>
                          <p className="text-sm font-bold text-amber-400">{dev.commission?.bonus_rate ? `+${dev.commission.bonus_rate}%` : '—'}</p>
                        </div>
                      </div>

                      {/* Commission details */}
                      {dev.commission && (
                        <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Percent size={12} className="text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Commission Info</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="text-gray-500">Price Range:</span>
                              <span className="text-white ml-1">{dev.commission.min_price ? `${formatCurrency(dev.commission.min_price)} – ${formatCurrency(dev.commission.max_price)}` : 'TBD'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Available:</span>
                              <span className="text-white ml-1">{formatNumber(dev.commission.available_units)} / {formatNumber(dev.commission.total_units)}</span>
                            </div>
                            {dev.commission.deposit_structure && (
                              <div>
                                <span className="text-gray-500">Deposit:</span>
                                <span className="text-white ml-1">{dev.commission.deposit_structure}</span>
                              </div>
                            )}
                          </div>
                          {dev.commission.incentives && (
                            <p className="text-xs text-emerald-400 mt-2">
                              <Sparkles size={10} className="inline mr-1" />
                              {dev.commission.incentives}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#111]">
                        <button
                          onClick={() => runMatchEngine(dev.id)}
                          disabled={matchingDevId === dev.id}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition disabled:opacity-50"
                        >
                          {matchingDevId === dev.id ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
                          Match My Leads
                        </button>

                        {!dev.is_registered ? (
                          <button
                            onClick={() => registerForPresale(dev.id)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
                          >
                            <ClipboardCheck size={14} />
                            Register
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={14} />
                            Registered
                          </span>
                        )}

                        {dev.commission?.contact_email && (
                          <a
                            href={`mailto:${dev.commission.contact_email}`}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111] text-gray-400 border border-[#1a1a2e] hover:text-white transition"
                          >
                            <Mail size={14} />
                            Contact
                          </a>
                        )}

                        {dev.commission?.registration_url && (
                          <a
                            href={dev.commission.registration_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111] text-gray-400 border border-[#1a1a2e] hover:text-white transition"
                          >
                            <Link2 size={14} />
                            Dev Portal
                          </a>
                        )}

                        {dev.commission?.brochure_url && (
                          <a
                            href={dev.commission.brochure_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111] text-gray-400 border border-[#1a1a2e] hover:text-white transition"
                          >
                            <FileText size={14} />
                            Brochure
                          </a>
                        )}
                      </div>
                    </div>

                    {/* CRM Match Results (inline) */}
                    {presaleMatches.length > 0 && selectedPresale === dev.id && (
                      <div className="border-t border-[#1a1a2e] p-5 bg-[#08080c]">
                        <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">
                          <UserCheck size={12} className="inline mr-1" />
                          {presaleMatches.length} Matched Contacts
                        </p>
                        <div className="space-y-2">
                          {presaleMatches.slice(0, 5).map((match: any) => (
                            <div key={match.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0f] border border-[#1a1a2e]">
                              <ScoreRing score={match.match_score} size={32} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white">
                                  {match.contact?.first_name} {match.contact?.last_name}
                                </p>
                                <p className="text-xs text-gray-500">{match.contact?.email || match.contact?.phone}</p>
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {(match.match_reasons || []).slice(0, 3).map((r: string) => (
                                  <span key={r} className="text-[9px] px-2 py-0.5 rounded-full bg-[#1a1a2e] text-gray-400">
                                    {r.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Recent Alerts */}
            {presaleAlerts.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BellPlus size={14} />
                  Recent Pre-Sale Alerts
                </h3>
                <div className="space-y-2">
                  {presaleAlerts.slice(0, 5).map((alert: any) => (
                    <div key={alert.id} className={`p-3 rounded-xl border ${alert.is_read ? 'bg-[#0a0a0f] border-[#1a1a2e]' : 'bg-purple-500/5 border-purple-500/20'}`}>
                      <div className="flex items-center gap-3">
                        <Zap size={14} className={alert.is_read ? 'text-gray-600' : 'text-purple-400'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{alert.title}</p>
                          {alert.message && <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.message}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
