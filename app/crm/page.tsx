'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Zap, ArrowLeft, Inbox, Clock, DollarSign, AlertTriangle,
  Calendar, TrendingUp, ChevronRight, RefreshCw, Mic, MicOff,
  Check, X, Target, MapPin, Phone, Mail, MessageSquare,
  Send, Loader2, Users,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────────
const VAULT_API = 'https://hartfelt-vault.vercel.app/api'

// ─── Inline UI primitives ────────────────────────────────────────────────────────
const Card = ({ children, className = '', ...props }: any) => (
  <div className={`rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] shadow-sm shadow-black/10 ${className}`} {...props}>{children}</div>
)
const CardHeader = ({ children, className = '', ...props }: any) => (
  <div className={`p-6 pb-2 ${className}`} {...props}>{children}</div>
)
const CardTitle = ({ children, className = '', ...props }: any) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>{children}</h3>
)
const CardContent = ({ children, className = '', ...props }: any) => (
  <div className={`p-6 pt-2 ${className}`} {...props}>{children}</div>
)
const Button = ({ children, className = '', variant = 'default', size = 'default', disabled, ...props }: any) => {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none'
  const variants: Record<string, string> = {
    default: 'bg-[#C9A84C] text-black hover:bg-[#b8973f]',
    outline: 'border border-[#1a1a2e] bg-[#0a0a0f] hover:bg-[#111] text-gray-200',
    ghost: 'hover:bg-[#111] text-gray-200',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  }
  const sizes: Record<string, string> = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10',
  }
  return <button className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`} disabled={disabled} {...props}>{children}</button>
}
const Badge = ({ children, className = '', ...props }: any) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`} {...props}>{children}</span>
)

// ─── Modal ──────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-[#1a1a2e] bg-[#0a0a0f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1a1a2e] px-6 py-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/5 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#1a1a2e] ${className}`} />
}

// ─── Types ───────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: string
  type: string
  contact_name: string
  contact_email?: string
  confidence: number
  suggested_action: string
  created_at: string
}

interface Deadline {
  id: string
  property_address: string
  deadline_type: string
  due_date: string
  days_remaining: number
  status: string
}

interface MoneyBoard {
  active_deals: number
  pipeline_value: number
  mtd_closed: number
  pending_commission: number
  projected_income: number
}

interface VoiceResult {
  intent: string
  entity: string | null
  params: Record<string, any>
  confirmationText: string
}

// ─── Page Component ──────────────────────────────────────────────────────────────
export default function CRMPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingFollowups, setPendingFollowups] = useState(0)
  const [moneyBoard, setMoneyBoard] = useState<MoneyBoard | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [refreshing, setRefreshing] = useState(false)

  /* ---------- modal state ---------- */
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [showShowing, setShowShowing] = useState(false)
  const [showVoice, setShowVoice] = useState(false)

  /* ---------- follow-up form ---------- */
  const [fuContactName, setFuContactName] = useState('')
  const [fuType, setFuType] = useState<'call' | 'email' | 'text' | 'meeting'>('call')
  const [fuDate, setFuDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [fuNotes, setFuNotes] = useState('')
  const [fuPriority, setFuPriority] = useState(3)
  const [fuSubmitting, setFuSubmitting] = useState(false)
  const [fuSuccess, setFuSuccess] = useState(false)
  const [fuError, setFuError] = useState('')

  /* ---------- showing form ---------- */
  const [shAddress, setShAddress] = useState('')
  const [shClient, setShClient] = useState('')
  const [shDate, setShDate] = useState(() => new Date().toISOString().split('T')[0])
  const [shTime, setShTime] = useState('10:00')
  const [shNotes, setShNotes] = useState('')
  const [shSubmitting, setShSubmitting] = useState(false)
  const [shSuccess, setShSuccess] = useState(false)
  const [shError, setShError] = useState('')

  /* ---------- voice command ---------- */
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceProcessing, setVoiceProcessing] = useState(false)
  const [voiceResult, setVoiceResult] = useState<VoiceResult | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  const inputClass = 'w-full rounded-lg border border-[#1a1a2e] bg-[#050507] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A84C]/40 transition'
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1.5'

  /* ---------- data fetcher ---------- */
  const fetchAll = useCallback(async () => {
    try {
      const [inboxRes, followupsRes, moneyRes, oppsRes, deadlinesRes] = await Promise.allSettled([
        fetch(`${VAULT_API}/crm/inbox`),
        fetch(`${VAULT_API}/crm/followups?status=pending`),
        fetch(`${VAULT_API}/crm/money-board`),
        fetch(`${VAULT_API}/crm/opportunities?status=active`),
        fetch(`${VAULT_API}/crm/contract-watchdog?days_ahead=7`),
      ])

      if (inboxRes.status === 'fulfilled' && inboxRes.value.ok) {
        const data = await inboxRes.value.json()
        setUnreadCount(data.unread_count ?? data.data?.length ?? 0)
      }
      if (followupsRes.status === 'fulfilled' && followupsRes.value.ok) {
        const data = await followupsRes.value.json()
        setPendingFollowups(data.pending_count ?? data.data?.length ?? 0)
      }
      if (moneyRes.status === 'fulfilled' && moneyRes.value.ok) {
        const data = await moneyRes.value.json()
        const board = data.data ?? data
        setMoneyBoard({
          active_deals: board.active_deals ?? 0,
          pipeline_value: board.pipeline_value ?? 0,
          mtd_closed: board.mtd_closed ?? 0,
          pending_commission: board.pending_commission ?? 0,
          projected_income: board.projected_income ?? 0,
        })
      }
      if (oppsRes.status === 'fulfilled' && oppsRes.value.ok) {
        const data = await oppsRes.value.json()
        setOpportunities(data.data ?? data.opportunities ?? [])
      }
      if (deadlinesRes.status === 'fulfilled' && deadlinesRes.value.ok) {
        const data = await deadlinesRes.value.json()
        setDeadlines(data.data ?? data.deadlines ?? [])
      }
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load CRM data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) setVoiceSupported(false)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  const handleDismissOpportunity = (id: string) => {
    setOpportunities(prev => prev.filter(o => o.id !== id))
  }

  const handleConvertOpportunity = (id: string) => {
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, type: 'converted' } : o))
  }

  const deadlineColor = (days: number) => {
    if (days < 0) return 'text-red-400'
    if (days <= 3) return 'text-yellow-400'
    return 'text-green-400'
  }

  const deadlineBg = (days: number) => {
    if (days < 0) return 'bg-red-500/10 border-red-500/20'
    if (days <= 3) return 'bg-yellow-500/10 border-yellow-500/20'
    return 'bg-green-500/10 border-green-500/20'
  }

  /* ---------- follow-up submit ---------- */
  async function handleFollowUpSubmit() {
    if (!fuContactName.trim() || !fuDate) {
      setFuError('Please enter a contact name and date.')
      return
    }
    setFuSubmitting(true); setFuError(''); setFuSuccess(false)
    try {
      // Use voice API to create a structured follow-up action
      const res = await fetch(`${VAULT_API}/crm/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: `Schedule a ${fuType} follow-up with ${fuContactName} on ${fuDate}${fuNotes ? `. Notes: ${fuNotes}` : ''}. Priority ${fuPriority}.`,
          context: { screen: 'agent_deal_concierge' },
        }),
      })
      if (!res.ok) throw new Error('Failed to create follow-up')
      setFuSuccess(true)
      fetchAll()
      setTimeout(() => { setShowFollowUp(false); setFuSuccess(false); setFuNotes(''); setFuContactName('') }, 1500)
    } catch (err: any) {
      setFuError(err.message || 'Something went wrong')
    } finally {
      setFuSubmitting(false)
    }
  }

  /* ---------- showing submit ---------- */
  async function handleShowingSubmit() {
    if (!shAddress) { setShError('Please enter a property address.'); return }
    setShSubmitting(true); setShError(''); setShSuccess(false)
    try {
      const res = await fetch(`${VAULT_API}/crm/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: `Log a showing at ${shAddress}${shClient ? ` with ${shClient}` : ''} on ${shDate} at ${shTime}${shNotes ? `. Notes: ${shNotes}` : ''}`,
          context: { screen: 'agent_deal_concierge' },
        }),
      })
      if (!res.ok) throw new Error('Failed to log showing')
      setShSuccess(true)
      setTimeout(() => { setShowShowing(false); setShSuccess(false); setShAddress(''); setShClient(''); setShNotes('') }, 1500)
    } catch (err: any) {
      setShError(err.message || 'Something went wrong')
    } finally {
      setShSubmitting(false)
    }
  }

  /* ---------- voice command ---------- */
  function startListening() {
    setVoiceError(''); setVoiceResult(null); setVoiceTranscript('')
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setVoiceError('Speech recognition not supported. Try Chrome.'); return }
    const recognition = new SR()
    recognition.continuous = false; recognition.interimResults = true; recognition.lang = 'en-US'
    recognition.onresult = (event: any) => {
      let t = ''
      for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript
      setVoiceTranscript(t)
    }
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') setVoiceError('Microphone access denied.')
      else if (event.error === 'no-speech') setVoiceError('No speech detected.')
      else setVoiceError(`Speech error: ${event.error}`)
      setVoiceListening(false)
    }
    recognition.onend = () => setVoiceListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setVoiceListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setVoiceListening(false)
  }

  async function processVoiceCommand() {
    if (!voiceTranscript.trim()) { setVoiceError('No transcript. Please speak a command.'); return }
    setVoiceProcessing(true); setVoiceError(''); setVoiceResult(null)
    try {
      const res = await fetch(`${VAULT_API}/crm/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: voiceTranscript, context: { screen: 'agent_deal_concierge' } }),
      })
      if (!res.ok) throw new Error('Failed to process voice command')
      setVoiceResult(await res.json())
    } catch (err: any) {
      setVoiceError(err.message || 'Failed to process command')
    } finally {
      setVoiceProcessing(false)
    }
  }

  const intentMeta: Record<string, { icon: any; label: string; color: string }> = {
    add_note: { icon: MessageSquare, label: 'Add Note', color: 'text-blue-400' },
    schedule_followup: { icon: Calendar, label: 'Schedule Follow-up', color: 'text-green-400' },
    send_message: { icon: Send, label: 'Send Message', color: 'text-purple-400' },
    create_task: { icon: Clock, label: 'Create Task', color: 'text-orange-400' },
    lookup_contact: { icon: Users, label: 'Lookup Contact', color: 'text-cyan-400' },
    get_status: { icon: TrendingUp, label: 'Get Status', color: 'text-yellow-400' },
    log_showing: { icon: MapPin, label: 'Log Showing', color: 'text-pink-400' },
    set_reminder: { icon: Clock, label: 'Set Reminder', color: 'text-indigo-400' },
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-[#C9A84C] transition-colors mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20">
                <Zap className="w-6 h-6 text-[#C9A84C]" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">Deal Concierge AI</h1>
            </div>
            <p className="text-gray-400 text-sm ml-14">Inbox to Income. Never Lose Another Buyer.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Unread Messages', value: loading ? null : unreadCount, icon: Inbox, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Pending Follow-ups', value: loading ? null : pendingFollowups, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { label: 'Active Deals', value: loading ? null : (moneyBoard?.active_deals ?? 0), icon: Target, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: 'Pipeline Value', value: loading ? null : formatCurrency(moneyBoard?.pipeline_value ?? 0), icon: DollarSign, color: 'text-[#C9A84C]', bg: 'bg-[#C9A84C]/10' },
          ].map((stat, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{stat.label}</span>
                  <div className={`p-1.5 rounded-md ${stat.bg}`}><stat.icon className={`w-4 h-4 ${stat.color}`} /></div>
                </div>
                {stat.value === null ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{stat.value}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Opportunity Alerts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#C9A84C]" /> Opportunity Alerts</CardTitle>
                <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">{loading ? '...' : opportunities.length} active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : opportunities.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No active opportunities detected</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {opportunities.map(opp => (
                    <div key={opp.id} className="p-3 rounded-lg bg-[#050507] border border-[#1a1a2e]">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-500/15 text-purple-400 text-[10px]">{opp.type}</Badge>
                          <span className="text-sm font-medium">{opp.contact_name}</span>
                        </div>
                        <span className="text-xs text-[#C9A84C] font-semibold">{opp.confidence}% match</span>
                      </div>
                      {opp.contact_email && <p className="text-xs text-gray-500 mb-1">{opp.contact_email}</p>}
                      <p className="text-xs text-gray-400 mb-3">{opp.suggested_action}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleDismissOpportunity(opp.id)} className="text-gray-400 hover:text-red-400">
                          <X className="w-3 h-3 mr-1" /> Dismiss
                        </Button>
                        <Button size="sm" onClick={() => handleConvertOpportunity(opp.id)} className="text-xs">
                          <Check className="w-3 h-3 mr-1" /> Convert
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-[#C9A84C]" /> Upcoming Deadlines</CardTitle>
                <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">7-day view</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : deadlines.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No deadlines in the next 7 days</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {deadlines.map(dl => (
                    <div key={dl.id} className={`p-3 rounded-lg border ${deadlineBg(dl.days_remaining)}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate mr-2">{dl.property_address}</span>
                        <span className={`text-xs font-semibold whitespace-nowrap ${deadlineColor(dl.days_remaining)}`}>
                          {dl.days_remaining < 0 ? `${Math.abs(dl.days_remaining)}d overdue` : dl.days_remaining === 0 ? 'Today' : `${dl.days_remaining}d left`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#1a1a2e] text-gray-300 text-[10px]">{dl.deadline_type}</Badge>
                        <span className="text-xs text-gray-500">Due {new Date(dl.due_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* My Money Board */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#C9A84C]" /> My Money Board</CardTitle>
              <Link href="/pipeline" className="text-xs text-[#C9A84C] hover:underline flex items-center gap-1">Full Pipeline <ChevronRight className="w-3 h-3" /></Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-[#050507] border border-[#1a1a2e] text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">MTD Closed</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(moneyBoard?.mtd_closed ?? 0)}</p>
                </div>
                <div className="p-4 rounded-lg bg-[#050507] border border-[#1a1a2e] text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pending Commission</p>
                  <p className="text-2xl font-bold text-yellow-400">{formatCurrency(moneyBoard?.pending_commission ?? 0)}</p>
                </div>
                <div className="p-4 rounded-lg bg-[#050507] border border-[#1a1a2e] text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Projected Income</p>
                  <p className="text-2xl font-bold text-[#C9A84C]">{formatCurrency(moneyBoard?.projected_income ?? 0)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-[#C9A84C]" /> Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link href="/crm/inbox">
                <div className="p-4 rounded-lg bg-[#050507] border border-[#1a1a2e] hover:border-[#C9A84C]/30 transition-colors text-center cursor-pointer group">
                  <Inbox className="w-6 h-6 mx-auto mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs text-gray-300 group-hover:text-white transition-colors">Check Inbox</span>
                </div>
              </Link>
              <div onClick={() => { setFuError(''); setFuSuccess(false); setShowFollowUp(true) }} className="p-4 rounded-lg bg-[#050507] border border-[#1a1a2e] hover:border-[#C9A84C]/30 transition-colors text-center cursor-pointer group">
                <Clock className="w-6 h-6 mx-auto mb-2 text-[#C9A84C] group-hover:scale-110 transition-transform" />
                <span className="text-xs text-gray-300 group-hover:text-white transition-colors">New Follow-Up</span>
              </div>
              <div onClick={() => { setShError(''); setShSuccess(false); setShowShowing(true) }} className="p-4 rounded-lg bg-[#050507] border border-[#1a1a2e] hover:border-[#C9A84C]/30 transition-colors text-center cursor-pointer group">
                <MapPin className="w-6 h-6 mx-auto mb-2 text-green-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs text-gray-300 group-hover:text-white transition-colors">Log Showing</span>
              </div>
              <div onClick={() => { setVoiceError(''); setVoiceResult(null); setVoiceTranscript(''); setShowVoice(true) }} className="p-4 rounded-lg bg-[#050507] border border-[#1a1a2e] hover:border-[#C9A84C]/30 transition-colors text-center cursor-pointer group">
                <Mic className="w-6 h-6 mx-auto mb-2 text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs text-gray-300 group-hover:text-white transition-colors">Voice Command</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/*  FOLLOW-UP MODAL                                                 */}
      {/* ================================================================ */}
      <Modal open={showFollowUp} onClose={() => setShowFollowUp(false)} title="New Follow-Up">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Contact Name</label>
            <input type="text" value={fuContactName} onChange={e => setFuContactName(e.target.value)} placeholder="Enter contact name" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['call', 'email', 'text', 'meeting'] as const).map(t => {
                const icons = { call: Phone, email: Mail, text: MessageSquare, meeting: Users }
                const Icon = icons[t]
                return (
                  <button key={t} onClick={() => setFuType(t)} className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition ${fuType === t ? 'border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#1a1a2e] text-gray-400 hover:border-gray-600 hover:text-white'}`}>
                    <Icon size={16} />{t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Due Date</label>
              <input type="date" value={fuDate} onChange={e => setFuDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Priority (1-5)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(p => (
                  <button key={p} onClick={() => setFuPriority(p)} className={`flex-1 rounded-lg border py-2.5 text-xs font-semibold transition ${fuPriority === p ? (p >= 4 ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C]') : 'border-[#1a1a2e] text-gray-500 hover:border-gray-600 hover:text-white'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea value={fuNotes} onChange={e => setFuNotes(e.target.value)} rows={3} placeholder="Follow-up notes..." className={inputClass + ' resize-none'} />
          </div>
          {fuError && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs text-red-300">{fuError}</div>}
          {fuSuccess && <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-xs text-green-300"><Check size={14} /> Follow-up created!</div>}
          <button onClick={handleFollowUpSubmit} disabled={fuSubmitting || fuSuccess} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#d4b35a] disabled:opacity-50">
            {fuSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
            {fuSubmitting ? 'Creating...' : 'Create Follow-Up'}
          </button>
        </div>
      </Modal>

      {/* ================================================================ */}
      {/*  LOG SHOWING MODAL                                               */}
      {/* ================================================================ */}
      <Modal open={showShowing} onClose={() => setShowShowing(false)} title="Log Showing">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Property Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" value={shAddress} onChange={e => setShAddress(e.target.value)} placeholder="123 Main St, City, State" className={inputClass + ' pl-9'} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Client Name (optional)</label>
            <input type="text" value={shClient} onChange={e => setShClient(e.target.value)} placeholder="Client name" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Date</label><input type="date" value={shDate} onChange={e => setShDate(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Time</label><input type="time" value={shTime} onChange={e => setShTime(e.target.value)} className={inputClass} /></div>
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea value={shNotes} onChange={e => setShNotes(e.target.value)} rows={2} placeholder="Showing notes..." className={inputClass + ' resize-none'} />
          </div>
          {shError && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs text-red-300">{shError}</div>}
          {shSuccess && <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-xs text-green-300"><Check size={14} /> Showing logged!</div>}
          <button onClick={handleShowingSubmit} disabled={shSubmitting || shSuccess} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#d4b35a] disabled:opacity-50">
            {shSubmitting ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
            {shSubmitting ? 'Logging...' : 'Log Showing'}
          </button>
        </div>
      </Modal>

      {/* ================================================================ */}
      {/*  VOICE COMMAND MODAL                                             */}
      {/* ================================================================ */}
      <Modal open={showVoice} onClose={() => { setShowVoice(false); stopListening() }} title="Voice Command">
        <div className="space-y-5">
          {!voiceSupported ? (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300">
              Speech recognition is not supported in this browser. Please use Chrome or Edge.
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-4">
                <p className="text-xs text-gray-400 text-center">
                  {voiceListening ? 'Listening... Speak your command' : 'Tap the mic and speak a command like:'}
                </p>
                {!voiceListening && !voiceTranscript && (
                  <div className="space-y-1 text-center">
                    <p className="text-xs text-gray-500 italic">&quot;Schedule a follow-up with Marcus for Friday&quot;</p>
                    <p className="text-xs text-gray-500 italic">&quot;Log a showing at 123 Main St&quot;</p>
                    <p className="text-xs text-gray-500 italic">&quot;How many deals do I have pending?&quot;</p>
                  </div>
                )}
                <button onClick={voiceListening ? stopListening : startListening} className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-all ${voiceListening ? 'bg-red-500/20 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-[#C9A84C]/10 border-2 border-[#C9A84C]/30 hover:border-[#C9A84C] hover:shadow-[0_0_20px_rgba(201,168,76,0.2)]'}`}>
                  {voiceListening ? (
                    <><MicOff size={28} className="text-red-400" /><span className="absolute inset-0 animate-ping rounded-full border-2 border-red-500/30" /></>
                  ) : (
                    <Mic size={28} className="text-[#C9A84C]" />
                  )}
                </button>
                <p className="text-[11px] text-gray-500">{voiceListening ? 'Tap to stop' : 'Tap to start'}</p>
              </div>

              {voiceTranscript && (
                <div className="space-y-2">
                  <label className={labelClass}>What I heard:</label>
                  <textarea value={voiceTranscript} onChange={e => setVoiceTranscript(e.target.value)} rows={2} className={inputClass + ' resize-none text-xs'} />
                  <button onClick={processVoiceCommand} disabled={voiceProcessing} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#d4b35a] disabled:opacity-50">
                    {voiceProcessing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    {voiceProcessing ? 'Processing with AI...' : 'Process Command'}
                  </button>
                </div>
              )}

              {!voiceListening && !voiceTranscript && (
                <div>
                  <label className={labelClass}>Or type a command:</label>
                  <div className="flex gap-2">
                    <input type="text" value={voiceTranscript} onChange={e => setVoiceTranscript(e.target.value)} placeholder="Type your command..." className={inputClass + ' flex-1'} onKeyDown={e => { if (e.key === 'Enter' && voiceTranscript.trim()) processVoiceCommand() }} />
                    <button onClick={processVoiceCommand} disabled={!voiceTranscript.trim() || voiceProcessing} className="rounded-lg bg-[#C9A84C] px-4 text-sm font-semibold text-black transition hover:bg-[#d4b35a] disabled:opacity-50">
                      {voiceProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {voiceResult && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-400" />
                    <span className="text-sm font-semibold text-green-300">Command Understood</span>
                  </div>
                  <p className="text-sm text-white">{voiceResult.confirmationText}</p>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const meta = intentMeta[voiceResult.intent] || { icon: Zap, label: voiceResult.intent, color: 'text-gray-400' }
                      const Icon = meta.icon
                      return <><Icon size={14} className={meta.color} /><span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span></>
                    })()}
                  </div>
                  <button onClick={() => { setVoiceResult(null); setVoiceTranscript('') }} className="text-xs text-[#C9A84C] hover:text-[#d4b35a] transition">
                    Try another command
                  </button>
                </div>
              )}
            </>
          )}
          {voiceError && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs text-red-300">{voiceError}</div>}
        </div>
      </Modal>
    </div>
  )
}
