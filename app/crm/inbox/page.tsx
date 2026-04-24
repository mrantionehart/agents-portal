'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Inbox,
  ArrowLeft,
  Search,
  Mail,
  Phone,
  MessageSquare,
  Zap,
  Clock,
  Send,
  RefreshCw,
  User,
  Calendar,
  AlertTriangle,
  Flame,
  Filter,
  ChevronRight,
  Star,
} from 'lucide-react'

const VAULT_API = 'https://hartfelt-vault.vercel.app/api'

// --- Types ---

interface InboxMessage {
  id: string
  contactName: string
  channel: 'email' | 'sms' | 'phone' | 'web'
  subject: string
  content: string
  category: string
  urgency: number
  timeAgo: string
  read?: boolean
  contactEmail?: string
  contactPhone?: string
}

type CategoryFilter = 'all' | 'hot' | 'showings' | 'offers' | 'follow-ups'
type ToneOption = 'professional' | 'friendly' | 'urgent' | 'follow-up'

// --- Fallback demo data ---

const DEMO_MESSAGES: InboxMessage[] = [
  {
    id: '1',
    contactName: 'Maria Rodriguez',
    channel: 'email',
    subject: 'Looking for 3BR in Doral',
    content:
      "Hi, I'm looking for a 3-bedroom home in Doral under $500K. We need good schools nearby and preferably a newer build. Can you send me some options?",
    category: 'hot_buyer',
    urgency: 5,
    timeAgo: '5m ago',
    contactEmail: 'maria.r@email.com',
    contactPhone: '(305) 555-0142',
  },
  {
    id: '2',
    contactName: 'James Chen',
    channel: 'sms',
    subject: 'Showing Request',
    content: 'Can we see the house on 124 Palm Ave this Saturday? My wife and I are both free after 10am.',
    category: 'showing_request',
    urgency: 3,
    timeAgo: '1h ago',
    contactEmail: 'james.chen@email.com',
    contactPhone: '(786) 555-0198',
  },
  {
    id: '3',
    contactName: 'Sarah Thompson',
    channel: 'email',
    subject: 'Offer Update - 890 Brickell',
    content:
      'We want to submit a revised offer at $475K with a 30-day close. Conventional financing already pre-approved. Let me know if the seller is open to negotiation.',
    category: 'offer',
    urgency: 4,
    timeAgo: '2h ago',
    contactEmail: 's.thompson@email.com',
    contactPhone: '(954) 555-0331',
  },
  {
    id: '4',
    contactName: 'David Park',
    channel: 'phone',
    subject: 'Follow-up: Open House Visit',
    content:
      'David visited the open house at 456 Coral Way last Sunday. He seemed very interested in the property but wanted to check with his financial advisor first. Time to follow up.',
    category: 'follow_up',
    urgency: 2,
    timeAgo: '1d ago',
    contactEmail: 'dpark@email.com',
    contactPhone: '(305) 555-0274',
  },
  {
    id: '5',
    contactName: 'Lisa Martinez',
    channel: 'web',
    subject: 'New Lead - Website Inquiry',
    content:
      'Submitted a form on hartfeltrealestate.com interested in selling her condo in Brickell. Estimated value $380K. Wants a market analysis.',
    category: 'hot_buyer',
    urgency: 4,
    timeAgo: '30m ago',
    contactEmail: 'lisa.m@email.com',
    contactPhone: '(786) 555-0415',
  },
]

// --- Helpers ---

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    hot_buyer: 'Hot Lead',
    showing_request: 'Showing',
    offer: 'Offer',
    follow_up: 'Follow-Up',
  }
  return map[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    hot_buyer: 'bg-red-500/20 text-red-400 border-red-500/30',
    showing_request: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    offer: 'bg-green-500/20 text-green-400 border-green-500/30',
    follow_up: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  }
  return map[cat] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

function channelIcon(channel: string) {
  switch (channel) {
    case 'email':
      return <Mail className="w-3.5 h-3.5" />
    case 'sms':
      return <MessageSquare className="w-3.5 h-3.5" />
    case 'phone':
      return <Phone className="w-3.5 h-3.5" />
    default:
      return <Zap className="w-3.5 h-3.5" />
  }
}

function matchesFilter(msg: InboxMessage, filter: CategoryFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'hot') return msg.urgency >= 4
  if (filter === 'showings') return msg.category === 'showing_request'
  if (filter === 'offers') return msg.category === 'offer'
  if (filter === 'follow-ups') return msg.category === 'follow_up'
  return true
}

// --- Skeleton loader ---

function SkeletonRow() {
  return (
    <div className="p-4 border-b border-[#1a1a2e] animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-16 h-5 bg-[#1a1a2e] rounded" />
        <div className="w-24 h-4 bg-[#1a1a2e] rounded" />
      </div>
      <div className="w-full h-4 bg-[#1a1a2e] rounded mb-1" />
      <div className="w-2/3 h-3 bg-[#1a1a2e] rounded" />
    </div>
  )
}

// --- Component ---

export default function SmartInboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [draftTone, setDraftTone] = useState<ToneOption>('professional')
  const [draft, setDraft] = useState('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [sendingDraft, setSendingDraft] = useState(false)
  const [note, setNote] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Fetch messages
  useEffect(() => {
    async function fetchInbox() {
      setLoading(true)
      try {
        const res = await fetch(`${VAULT_API}/crm/inbox?limit=50`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        const items = Array.isArray(data) ? data : data.messages || data.data || []
        setMessages(items.length > 0 ? items : DEMO_MESSAGES)
      } catch {
        setMessages(DEMO_MESSAGES)
      } finally {
        setLoading(false)
      }
    }
    fetchInbox()
  }, [])

  // Filtered + searched list
  const filtered = messages.filter((m) => {
    if (!matchesFilter(m, filter)) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        m.contactName.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q)
      )
    }
    return true
  })

  const selected = messages.find((m) => m.id === selectedId) || null

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (filtered.length === 0) return
      const idx = filtered.findIndex((m) => m.id === selectedId)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = idx < filtered.length - 1 ? idx + 1 : 0
        setSelectedId(filtered[next].id)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = idx > 0 ? idx - 1 : filtered.length - 1
        setSelectedId(filtered[prev].id)
      }
    },
    [filtered, selectedId]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Generate AI draft
  async function generateDraft() {
    if (!selected) return
    setDraftLoading(true)
    setDraft('')
    try {
      const res = await fetch(`${VAULT_API}/crm/ai/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: selected.id,
          contactName: selected.contactName,
          subject: selected.subject,
          content: selected.content,
          category: selected.category,
          tone: draftTone,
        }),
      })
      if (!res.ok) throw new Error('Draft generation failed')
      const data = await res.json()
      setDraft(data.draft || data.response || data.text || '')
    } catch {
      // Fallback draft for development
      const toneGreeting: Record<ToneOption, string> = {
        professional: `Dear ${selected.contactName},\n\nThank you for reaching out regarding "${selected.subject}." I appreciate your interest and would love to assist you.\n\nI have reviewed your inquiry and would like to schedule a time to discuss this further. Please let me know your availability, and I will make arrangements accordingly.\n\nBest regards,\nYour Hartfelt Agent`,
        friendly: `Hey ${selected.contactName}!\n\nThanks so much for reaching out! I got your message about "${selected.subject}" and I am excited to help.\n\nLet me pull together some great options for you. When works best for a quick chat?\n\nLooking forward to connecting!\nYour Hartfelt Agent`,
        urgent: `Hi ${selected.contactName},\n\nI received your message regarding "${selected.subject}" and wanted to get back to you right away.\n\nThis is a priority for me, and I am working on it now. I will have an update for you within the next hour.\n\nTalk soon,\nYour Hartfelt Agent`,
        'follow-up': `Hi ${selected.contactName},\n\nJust following up on your inquiry about "${selected.subject}." I wanted to make sure you have everything you need.\n\nIf you have any questions or would like to take the next step, I am here to help. No pressure at all!\n\nWarmly,\nYour Hartfelt Agent`,
      }
      setDraft(toneGreeting[draftTone])
    } finally {
      setDraftLoading(false)
    }
  }

  // Send draft (stub)
  async function handleSendDraft() {
    if (!draft || !selected) return
    setSendingDraft(true)
    try {
      await fetch(`${VAULT_API}/crm/inbox/${selected.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, channel: selected.channel }),
      })
    } catch {
      // Silently handle - will show success state anyway for demo
    } finally {
      setSendingDraft(false)
      setDraft('')
    }
  }

  // --- Filter tabs ---

  const tabs: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'hot', label: 'Hot \u{1F525}' },
    { key: 'showings', label: 'Showings' },
    { key: 'offers', label: 'Offers' },
    { key: 'follow-ups', label: 'Follow-ups' },
  ]

  // --- Render ---

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="flex flex-col lg:flex-row h-screen">
        {/* ===== LEFT PANEL ===== */}
        <div className="lg:w-[400px] w-full flex-shrink-0 border-r border-[#1a1a2e] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[#1a1a2e] flex items-center gap-3">
            <Link
              href="/crm"
              className="p-2 rounded-lg hover:bg-[#1a1a2e] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-[#C9A84C]" />
              <h1 className="text-lg font-semibold">Smart Inbox</h1>
            </div>
            <span className="ml-auto text-xs text-gray-500 bg-[#1a1a2e] px-2 py-1 rounded-full">
              {filtered.length}
            </span>
          </div>

          {/* Category Tabs */}
          <div className="px-4 pt-3 pb-2 flex gap-1.5 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === t.key
                    ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40'
                    : 'bg-[#0a0a0f] text-gray-400 border border-[#1a1a2e] hover:border-[#2a2a3e]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50"
              />
            </div>
          </div>

          {/* Message List */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Inbox className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">No messages found</p>
                <p className="text-xs mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filtered.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => {
                    setSelectedId(msg.id)
                    setDraft('')
                    setNote('')
                  }}
                  className={`w-full text-left p-4 border-b border-[#1a1a2e] transition-colors ${
                    selectedId === msg.id
                      ? 'bg-[#C9A84C]/5 border-l-2 border-l-[#C9A84C]'
                      : 'hover:bg-[#0a0a0f]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${categoryColor(
                        msg.category
                      )}`}
                    >
                      {categoryLabel(msg.category)}
                    </span>
                    {msg.urgency >= 4 && (
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                    )}
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-500">
                      {channelIcon(msg.channel)}
                      <Clock className="w-3 h-3" />
                      {msg.timeAgo}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">
                    {msg.contactName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{msg.subject}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                    {msg.content.slice(0, 80)}
                    {msg.content.length > 80 ? '...' : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Inbox className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a message</p>
              <p className="text-sm mt-1">
                Choose a conversation from the left to view details
              </p>
              <p className="text-xs mt-3 text-gray-600">
                Use arrow keys to navigate
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-6 space-y-6">
              {/* Contact Header */}
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-[#C9A84C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-white">
                      {selected.contactName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-400">
                      {selected.contactEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {selected.contactEmail}
                        </span>
                      )}
                      {selected.contactPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selected.contactPhone}
                        </span>
                      )}
                      <span className="flex items-center gap-1 capitalize">
                        {channelIcon(selected.channel)}
                        via {selected.channel}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                </div>
              </div>

              {/* Full Message */}
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#C9A84C] mb-1">
                  {selected.subject}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selected.content}
                </p>
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {selected.timeAgo}
                </div>
              </div>

              {/* AI Classification */}
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-[#C9A84C]" />
                  <h3 className="text-sm font-semibold">AI Classification</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#050507] rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      Category
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${categoryColor(
                        selected.category
                      )}`}
                    >
                      {categoryLabel(selected.category)}
                    </span>
                  </div>
                  <div className="bg-[#050507] rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      Urgency
                    </p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Flame
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < selected.urgency
                              ? 'text-orange-400'
                              : 'text-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#050507] rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      Suggested Action
                    </p>
                    <p className="text-xs text-gray-300">
                      {selected.urgency >= 4
                        ? 'Respond immediately'
                        : selected.category === 'follow_up'
                        ? 'Schedule follow-up'
                        : 'Review & respond'}
                    </p>
                  </div>
                </div>
              </div>

              {/* AI Response Generator */}
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-[#C9A84C]" />
                  <h3 className="text-sm font-semibold">AI Response Generator</h3>
                </div>

                {/* Tone Buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(
                    [
                      { key: 'professional', label: 'Professional' },
                      { key: 'friendly', label: 'Friendly' },
                      { key: 'urgent', label: 'Urgent' },
                      { key: 'follow-up', label: 'Follow-up' },
                    ] as { key: ToneOption; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setDraftTone(t.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        draftTone === t.key
                          ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40'
                          : 'bg-[#050507] text-gray-400 border border-[#1a1a2e] hover:border-[#2a2a3e]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Generate Button */}
                <button
                  onClick={generateDraft}
                  disabled={draftLoading}
                  className="w-full py-2.5 rounded-lg bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#d4b55a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
                >
                  {draftLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Generate AI Draft
                    </>
                  )}
                </button>

                {/* Draft Textarea */}
                {draft && (
                  <div className="space-y-3">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={8}
                      className="w-full bg-[#050507] border border-[#1a1a2e] rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-[#C9A84C]/50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSendDraft}
                        disabled={sendingDraft}
                        className="flex-1 py-2 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        {sendingDraft ? 'Sending...' : 'Send'}
                      </button>
                      <button
                        onClick={generateDraft}
                        disabled={draftLoading}
                        className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-gray-300 font-medium text-sm hover:bg-[#2a2a3e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-[#C9A84C]" />
                  <h3 className="text-sm font-semibold">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button className="flex items-center gap-2 p-3 bg-[#050507] border border-[#1a1a2e] rounded-lg text-sm text-gray-300 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors">
                    <Calendar className="w-4 h-4" />
                    Schedule Follow-Up
                  </button>
                  <button
                    onClick={() => setNote(note ? '' : ' ')}
                    className="flex items-center gap-2 p-3 bg-[#050507] border border-[#1a1a2e] rounded-lg text-sm text-gray-300 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                  >
                    <Filter className="w-4 h-4" />
                    Log Note
                  </button>
                </div>

                {/* Log Note area */}
                {note !== '' && (
                  <div className="space-y-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Add a note about this conversation..."
                      className="w-full bg-[#050507] border border-[#1a1a2e] rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-[#C9A84C]/50"
                    />
                    <button
                      onClick={() => setNote('')}
                      className="px-4 py-1.5 rounded-lg bg-[#C9A84C]/20 text-[#C9A84C] text-xs font-medium hover:bg-[#C9A84C]/30 transition-colors"
                    >
                      Save Note
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
