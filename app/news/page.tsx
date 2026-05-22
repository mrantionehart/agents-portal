'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import { Newspaper, ExternalLink, Clock, RefreshCw, Loader2 } from 'lucide-react'

interface NewsItem {
  title: string
  link: string
  description: string
  pubDate: string
  source: string
}

export default function NewsPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [articles, setArticles] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    fetchNews()
  }, [])

  async function fetchNews() {
    setNewsLoading(true)
    try {
      const res = await fetch('/api/news?limit=30')
      const data = await res.json()
      setArticles(data.articles || [])
    } catch {
      setArticles([])
    } finally {
      setNewsLoading(false)
    }
  }

  function formatTimeAgo(dateStr: string) {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const diff = now.getTime() - d.getTime()
      const mins = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)
      if (mins < 60) return `${mins}m ago`
      if (hours < 24) return `${hours}h ago`
      if (days < 7) return `${days}d ago`
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  if (loading || !user) return null

  return (
    <div className="flex h-screen bg-[#060611]">
      <SidebarNav onSignOut={signOut} userName={user?.email || ''} role={role || undefined} />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Market News</h1>
                <p className="text-sm text-gray-400">South Florida Real Estate & Business</p>
              </div>
            </div>
            <button
              onClick={fetchNews}
              className="flex items-center gap-2 px-3 py-2 bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg text-sm font-medium hover:bg-[#C9A84C]/20 transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          {/* Articles */}
          {newsLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading news...
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No articles available right now. Check back soon.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article, i) => (
                <a
                  key={i}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-[#0d0d1a] border border-gray-800/50 rounded-xl p-4 hover:border-[#C9A84C]/30 hover:bg-[#0d0d1a]/80 transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-sm leading-snug group-hover:text-[#C9A84C] transition line-clamp-2">
                        {article.title}
                      </h3>
                      {article.description && (
                        <p className="text-gray-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                          {article.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(article.pubDate)}
                        </span>
                        <span className="text-[10px] text-gray-600">{article.source}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-[#C9A84C] transition shrink-0 mt-0.5" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
