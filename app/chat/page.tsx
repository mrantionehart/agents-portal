'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import { supabase } from '@/lib/supabase'
import { Send, Hash, Users, MessageSquare, Lock } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage {
  id: string
  channel: string
  sender_id: string
  sender_name: string
  message: string
  created_at: string
}

const CHANNELS = [
  { id: 'general', label: 'General', icon: Hash, description: 'Team-wide announcements & conversation' },
  { id: 'new_agents', label: 'New Agents', icon: Users, description: 'Questions & support for new team members' },
  { id: 'luxury', label: 'Luxury', icon: MessageSquare, description: 'Luxury listings & high-end market talk' },
]

export default function ChatPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [activeChannel, setActiveChannel] = useState('general')
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load messages for current channel
  const loadMessages = useCallback(async () => {
    if (!user) return
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel', activeChannel)
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Failed to load messages:', err)
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [user, activeChannel])

  // Load messages when channel changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Subscribe to realtime messages
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`chat-${activeChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel=eq.${activeChannel}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, activeChannel])

  // Focus input when channel changes
  useEffect(() => {
    inputRef.current?.focus()
  }, [activeChannel])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !user || sending) return

    const messageText = inputValue.trim()
    setInputValue('')
    setSending(true)

    try {
      const senderName =
        user.user_metadata?.full_name || user.email?.split('@')[0] || 'Agent'

      const { error } = await supabase.from('chat_messages').insert({
        channel: activeChannel,
        sender_id: user.id,
        sender_name: senderName,
        message: messageText,
      })

      if (error) throw error
    } catch (err) {
      console.error('Failed to send message:', err)
      setInputValue(messageText) // Restore on failure
    } finally {
      setSending(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
      'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  const activeChannelData = CHANNELS.find((c) => c.id === activeChannel)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <SidebarNav
        onSignOut={handleSignOut}
        userName={user?.user_metadata?.full_name}
        role={role}
      />

      <div className="flex-1 flex h-screen">
        {/* Channel List */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Team Chat</h2>
            <p className="text-xs text-gray-500 mt-1">HartFelt Real Estate</p>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
                Channels
              </p>
              {CHANNELS.map((ch) => {
                const Icon = ch.icon
                const isActive = activeChannel === ch.id
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition mb-0.5 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{ch.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Channel Header */}
          <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeChannelData?.label}
                </h3>
              </div>
              <p className="text-xs text-gray-500">{activeChannelData?.description}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Hash className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">No messages yet</p>
                <p className="text-sm mt-1">
                  Be the first to say something in #{activeChannelData?.label}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user.id
                  const showAvatar =
                    idx === 0 || messages[idx - 1].sender_id !== msg.sender_id ||
                    new Date(msg.created_at).getTime() - new Date(messages[idx - 1].created_at).getTime() > 300000

                  return (
                    <div key={msg.id} className={`flex items-start gap-3 ${showAvatar ? 'mt-4' : 'mt-0.5'}`}>
                      {showAvatar ? (
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(
                            msg.sender_name
                          )}`}
                        >
                          {getInitials(msg.sender_name)}
                        </div>
                      ) : (
                        <div className="w-9 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {showAvatar && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className={`text-sm font-semibold ${isOwn ? 'text-blue-600' : 'text-gray-900'}`}>
                              {msg.sender_name}
                            </span>
                            <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <p className="text-sm text-gray-800 break-words leading-relaxed">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Message #${activeChannelData?.label || 'general'}...`}
                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-400"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || sending}
                className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
