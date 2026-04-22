'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import { ArrowLeft, Trophy, TrendingUp, Medal, Loader2, Home, PartyPopper } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Leaderboard & Wins — Combined rankings + recent closed deals
// ============================================================================

interface AgentRanking {
  id: string
  full_name: string
  avatar_url?: string
  total_volume: number
  deal_count: number
}

interface WinEntry {
  id: string
  property_address: string
  contract_price: number
  closing_date: string | null
  updated_at: string
  agent_name: string
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [agents, setAgents] = useState<AgentRanking[]>([])
  const [wins, setWins] = useState<WinEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'volume' | 'deals'>('volume')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Get all agents
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('role', 'agent')

      if (pErr) throw pErr

      // Get closed pipeline deals
      const { data: deals, error: dErr } = await supabase
        .from('pipeline')
        .select('id, agent_id, property_address, contract_price, closing_date, updated_at')
        .eq('stage', 'closed')
        .order('updated_at', { ascending: false })

      if (dErr) throw dErr

      // Build agent name lookup
      const nameMap = new Map<string, string>()
      for (const p of profiles || []) {
        nameMap.set(p.id, p.full_name || 'Unknown Agent')
      }

      // Aggregate rankings per agent
      const agentMap = new Map<string, AgentRanking>()
      for (const p of profiles || []) {
        agentMap.set(p.id, {
          id: p.id,
          full_name: p.full_name || 'Unknown Agent',
          avatar_url: p.avatar_url,
          total_volume: 0,
          deal_count: 0,
        })
      }

      // Build wins list from closed deals
      const winsList: WinEntry[] = []

      for (const deal of deals || []) {
        const agent = agentMap.get(deal.agent_id)
        if (agent) {
          agent.total_volume += Number(deal.contract_price || 0)
          agent.deal_count += 1
        }

        winsList.push({
          id: deal.id,
          property_address: deal.property_address || 'Address TBD',
          contract_price: deal.contract_price || 0,
          closing_date: deal.closing_date,
          updated_at: deal.updated_at,
          agent_name: nameMap.get(deal.agent_id) || 'Unknown Agent',
        })
      }

      setAgents(Array.from(agentMap.values()))
      setWins(winsList.slice(0, 30))
    } catch (e) {
      console.error('Error fetching leaderboard:', e)
    }
    setLoading(false)
  }

  const sorted = [...agents]
    .filter(a => a.deal_count > 0)
    .sort((a, b) =>
      sortBy === 'volume'
        ? b.total_volume - a.total_volume
        : b.deal_count - a.deal_count
    )

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`
    return `$${val.toLocaleString()}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'border-[#C9A84C]/50 bg-[#C9A84C]/10'
    if (rank === 2) return 'border-gray-400/30 bg-gray-400/5'
    if (rank === 3) return 'border-amber-700/30 bg-amber-700/5'
    return 'border-white/5 bg-white/[0.02]'
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-[#C9A84C]" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-700" />
    return <span className="text-sm font-bold text-gray-500 w-5 text-center">{rank}</span>
  }

  // Totals
  const totalDeals = sorted.reduce((s, a) => s + a.deal_count, 0)
  const totalVolume = sorted.reduce((s, a) => s + a.total_volume, 0)

  if (authLoading || !user) return null

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Leaderboard & Wins</h1>
              <p className="text-sm text-gray-400 mt-0.5">Rankings and recent closed deals</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Deals</p>
              <p className="text-xl font-bold">{totalDeals}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Volume</p>
              <p className="text-xl font-bold text-[#C9A84C]">{formatCurrency(totalVolume)}</p>
            </div>
          </div>
        </div>

        {/* Sort Tabs */}
        <div className="flex gap-2 mt-4">
          {([
            { key: 'volume' as const, label: 'By Volume', icon: TrendingUp },
            { key: 'deals' as const, label: 'By Deals', icon: Trophy },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setSortBy(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                sortBy === tab.key
                  ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
          </div>
        ) : (
          <>
            {/* ─── Rankings ─── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
                Rankings
              </h2>

              {sorted.length === 0 ? (
                <div className="text-center py-16">
                  <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg font-medium">No rankings yet</p>
                  <p className="text-gray-500 text-sm mt-1">Rankings will appear as agents close deals.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sorted.map((agent, idx) => {
                    const rank = idx + 1
                    const isMe = agent.id === user.id
                    return (
                      <div
                        key={agent.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition ${getRankStyle(rank)} ${
                          isMe ? 'ring-1 ring-[#2EC4D6]/40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-center w-8">
                          {getRankBadge(rank)}
                        </div>

                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          rank === 1 ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-white/10 text-gray-300'
                        }`}>
                          {agent.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold truncate ${rank === 1 ? 'text-[#C9A84C]' : 'text-white'}`}>
                            {agent.full_name}
                            {isMe && <span className="text-[#2EC4D6] text-xs ml-2">(You)</span>}
                          </p>
                          <p className="text-xs text-gray-500">{agent.deal_count} deal{agent.deal_count !== 1 ? 's' : ''}</p>
                        </div>

                        <div className="text-right">
                          <p className={`font-bold text-lg ${rank === 1 ? 'text-[#C9A84C]' : 'text-white'}`}>
                            {formatCurrency(agent.total_volume)}
                          </p>
                          <p className="text-xs text-gray-500">volume</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ─── Recent Wins ─── */}
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <PartyPopper className="w-4 h-4 text-[#C9A84C]" />
                Recent Wins
              </h2>

              {wins.length === 0 ? (
                <div className="text-center py-12">
                  <PartyPopper className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No closed deals to celebrate yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {wins.map((win) => (
                    <div
                      key={win.id}
                      className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-[#C9A84C]/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Home className="w-4 h-4 text-[#C9A84C] shrink-0" />
                            <p className="text-white font-semibold text-sm truncate">{win.property_address}</p>
                          </div>
                          <p className="text-gray-500 text-xs">{win.agent_name}</p>
                        </div>
                        <PartyPopper className="w-4 h-4 text-[#C9A84C]/60 shrink-0 ml-2" />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-[#C9A84C] font-bold">{formatCurrency(win.contract_price)}</span>
                        <span className="text-gray-500 text-xs">
                          {formatDate(win.closing_date || win.updated_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
