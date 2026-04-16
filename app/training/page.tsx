'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { BookOpen, Play, Clock, FileText, CheckCircle2, Lock, ChevronDown, ChevronRight, Globe } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'

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

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TrainingPage() {
  const { user, loading, signOut } = useAuth()
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

  useEffect(() => {
    if (user) {
      loadTrainingData()
    }
  }, [user])

  const getSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return null
    return createClient(supabaseUrl, supabaseKey)
  }

  const loadTrainingData = async () => {
    try {
      setDataLoading(true)
      const supabase = getSupabase()
      if (!supabase) {
        setDataLoading(false)
        return
      }

      const [{ data: mods }, { data: vids }, { data: prog }] = await Promise.all([
        supabase.from('training_modules').select('*').order('sort_order'),
        supabase.from('training_videos').select('*').order('sort_order'),
        supabase
          .from('training_video_progress')
          .select('video_id, watched_seconds, completed')
          .eq('user_id', user?.id),
      ])

      if (mods) setModules(mods as TrainingModule[])
      if (vids) {
        setVideos(vids as TrainingVideo[])
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
    const supabase = getSupabase()
    if (!supabase || !user) return
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
    const supabase = getSupabase()
    if (!supabase || !user) return
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

  // Filtered modules/videos by selected volume
  const volumeModules = useMemo(
    () => modules.filter(m => m.volume === selectedVolume),
    [modules, selectedVolume]
  )
  const videosByModule = useMemo(() => {
    const map: Record<string, TrainingVideo[]> = {}
    for (const v of videos) {
      if (!map[v.module_id]) map[v.module_id] = []
      map[v.module_id].push(v)
    }
    return map
  }, [videos])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Dashboard
            </Link>
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
                <a
                  href="/training/brokerage-policy-manual.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <FileText className="w-5 h-5" />
                  Download Manual (PDF)
                </a>
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
                  const modCompleted = modVideos.filter(v => progress[v.id]?.completed).length
                  return (
                    <div key={mod.id}>
                      <button
                        onClick={() =>
                          setExpandedModules(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))
                        }
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {expanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs text-gray-500">
                              Module {mod.module_num}
                            </div>
                            <div className="font-semibold text-gray-900 text-sm truncate">
                              {moduleTitle}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                          {modCompleted}/{modVideos.length}
                        </div>
                      </button>
                      {expanded && (
                        <ul className="bg-gray-50/50 border-t">
                          {modVideos.map(v => {
                            const isSelected = v.id === selectedVideoId
                            const isCompleted = progress[v.id]?.completed
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
                                  {isCompleted ? (
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
                      )}
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
