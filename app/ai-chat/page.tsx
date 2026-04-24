'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { Send, Trash2, AlertCircle } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import ComplianceNotifications from '../components/compliance-notifications'

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
}

export default function AIChatPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !user) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputValue }),
      })

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }

      const data = await resp.json()

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.message || data.response || 'Unable to process your request.',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (err) {
      console.error('Chat error:', err)
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Something went wrong. Please try again in a moment.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear all messages?')) {
      setMessages([])
      setError(null)
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 font-medium">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
          </div>
          <div className="flex items-center gap-4">
            <ComplianceNotifications userId={user?.id} role={role} />
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
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 flex flex-col">
        {/* Chat Area */}
        <div className="flex-1 bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 mb-6 p-6 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Welcome to HartFelt AI Assistant</h2>
                  <p className="text-gray-400 mb-6">Ask me anything about:</p>
                  <ul className="text-gray-400 space-y-2 mb-8">
                    <li>📊 Market analysis and comparable properties</li>
                    <li>📋 Compliance requirements and document review</li>
                    <li>💰 Commission calculations and projections</li>
                    <li>📝 Contract analysis and questions</li>
                    <li>🏠 Real estate strategies and tips</li>
                    <li>⚖️ Fair housing compliance</li>
                  </ul>
                  <p className="text-sm text-gray-400">Start typing your question below to begin!</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-[#0a0a0f] text-white rounded-bl-none border border-[#1a1a2e]'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#0a0a0f] text-white px-4 py-3 rounded-lg border border-[#1a1a2e] rounded-bl-none">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me a question..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-transparent disabled:bg-[#050507]"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-700 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="bg-red-500/15 text-red-600 px-4 py-3 rounded-lg hover:bg-red-200 transition"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => {
              setInputValue('What are the current market trends in Miami?')
              setMessages([])
            }}
            className="bg-[#0a0a0f] p-4 rounded-lg shadow hover:shadow-lg shadow-black/20 transition text-left"
          >
            <p className="font-semibold text-white mb-1">Market Analysis</p>
            <p className="text-sm text-gray-400">Get market insights and trends</p>
          </button>
          <button
            onClick={() => {
              setInputValue('Help me check if my documents are compliant.')
              setMessages([])
            }}
            className="bg-[#0a0a0f] p-4 rounded-lg shadow hover:shadow-lg shadow-black/20 transition text-left"
          >
            <p className="font-semibold text-white mb-1">Compliance Check</p>
            <p className="text-sm text-gray-400">Review document compliance</p>
          </button>
          <button
            onClick={() => {
              setInputValue('Calculate my commission on a $500,000 sale.')
              setMessages([])
            }}
            className="bg-[#0a0a0f] p-4 rounded-lg shadow hover:shadow-lg shadow-black/20 transition text-left"
          >
            <p className="font-semibold text-white mb-1">Commission Help</p>
            <p className="text-sm text-gray-400">Calculate commissions and splits</p>
          </button>
        </div>
      </main>
    </div>
  )
}
