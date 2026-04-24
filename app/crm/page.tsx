'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Zap, ArrowLeft, Inbox, Clock, DollarSign, AlertTriangle,
  Calendar, TrendingUp, ChevronRight, RefreshCw, Mic,
  Check, X, Target,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────────
const VAULT_API = 'https://hartfelt-vault.vercel.app/api'

// ─── Inline UI primitives (no external deps) ─────────────────────────────────────
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

// ─── Page Component ──────────────────────────────────────────────────────────────
export default function CRMPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stats
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingFollowups, setPendingFollowups] = useState(0)
  const [moneyBoard, setMoneyBoard] = useState<MoneyBoard | null>(null)

  // Sections
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])

  const [refreshing, setRefreshing] = useState(false)

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

  // ─── Quick Actions ───────────────────────────────────────────────────────────
  const quickActions = [
    { label: 'Check Inbox', href: '/crm/inbox', icon: Inbox, color: 'text-blue-400' },
    { label: 'New Follow-Up', href: '/crm/followups', icon: Clock, color: 'text-[#C9A84C]' },
    { label: 'Log Showing', href: '/crm/showings', icon: Calendar, color: 'text-green-400' },
    { label: 'Voice Command', href: '/crm/voice', icon: Mic, color: 'text-purple-400' },
  ]

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back Button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-[#C9A84C] transition-colors mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
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
            <p className="text-gray-400 text-sm ml-14">
              Inbox to Income. Never Lose Another Buyer.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
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
                  <div className={`p-1.5 rounded-md ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                {stat.value === null ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold">{stat.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Opportunity Alerts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#C9A84C]" />
                  Opportunity Alerts
                </CardTitle>
                <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
                  {loading ? '...' : opportunities.length} active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : opportunities.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No active opportunities detected</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {opportunities.map(opp => (
                    <div key={opp.id} className="p-3 rounded-lg bg-[#050507] border border-[#1a1a2e]">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-500/15 text-purple-400 text-[10px]">
                            {opp.type}
                          </Badge>
                          <span className="text-sm font-medium">{opp.contact_name}</span>
                        </div>
                        <span className="text-xs text-[#C9A84C] font-semibold">
                          {opp.confidence}% match
                        </span>
                      </div>
                      {opp.contact_email && (
                        <p className="text-xs text-gray-500 mb-1">{opp.contact_email}</p>
                      )}
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
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#C9A84C]" />
                  Upcoming Deadlines
                </CardTitle>
                <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
                  7-day view
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : deadlines.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No deadlines in the next 7 days</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {deadlines.map(dl => (
                    <div key={dl.id} className={`p-3 rounded-lg border ${deadlineBg(dl.days_remaining)}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate mr-2">{dl.property_address}</span>
                        <span className={`text-xs font-semibold whitespace-nowrap ${deadlineColor(dl.days_remaining)}`}>
                          {dl.days_remaining < 0
                            ? `${Math.abs(dl.days_remaining)}d overdue`
                            : dl.days_remaining === 0
                              ? 'Today'
                              : `${dl.days_remaining}d left`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#1a1a2e] text-gray-300 text-[10px]">
                          {dl.deadline_type}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Due {new Date(dl.due_date).toLocaleDateString()}
                        </span>
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
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#C9A84C]" />
                My Money Board
              </CardTitle>
              <Link href="/pipeline" className="text-xs text-[#C9A84C] hover:underline flex items-center gap-1">
                Full Pipeline <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
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
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#C9A84C]" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map(action => (
                <Link key={action.label} href={action.href}>
                  <div className="p-4 rounded-lg bg-[#050507] border border-[#1a1a2e] hover:border-[#C9A84C]/30 transition-colors text-center cursor-pointer group">
                    <action.icon className={`w-6 h-6 mx-auto mb-2 ${action.color} group-hover:scale-110 transition-transform`} />
                    <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{action.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
