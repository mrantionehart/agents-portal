'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import {
  ScrollText,
  Search,
  Star,
  CheckCircle2,
  PlayCircle,
  BookOpen,
  ChevronRight,
  X,
  Pin,
  Clock,
  Award,
  BarChart3,
  Heart,
  Loader2,
  Video,
  StickyNote,
  ArrowLeft,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  description: string | null
}

interface Script {
  id: string
  category_id: string | null
  title: string
  subtitle: string | null
  body_markdown: string | null
  summary: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  heygen_video_url: string | null
  is_pinned: boolean
  view_count: number
  sort_order: number
  created_at: string
  script_categories: {
    id: string
    name: string
    slug: string
    icon: string | null
  } | null
}

interface Completion {
  script_id: string
  status: 'not_started' | 'in_progress' | 'practiced' | 'mastered'
  video_watched: boolean
  quiz_score: number | null
  quiz_passed: boolean
  practice_count: number
  favorited: boolean
  notes: string | null
  last_accessed_at: string | null
}

// ============================================================================
// Constants
// ============================================================================

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Beginner', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  intermediate: { label: 'Intermediate', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  advanced: { label: 'Advanced', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
}

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'text-gray-400', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-400', icon: PlayCircle },
  practiced: { label: 'Practiced', color: 'text-amber-400', icon: CheckCircle2 },
  mastered: { label: 'Mastered', color: 'text-emerald-400', icon: Award },
}

// ============================================================================
// Component
// ============================================================================

export default function ScriptLibraryPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  // Data state
  const [categories, setCategories] = useState<Category[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Filter state
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [activeDifficulty, setActiveDifficulty] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Detail view state
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  const [personalNotes, setPersonalNotes] = useState('')
  const [savingCompletion, setSavingCompletion] = useState(false)

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Auth redirect
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Fetch data
  const fetchData = useCallback(async () => {
    setDataLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeCategory !== 'all') params.set('category', activeCategory)
      if (activeDifficulty !== 'all') params.set('difficulty', activeDifficulty)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())

      const res = await fetch(`/api/scripts?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()

      setCategories(data.categories || [])
      setScripts(data.scripts || [])
      setCompletions(data.completions || [])
    } catch (err) {
      console.error('Script library fetch error:', err)
      showToast('Failed to load scripts', 'error')
    } finally {
      setDataLoading(false)
    }
  }, [activeCategory, activeDifficulty, searchQuery])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Helpers
  function getCompletion(scriptId: string): Completion | undefined {
    return completions.find(c => c.script_id === scriptId)
  }

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Update completion
  async function updateCompletion(scriptId: string, updates: Partial<Completion>) {
    setSavingCompletion(true)
    try {
      const res = await fetch('/api/scripts/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_id: scriptId, ...updates }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()

      // Update local state
      setCompletions(prev => {
        const idx = prev.findIndex(c => c.script_id === scriptId)
        const newCompletion = { ...data.completion, script_id: scriptId }
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], ...newCompletion }
          return updated
        }
        return [...prev, newCompletion]
      })

      if (updates.status === 'practiced') showToast('Marked as practiced!')
      else if (updates.status === 'mastered') showToast('Script mastered!')
      else if (updates.favorited !== undefined) showToast(updates.favorited ? 'Added to favorites' : 'Removed from favorites')
      else if (updates.notes !== undefined) showToast('Notes saved')
    } catch (err) {
      showToast('Failed to save progress', 'error')
    } finally {
      setSavingCompletion(false)
    }
  }

  // Open script detail
  function openScript(script: Script) {
    setSelectedScript(script)
    const completion = getCompletion(script.id)
    setPersonalNotes(completion?.notes || '')
    // Mark as in_progress if not started
    if (!completion || completion.status === 'not_started') {
      updateCompletion(script.id, { status: 'in_progress' })
    }
  }

  // Filter scripts
  const filteredScripts = scripts.filter(s => {
    if (showFavoritesOnly) {
      const c = getCompletion(s.id)
      if (!c?.favorited) return false
    }
    return true
  })

  // Stats
  const totalScripts = scripts.length
  const practicedCount = completions.filter(c => c.status === 'practiced' || c.status === 'mastered').length
  const masteredCount = completions.filter(c => c.status === 'mastered').length
  const favoritedCount = completions.filter(c => c.favorited).length

  if (loading || !user) return null

  // ========================================================================
  // Script Detail View
  // ========================================================================
  if (selectedScript) {
    const completion = getCompletion(selectedScript.id)
    const status = completion?.status || 'not_started'
    const isFavorited = completion?.favorited || false

    return (
      <div className="flex h-screen bg-[#060611]">
        <SidebarNav onSignOut={signOut} userName={user?.email || ''} role={role || undefined} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Back button */}
            <button
              onClick={() => setSelectedScript(null)}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Script Library</span>
            </button>

            {/* Script header */}
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {selectedScript.script_categories && (
                    <span className="text-xs text-[#C9A84C] uppercase tracking-wider font-semibold mb-2 block">
                      {selectedScript.script_categories.name}
                    </span>
                  )}
                  <h1 className="text-2xl font-bold text-white mb-2">{selectedScript.title}</h1>
                  {selectedScript.subtitle && (
                    <p className="text-gray-400 text-sm">{selectedScript.subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {/* Favorite */}
                  <button
                    onClick={() => updateCompletion(selectedScript.id, { favorited: !isFavorited })}
                    className={`p-2 rounded-lg transition ${
                      isFavorited
                        ? 'bg-[#C9A84C]/10 text-[#C9A84C]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a2e]'
                    }`}
                  >
                    <Heart className="w-5 h-5" fill={isFavorited ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Difficulty */}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${DIFFICULTY_CONFIG[selectedScript.difficulty].bg} ${DIFFICULTY_CONFIG[selectedScript.difficulty].color} ${DIFFICULTY_CONFIG[selectedScript.difficulty].border}`}>
                  {DIFFICULTY_CONFIG[selectedScript.difficulty].label}
                </span>

                {/* Status */}
                {(() => {
                  const cfg = STATUS_CONFIG[status]
                  const Icon = cfg.icon
                  return (
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </span>
                  )
                })()}

                {/* Tags */}
                {selectedScript.tags?.map(tag => (
                  <span key={tag} className="text-xs bg-[#1a1a2e] text-gray-400 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}

                {selectedScript.is_pinned && (
                  <span className="flex items-center gap-1 text-xs text-[#C9A84C]">
                    <Pin className="w-3 h-3" /> Pinned
                  </span>
                )}
              </div>
            </div>

            {/* HeyGen Video */}
            {selectedScript.heygen_video_url && (
              <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Video className="w-4 h-4 text-[#C9A84C]" />
                  <h3 className="text-sm font-semibold text-white">Training Video</h3>
                </div>
                <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={selectedScript.heygen_video_url}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
                {!completion?.video_watched && (
                  <button
                    onClick={() => updateCompletion(selectedScript.id, { video_watched: true })}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg text-sm font-medium hover:bg-[#C9A84C]/20 transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Video as Watched
                  </button>
                )}
                {completion?.video_watched && (
                  <p className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Video watched
                  </p>
                )}
              </div>
            )}

            {/* Script Body */}
            {selectedScript.body_markdown && (
              <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-[#C9A84C]" />
                  <h3 className="text-sm font-semibold text-white">Script</h3>
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selectedScript.body_markdown}
                </div>
              </div>
            )}

            {/* Summary */}
            {selectedScript.summary && !selectedScript.body_markdown && (
              <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6 mb-6">
                <p className="text-gray-300 text-sm leading-relaxed">{selectedScript.summary}</p>
              </div>
            )}

            {/* Personal Notes */}
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <StickyNote className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-sm font-semibold text-white">My Notes</h3>
              </div>
              <textarea
                value={personalNotes}
                onChange={e => setPersonalNotes(e.target.value)}
                placeholder="Add personal notes, reminders, or tips for this script..."
                className="w-full bg-[#060611] border border-[#1a1a2e] rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-[#C9A84C]/40"
                rows={4}
              />
              <button
                onClick={() => updateCompletion(selectedScript.id, { notes: personalNotes })}
                disabled={savingCompletion}
                className="mt-3 px-4 py-2 bg-[#1a1a2e] text-gray-300 rounded-lg text-sm font-medium hover:bg-[#252535] transition disabled:opacity-50"
              >
                {savingCompletion ? 'Saving...' : 'Save Notes'}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 mb-8">
              {status !== 'practiced' && status !== 'mastered' && (
                <button
                  onClick={() => updateCompletion(selectedScript.id, { status: 'practiced', practice_count: (completion?.practice_count || 0) + 1 })}
                  disabled={savingCompletion}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-black rounded-lg text-sm font-semibold hover:bg-[#D4B85C] transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Practiced
                </button>
              )}
              {status === 'practiced' && (
                <button
                  onClick={() => updateCompletion(selectedScript.id, { status: 'mastered' })}
                  disabled={savingCompletion}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  <Award className="w-4 h-4" />
                  Mark as Mastered
                </button>
              )}
              {status === 'mastered' && (
                <span className="flex items-center gap-2 px-5 py-2.5 bg-emerald-400/10 text-emerald-400 rounded-lg text-sm font-semibold border border-emerald-400/20">
                  <Award className="w-4 h-4" />
                  Mastered
                </span>
              )}
              {(status === 'practiced' || status === 'mastered') && (
                <button
                  onClick={() => updateCompletion(selectedScript.id, { practice_count: (completion?.practice_count || 0) + 1 })}
                  disabled={savingCompletion}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a2e] text-gray-300 rounded-lg text-sm font-medium hover:bg-[#252535] transition disabled:opacity-50"
                >
                  <PlayCircle className="w-4 h-4" />
                  Practice Again ({completion?.practice_count || 0})
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg animate-in ${
            toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
          }`}>
            {toast.message}
          </div>
        )}
      </div>
    )
  }

  // ========================================================================
  // Library View
  // ========================================================================
  return (
    <div className="flex h-screen bg-[#060611]">
      <SidebarNav onSignOut={signOut} userName={user?.email || ''} role={role || undefined} />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center">
                <ScrollText className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Script Library</h1>
                <p className="text-sm text-gray-400">Master your scripts. Close more deals.</p>
              </div>
            </div>
          </div>

          {/* Progress Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Scripts</p>
              <p className="text-2xl font-bold text-white">{totalScripts}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Practiced</p>
              <p className="text-2xl font-bold text-amber-400">{practicedCount}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Mastered</p>
              <p className="text-2xl font-bold text-emerald-400">{masteredCount}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Favorites</p>
              <p className="text-2xl font-bold text-[#C9A84C]">{favoritedCount}</p>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search scripts..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Difficulty filter */}
            <select
              value={activeDifficulty}
              onChange={e => setActiveDifficulty(e.target.value)}
              className="px-3 py-2.5 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#C9A84C]/40"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            {/* Favorites toggle */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                showFavoritesOnly
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20'
                  : 'bg-[#0a0a0f] border border-[#1a1a2e] text-gray-400 hover:text-white'
              }`}
            >
              <Heart className="w-4 h-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
              Favorites
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeCategory === 'all'
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20'
                  : 'bg-[#0a0a0f] border border-[#1a1a2e] text-gray-400 hover:text-white'
              }`}
            >
              All Scripts
            </button>
            {categories.map(cat => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeCategory === cat.slug
                    ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20'
                    : 'bg-[#0a0a0f] border border-[#1a1a2e] text-gray-400 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {dataLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
              <span className="ml-3 text-gray-400 text-sm">Loading scripts...</span>
            </div>
          )}

          {/* Empty state */}
          {!dataLoading && filteredScripts.length === 0 && (
            <div className="text-center py-20">
              <ScrollText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">
                {showFavoritesOnly ? 'No favorited scripts yet' : 'No scripts found'}
              </h3>
              <p className="text-sm text-gray-500">
                {showFavoritesOnly
                  ? 'Heart a script to add it to your favorites.'
                  : searchQuery
                    ? 'Try a different search or clear your filters.'
                    : 'Scripts will appear here once your broker adds them.'}
              </p>
            </div>
          )}

          {/* Script cards grid */}
          {!dataLoading && filteredScripts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScripts.map(script => {
                const completion = getCompletion(script.id)
                const status = completion?.status || 'not_started'
                const isFavorited = completion?.favorited || false
                const statusCfg = STATUS_CONFIG[status]
                const StatusIcon = statusCfg.icon

                return (
                  <div
                    key={script.id}
                    onClick={() => openScript(script)}
                    className="group bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-5 cursor-pointer hover:border-[#C9A84C]/30 transition-all duration-200 hover:shadow-lg hover:shadow-[#C9A84C]/5 relative"
                  >
                    {/* Pinned indicator */}
                    {script.is_pinned && (
                      <Pin className="absolute top-3 right-3 w-3.5 h-3.5 text-[#C9A84C]" />
                    )}

                    {/* Category */}
                    {script.script_categories && (
                      <p className="text-[10px] text-[#C9A84C] uppercase tracking-wider font-semibold mb-2">
                        {script.script_categories.name}
                      </p>
                    )}

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-white mb-1.5 group-hover:text-[#C9A84C] transition-colors line-clamp-2">
                      {script.title}
                    </h3>

                    {/* Subtitle */}
                    {script.subtitle && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{script.subtitle}</p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-auto">
                      {/* Difficulty badge */}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${DIFFICULTY_CONFIG[script.difficulty].bg} ${DIFFICULTY_CONFIG[script.difficulty].color} ${DIFFICULTY_CONFIG[script.difficulty].border}`}>
                        {DIFFICULTY_CONFIG[script.difficulty].label}
                      </span>

                      {/* Status */}
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Favorite */}
                      {isFavorited && (
                        <Heart className="w-3.5 h-3.5 text-[#C9A84C]" fill="currentColor" />
                      )}

                      {/* Video indicator */}
                      {script.heygen_video_url && (
                        <Video className="w-3.5 h-3.5 text-gray-500" />
                      )}

                      {/* Arrow */}
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#C9A84C] transition-colors" />
                    </div>
                  </div>
                )
              })}
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
