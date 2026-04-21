'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { BookOpen, Play, Clock, FileText, CheckCircle2, Lock, ChevronDown, ChevronRight, Globe, ClipboardCheck } from 'lucide-react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getQuizForModule } from '@/app/data/quizzes'
import type { Quiz } from '@/app/data/quizzes'
import QuizModal from '@/app/components/QuizModal'

type Lang = 'en' | 'es'

interface TrainingModule {
  id: string
  volume: number
  module_num: number
  title_en: string
  title_es: string
  sort_order: number
}

interface TrainingVideo {
  id: string
  module_id: string
  volume: number
  module_num: number
  video_num: string
  title_en: string | null
  title_es: string | null
  youtube_id_en: string | null
  youtube_id_es: string | null
  r2_key_en: string | null
  r2_key_es: string | null
  duration_en_sec: number | null
  duration_es_sec: number | null
  sort_order: number
}

interface VideoProgress {
  video_id: string
  watched_seconds: number
  completed: boolean
}

interface TrainingProgress {
  volume: string
  completed_modules: number[] | null
  test_scores: Record<string, number> | null
  volume_completed: boolean
}

interface QuizResult {
  volume: number
  module_num: number
  score: number
  passed: boolean
  attempt_num: number
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TrainingPage() {
  const { user, loading, signOut, trainingGate, role } = useAuth()
  const router = useRouter()

  const [lang, setLang] = useState<Lang>('en')
  const [modules, setModules] = useState<TrainingModule[]>([])
  const [videos, setVideos] = useState<TrainingVideo[]>([])
  const [progress, setProgress] = useState<Record<string, VideoProgress>>({})
  const [dataLoading, setDataLoading] = useState(true)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [selectedVolume, setSelectedVolume] = useState<1 | 2 | 3>(1)
  const [r2SignedUrl, setR2SignedUrl] = useState<string | null>(null)

  // Quiz & progression state
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress[]>([])
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [activeQuiz, setActiveQuiz] = useState<{ quiz: Quiz; volume: number; moduleNum: number } | null>(null)

  const loadProgressData = useCallback(async () => {
    try {
      const resp = await fetch('/api/training/progress')
      if (!resp.ok) return
      const data = await resp.json()
      if (data.trainingProgress) setTrainingProgress(data.trainingProgress)
      if (data.quizResults) setQuizResults(data.quizResults)
    } catch (err) {
      console.error('Failed to load progress:', err)
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadTrainingData()
      loadProgressData()
    }
  }, [user])

  const loadTrainingData = async () => {
    try {
      setDataLoading(true)

      const resp = await fetch('/api/training/catalog')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const { modules: mods, videos: vids, progress: prog } = await resp.json()

      if (mods) setModules(mods as TrainingModule[])
      if (vids) {
        setVideos(vids as TrainingModule[])
        // Auto-expand first module & select first playable video
        const firstMod = (mods || [])[0]
        if (firstMod) {
          setExpandedModules({ [firstMod.id]: true })
        }
        const firstPlayable = (vids as TrainingVideo[]).find(
          v => v.youtube_id_en || v.youtube_id_es || v.r2_key_en || v.r2_key_es
        )
        if (firstPlayable) setSelectedVideoId(firstPlayable.id)
      }

      if (prog) {
        const map: Record<string, VideoProgress> = {}
        for (const p of prog as VideoProgress[]) {
          map[p.video_id] = p
        }
        setProgress(map)
      }
    } catch (err) {
      console.error('Failed to load training data:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const markVideoStarted = async (videoId: string) => {
    if (!user) return
    try {
      await supabase.from('training_video_progress').upsert(
        {
          user_id: user.id,
          video_id: videoId,
          watched_seconds: 0,
          completed: false,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' }
      )
    } catch (err) {
      console.error('Failed to mark video started:', err)
    }
  }

  const markVideoCompleted = async (videoId: string) => {
    if (!user) return
    try {
      await supabase.from('training_video_progress').upsert(
        {
          user_id: user.id,
          video_id: videoId,
          watched_seconds: 0,
          completed: true,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' }
      )
      setProgress(prev => ({
        ...prev,
        [videoId]: { video_id: videoId, watched_seconds: 0, completed: true },
      }))
    } catch (err) {
      console.error('Failed to mark video completed:', err)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // ── Quiz & Progression helpers ──

  // Get completed modules for a given volume number
  const getCompletedModules = useCallback(
    (vol: number): number[] => {
      const volStr = `volume-${vol}`
      const prog = trainingProgress.find(p => p.volume === volStr)
      return prog?.completed_modules || []
    },
    [trainingProgress]
  )

  // Check if a module is unlocked. Module rule: first module of each volume
  // is always unlocked; subsequent modules require the previous module's quiz
  // to be passed (i.e. the previous module_num is in completed_modules).
  // Modules that are always unlocked (accessible without progression)
  const ALWAYS_UNLOCKED: Record<number, number[]> = {
    1: [10], // Module 10 (New Agent Playbook) — always open
  }

  const isModuleUnlocked = useCallback(
    (vol: number, moduleNum: number, allModuleNums: number[]): boolean => {
      // Check if this module is always unlocked
      if (ALWAYS_UNLOCKED[vol]?.includes(moduleNum)) return true
      const sorted = [...allModuleNums].sort((a, b) => a - b)
      if (sorted.length === 0) return false
      // First module is always unlocked
      if (moduleNum === sorted[0]) return true
      const idx = sorted.indexOf(moduleNum)
      if (idx <= 0) return true
      const prevModule = sorted[idx - 1]
      return getCompletedModules(vol).includes(prevModule)
    },
    [getCompletedModules]
  )

  const isModuleCompleted = useCallback(
    (vol: number, moduleNum: number): boolean => {
      return getCompletedModules(vol).includes(moduleNum)
    },
    [getCompletedModules]
  )

  const openQuiz = (vol: number, moduleNum: number) => {
    const quiz = getQuizForModule(vol, moduleNum)
    if (quiz) {
      setActiveQuiz({ quiz, volume: vol, moduleNum })
    }
  }

  const handleQuizComplete = (result: { score: number; passed: boolean }) => {
    setActiveQuiz(null)
    // Refresh progress to pick up the new completed module
    loadProgressData()
  }

  // EASE Training module IDs are role-specific — filter by user role
  const EASE_ROLE_MODULES: Record<string, string> = {
    'm_v4_broker': 'broker',
    'm_v4_admin': 'admin',
    'm_v4_agent': 'agent',
  }

  // Filtered modules/videos by selected volume + role
  const volumeModules = useMemo(
    () => modules.filter(m => {
      if (m.volume !== selectedVolume) return false
      const requiredRole = EASE_ROLE_MODULES[m.id]
      if (requiredRole && requiredRole !== role) return false
      return true
    }),
    [modules, selectedVolume, role]
  )
  const videosByModule = useMemo(() => {
    const map: Record<string, TrainingVideo[]> = {}
    for (const v of videos) {
      if (!map[v.module_id]) map[v.module_id] = []
      map[v.module_id].push(v)
    }
    return map
  }, [videos])

  // All module numbers for the current volume (used for lock logic)
  const volumeModuleNums = useMemo(
    () => volumeModules.map(m => m.module_num).sort((a, b) => a - b),
    [volumeModules]
  )

  const selectedVideo = useMemo(
    () => videos.find(v => v.id === selectedVideoId) || null,
    [videos, selectedVideoId]
  )

  const currentYouTubeId = useMemo(() => {
    if (!selectedVideo) return null
    return lang === 'en'
      ? selectedVideo.youtube_id_en || selectedVideo.youtube_id_es
      : selectedVideo.youtube_id_es || selectedVideo.youtube_id_en
  }, [selectedVideo, lang])

  // R2 key for current video (used when no YouTube ID but R2 key exists)
  const currentR2Key = useMemo(() => {
    if (!selectedVideo) return null
    if (currentYouTubeId) return null // YouTube takes priority
    return lang === 'en'
      ? selectedVideo.r2_key_en || selectedVideo.r2_key_es
      : selectedVideo.r2_key_es || selectedVideo.r2_key_en
  }, [selectedVideo, lang, currentYouTubeId])

  // Fetch signed R2 URL when R2 key changes
  useEffect(() => {
    if (!currentR2Key) {
      setR2SignedUrl(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch(`/api/training/sign-video?key=${encodeURIComponent(currentR2Key)}`)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (!cancelled) setR2SignedUrl(data.url)
      } catch (err) {
        console.error('Failed to get signed R2 URL:', err)
        if (!cancelled) setR2SignedUrl(null)
      }
    })()
    return () => { cancelled = true }
  }, [currentR2Key])

  const hasPlayableVideo = !!(currentYouTubeId || currentR2Key)

  const totalVideos = videos.length
  const completedCount = Object.values(progress).filter(p => p.completed).length

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    router.push('/login')
    return null
  }

  const isGated = role === 'agent' && !trainingGate.gateOpen

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Training Gate Banner — shown when app is locked */}
      {isGated && (
        <div className="bg-amber-50 border-b-2 border-amber-400">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-start gap-3">
              <Lock className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900">Complete Volume 1 Training to Unlock Your Portal</h3>
                <p className="text-amber-800 text-sm mt-1">
                  Finish all 9 modules below to unlock Deals, Leads, Chat, Calendar, and all other portal features.
                  You have completed {trainingGate.vol1.completed.length} of {trainingGate.vol1.total} modules.
                </p>
                <div className="mt-3 w-full bg-amber-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${trainingGate.vol1.total > 0 ? Math.round((trainingGate.vol1.completed.length / trainingGate.vol1.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {isGated ? (
              <span className="text-gray-400 font-medium">Portal locked until training complete</span>
            ) : (
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
                ← Dashboard
              </Link>
            )}
            <h1 className="text-2xl font-bold text-gray-900">HartFelt Ready Training</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 ${
                  lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Globe className="w-4 h-4" /> EN
              </button>
              <button
                onClick={() => setLang('es')}
                className={`px-3 py-1.5 text-sm font-medium ${
                  lang === 'es' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                ES
              </button>
            </div>
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
        {/* Brokerage Policy Manual */}
        <section className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Brokerage Policy Manual</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Essential reference guide with HartFelt policies, procedures, commission structures, and compliance requirements.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <a
                    href="/training/brokerage-policy-manual.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    <FileText className="w-5 h-5" />
                    Policy Manual (PDF)
                  </a>
                  <a
                    href="/training/HartFelt_Agent_Training_Manual.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-lg hover:bg-amber-700 transition font-medium"
                  >
                    <FileText className="w-5 h-5" />
                    EASE & Portal Manual (PDF)
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Volume tabs + progress summary */}
        <section className="mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden">
              <button
                onClick={() => setSelectedVolume(1)}
                className={`px-5 py-2 font-medium ${
                  selectedVolume === 1
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Vol 1 — Foundations
              </button>
              <button
                onClick={() => setSelectedVolume(2)}
                className={`px-5 py-2 font-medium ${
                  selectedVolume === 2
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Vol 2 — Elite
              </button>
              <button
                onClick={() => setSelectedVolume(3)}
                className={`px-5 py-2 font-medium ${
                  selectedVolume === 3
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                AI Training
              </button>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{completedCount}</span>
              {' '}of {totalVideos} videos completed
            </div>
          </div>
        </section>

        {dataLoading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-gray-600">Loading training library...</p>
          </div>
        ) : modules.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-900 font-medium mb-1">Training library not yet seeded.</p>
            <p className="text-yellow-800 text-sm">
              Run the <code className="bg-yellow-100 px-1 rounded">018_training_videos.sql</code>{' '}
              migration in Supabase, then refresh this page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Player column */}
            <div className="lg:col-span-2">
              <div className="bg-black rounded-lg overflow-hidden shadow-lg aspect-video">
                {currentYouTubeId ? (
                  <iframe
                    key={currentYouTubeId}
                    src={`https://www.youtube.com/embed/${currentYouTubeId}?modestbranding=1&rel=0`}
                    title={selectedVideo?.title_en || 'Training video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                    onLoad={() => selectedVideo && markVideoStarted(selectedVideo.id)}
                  />
                ) : r2SignedUrl ? (
                  <video
                    key={currentR2Key}
                    src={r2SignedUrl}
                    controls
                    autoPlay={false}
                    className="w-full h-full"
                    onPlay={() => selectedVideo && markVideoStarted(selectedVideo.id)}
                  />
                ) : currentR2Key ? (
                  <div className="w-full h-full flex items-center justify-center text-white text-center p-8">
                    <div>
                      <Play className="w-12 h-12 mx-auto mb-3 opacity-60 animate-pulse" />
                      <p className="font-semibold mb-1">Loading video...</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-center p-8">
                    <div>
                      <Lock className="w-12 h-12 mx-auto mb-3 opacity-60" />
                      <p className="font-semibold mb-1">Video coming soon</p>
                      <p className="text-sm opacity-70">
                        This lesson hasn&apos;t been uploaded yet.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected video details */}
              {selectedVideo && (
                <div className="bg-white rounded-lg shadow mt-4 p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-blue-600 mb-1">
                        Video {selectedVideo.video_num}
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {lang === 'en'
                          ? selectedVideo.title_en || selectedVideo.title_es
                          : selectedVideo.title_es || selectedVideo.title_en}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                      <Clock className="w-4 h-4" />
                      {formatDuration(
                        lang === 'en'
                          ? selectedVideo.duration_en_sec
                          : selectedVideo.duration_es_sec
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {hasPlayableVideo && (
                      <button
                        onClick={() => markVideoCompleted(selectedVideo.id)}
                        disabled={progress[selectedVideo.id]?.completed}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${
                          progress[selectedVideo.id]?.completed
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {progress[selectedVideo.id]?.completed
                          ? 'Completed'
                          : 'Mark as complete'}
                      </button>
                    )}
                    {/* Show Take Quiz button if a quiz exists for this module */}
                    {getQuizForModule(selectedVolume, selectedVideo.module_num) && (
                      <button
                        onClick={() => openQuiz(selectedVolume, selectedVideo.module_num)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${
                          isModuleCompleted(selectedVolume, selectedVideo.module_num)
                            ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        {isModuleCompleted(selectedVolume, selectedVideo.module_num)
                          ? 'Quiz Passed — Retake'
                          : 'Take Module Quiz'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Module tree column */}
            <aside className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {selectedVolume === 3 ? 'AI Training' : `Volume ${selectedVolume}`} modules
                </h3>
              </div>
              <div className="divide-y max-h-[70vh] overflow-y-auto">
                {volumeModules.map(mod => {
                  const modVideos = videosByModule[mod.id] || []
                  const expanded = expandedModules[mod.id]
                  const moduleTitle = lang === 'en' ? mod.title_en : mod.title_es
                  const modVideosDone = modVideos.filter(v => progress[v.id]?.completed).length

                  const unlocked = isModuleUnlocked(selectedVolume, mod.module_num, volumeModuleNums)
                  const completed = isModuleCompleted(selectedVolume, mod.module_num)
                  const hasQuiz = !!getQuizForModule(selectedVolume, mod.module_num)

                  return (
                    <div key={mod.id}>
                      <button
                        onClick={() => {
                          if (!unlocked) return
                          setExpandedModules(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${
                          unlocked ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {!unlocked ? (
                            <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          ) : completed ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : expanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs text-gray-500">
                              Module {mod.module_num}
                              {completed && (
                                <span className="ml-1.5 text-green-600 font-medium">Passed</span>
                              )}
                            </div>
                            <div className={`font-semibold text-sm truncate ${unlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                              {moduleTitle}
                            </div>
                            {!unlocked && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                Complete previous module quiz to unlock
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                          {modVideosDone}/{modVideos.length}
                        </div>
                      </button>
                      {expanded && unlocked && (
                        <>
                          <ul className="bg-gray-50/50 border-t">
                            {modVideos.map(v => {
                              const isSelected = v.id === selectedVideoId
                              const isVidCompleted = progress[v.id]?.completed
                              const hasVideo = !!(v.youtube_id_en || v.youtube_id_es || v.r2_key_en || v.r2_key_es)
                              const videoTitle =
                                (lang === 'en' ? v.title_en : v.title_es) ||
                                v.title_en ||
                                v.title_es ||
                                `Video ${v.video_num}`
                              return (
                                <li key={v.id}>
                                  <button
                                    onClick={() => setSelectedVideoId(v.id)}
                                    className={`w-full flex items-center gap-3 px-6 py-2.5 text-left text-sm hover:bg-gray-100 transition ${
                                      isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                                    }`}
                                  >
                                    {isVidCompleted ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    ) : hasVideo ? (
                                      <Play className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                    ) : (
                                      <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-gray-500">
                                        {v.video_num}
                                      </div>
                                      <div
                                        className={`truncate ${
                                          isSelected
                                            ? 'font-semibold text-gray-900'
                                            : 'text-gray-700'
                                        }`}
                                      >
                                        {videoTitle}
                                      </div>
                                    </div>
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                      {formatDuration(
                                        lang === 'en' ? v.duration_en_sec : v.duration_es_sec
                                      )}
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                          {/* Quiz button for this module */}
                          {hasQuiz && (
                            <div className="border-t bg-gray-50 px-4 py-2.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openQuiz(selectedVolume, mod.module_num)
                                }}
                                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                  completed
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                <ClipboardCheck className="w-4 h-4" />
                                {completed ? 'Retake Quiz' : 'Take Quiz'}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Quiz Modal */}
      {activeQuiz && (
        <QuizModal
          quiz={activeQuiz.quiz}
          volume={activeQuiz.volume}
          moduleNum={activeQuiz.moduleNum}
          onComplete={handleQuizComplete}
          onClose={() => setActiveQuiz(null)}
        />
      )}
    </div>
  )
}
