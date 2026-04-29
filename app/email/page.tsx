'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../providers'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Send, Inbox, Mail, Star, Trash2, Search,
  RefreshCw, ChevronRight, Paperclip, X, Edit, Archive,
  Eye, Reply, Users, Filter
} from 'lucide-react'

interface Email {
  id: string
  thread_id: string
  direction: 'sent' | 'received'
  from_email: string
  from_name: string | null
  to_email: string
  to_name: string | null
  subject: string
  body_text: string
  body_html: string | null
  is_read: boolean
  is_starred: boolean
  folder: string
  contact_id: string | null
  created_at: string
  contacts?: { id: string; full_name: string; email: string; company: string | null } | null
}

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: string | null
}

type Folder = 'inbox' | 'sent' | 'all' | 'starred' | 'trash'

export default function EmailPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [emails, setEmails] = useState<Email[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [folder, setFolder] = useState<Folder>('inbox')
  const [search, setSearch] = useState('')
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [threadEmails, setThreadEmails] = useState<Email[]>([])
  const [showCompose, setShowCompose] = useState(false)
  const [sending, setSending] = useState(false)

  // Compose state
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeContactId, setComposeContactId] = useState<string | null>(null)
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [showContactPicker, setShowContactPicker] = useState(false)

  // Pre-fill from URL params (from contacts page)
  useEffect(() => {
    const to = searchParams.get('to')
    const name = searchParams.get('name')
    const contactId = searchParams.get('contactId')
    if (to) {
      setComposeTo(to)
      setComposeContactId(contactId)
      setShowCompose(true)
    }
  }, [searchParams])

  useEffect(() => {
    loadEmails()
    loadContacts()
  }, [folder, search])

  const loadEmails = async () => {
    setLoading(true)
    const params = new URLSearchParams()

    if (folder === 'starred') {
      params.set('folder', 'all')
    } else {
      params.set('folder', folder)
    }
    if (search) params.set('search', search)

    const res = await fetch(`/api/email/inbox?${params}`)
    if (res.ok) {
      let data = await res.json()
      if (folder === 'starred') {
        data = data.filter((e: Email) => e.is_starred)
      }
      setEmails(data)
    }
    setLoading(false)
  }

  const loadContacts = async () => {
    const res = await fetch('/api/contacts')
    if (res.ok) setContacts(await res.json())
  }

  const loadThread = async (threadId: string) => {
    const res = await fetch(`/api/email/inbox?thread_id=${threadId}`)
    if (res.ok) setThreadEmails(await res.json())
  }

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email)
    if (!email.is_read) {
      await fetch('/api/email/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [email.id], updates: { is_read: true } }),
      })
    }
    if (email.thread_id) {
      loadThread(email.thread_id)
    } else {
      setThreadEmails([email])
    }
  }

  const handleStar = async (email: Email, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch('/api/email/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [email.id], updates: { is_starred: !email.is_starred } }),
    })
    loadEmails()
  }

  const handleTrash = async (email: Email) => {
    await fetch('/api/email/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [email.id], updates: { folder: 'trash' } }),
    })
    setSelectedEmail(null)
    loadEmails()
  }

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) return
    setSending(true)

    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        contactId: composeContactId,
        replyToThreadId: replyThreadId,
      }),
    })

    if (res.ok) {
      setShowCompose(false)
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setComposeContactId(null)
      setReplyThreadId(null)
      loadEmails()
    }
    setSending(false)
  }

  const handleReply = (email: Email) => {
    setComposeTo(email.direction === 'received' ? email.from_email : email.to_email)
    setComposeSubject(email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`)
    setComposeContactId(email.contact_id)
    setReplyThreadId(email.thread_id)
    setShowCompose(true)
  }

  const handleContactSelect = (contact: Contact) => {
    setComposeTo(contact.email || '')
    setComposeContactId(contact.id)
    setShowContactPicker(false)
    setContactSearch('')
  }

  const filteredContacts = contacts.filter(c =>
    c.email && (
      c.full_name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(contactSearch.toLowerCase())
    )
  )

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const folders: { key: Folder; label: string; icon: any }[] = [
    { key: 'inbox', label: 'Inbox', icon: Inbox },
    { key: 'sent', label: 'Sent', icon: Send },
    { key: 'starred', label: 'Starred', icon: Star },
    { key: 'all', label: 'All Mail', icon: Mail },
    { key: 'trash', label: 'Trash', icon: Trash2 },
  ]

  const unreadCount = emails.filter(e => !e.is_read && e.folder === 'inbox').length

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Left Sidebar — Folders */}
      <div className="w-56 bg-[#050507] border-r border-[#1a1a2e] flex flex-col">
        <div className="p-4">
          <button
            onClick={() => { setShowCompose(true); setReplyThreadId(null); setComposeTo(''); setComposeSubject(''); setComposeBody('') }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C9A84C] text-black rounded-lg font-medium hover:bg-[#d4b65c] text-sm"
          >
            <Edit className="w-4 h-4" />
            Compose
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {folders.map(f => {
            const Icon = f.icon
            return (
              <button
                key={f.key}
                onClick={() => { setFolder(f.key); setSelectedEmail(null) }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  folder === f.key
                    ? 'bg-[#C9A84C]/10 text-[#C9A84C]'
                    : 'text-gray-400 hover:bg-[#111] hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{f.label}</span>
                {f.key === 'inbox' && unreadCount > 0 && (
                  <span className="text-xs bg-[#C9A84C] text-black px-1.5 py-0.5 rounded-full font-medium">{unreadCount}</span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-[#1a1a2e]">
          <Link href="/contacts" className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#C9A84C]">
            <Users className="w-4 h-4" />
            Manage Contacts
          </Link>
        </div>
      </div>

      {/* Email List */}
      <div className="w-96 border-r border-[#1a1a2e] flex flex-col bg-[#0a0a0f]">
        {/* Search */}
        <div className="p-3 border-b border-[#1a1a2e]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            />
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No emails in {folder}</p>
            </div>
          ) : (
            emails.map(email => (
              <button
                key={email.id}
                onClick={() => handleSelectEmail(email)}
                className={`w-full text-left px-4 py-3 border-b border-[#1a1a2e] hover:bg-[#111] transition-colors ${
                  selectedEmail?.id === email.id ? 'bg-[#111] border-l-2 border-l-[#C9A84C]' : ''
                } ${!email.is_read ? 'bg-[#0d0d12]' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => handleStar(email, e)}
                    className={`mt-0.5 ${email.is_starred ? 'text-[#C9A84C]' : 'text-gray-600 hover:text-gray-400'}`}
                  >
                    <Star className="w-4 h-4" fill={email.is_starred ? '#C9A84C' : 'none'} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-white' : 'text-gray-300'}`}>
                        {email.direction === 'received' ? (email.from_name || email.from_email) : `To: ${email.to_email}`}
                      </span>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">{formatDate(email.created_at)}</span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${!email.is_read ? 'text-gray-200' : 'text-gray-400'}`}>
                      {email.subject || '(no subject)'}
                    </p>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{email.body_text?.slice(0, 80)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Email Detail / Compose */}
      <div className="flex-1 flex flex-col bg-[#0a0a0f]">
        {showCompose ? (
          /* Compose View */
          <div className="flex-1 flex flex-col p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{replyThreadId ? 'Reply' : 'New Email'}</h2>
              <button onClick={() => setShowCompose(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 flex flex-col">
              {/* To field with contact picker */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 w-12">To:</span>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={(e) => { setComposeTo(e.target.value); setContactSearch(e.target.value); setShowContactPicker(true) }}
                    onFocus={() => { if (composeTo) { setContactSearch(composeTo); setShowContactPicker(true) } }}
                    placeholder="Recipient email or search contacts..."
                    className="flex-1 px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                    required
                  />
                  <button
                    onClick={() => setShowContactPicker(!showContactPicker)}
                    className="p-2 text-gray-500 hover:text-[#C9A84C]"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>
                {showContactPicker && filteredContacts.length > 0 && (
                  <div className="absolute top-full left-12 right-12 mt-1 bg-[#111] border border-[#222] rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {filteredContacts.slice(0, 8).map(contact => (
                      <button
                        key={contact.id}
                        onClick={() => handleContactSelect(contact)}
                        className="w-full text-left px-3 py-2 hover:bg-[#1a1a1a] text-sm flex items-center justify-between"
                      >
                        <span className="text-white">{contact.full_name}</span>
                        <span className="text-gray-500 text-xs">{contact.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-12">Subj:</span>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                  className="flex-1 px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  required
                />
              </div>

              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your message..."
                className="flex-1 px-4 py-3 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 resize-none min-h-[200px]"
              />

              <div className="flex items-center justify-between">
                <Link href="/email-templates" className="text-sm text-gray-500 hover:text-[#C9A84C]">
                  Use Template
                </Link>
                <button
                  onClick={handleSend}
                  disabled={sending || !composeTo || !composeSubject || !composeBody}
                  className="flex items-center gap-2 px-6 py-2 bg-[#C9A84C] text-black rounded-lg font-medium hover:bg-[#d4b65c] disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        ) : selectedEmail ? (
          /* Email Detail View */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#1a1a2e] flex items-center justify-between">
              <h2 className="text-lg font-semibold truncate">{selectedEmail.subject || '(no subject)'}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => handleReply(selectedEmail)} className="p-2 text-gray-400 hover:text-[#C9A84C] rounded">
                  <Reply className="w-4 h-4" />
                </button>
                <button onClick={() => handleTrash(selectedEmail)} className="p-2 text-gray-400 hover:text-red-400 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {threadEmails.map(email => (
                <div key={email.id} className="bg-[#111] border border-[#222] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-medium">
                        {email.direction === 'received' ? (email.from_name || email.from_email) : 'You'}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        to {email.direction === 'received' ? 'me' : email.to_email}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(email.created_at).toLocaleString()}
                    </span>
                  </div>
                  {email.body_html ? (
                    <div
                      className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: email.body_html }}
                    />
                  ) : (
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{email.body_text}</pre>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Reply */}
            <div className="p-4 border-t border-[#1a1a2e]">
              <button
                onClick={() => handleReply(selectedEmail)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-sm text-gray-400 hover:text-white hover:border-[#C9A84C]/30"
              >
                <Reply className="w-4 h-4" />
                Reply
              </button>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">Select an email to read</p>
              <p className="text-gray-600 text-sm mt-1">or compose a new message</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
