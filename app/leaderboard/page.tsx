'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import {
  ArrowLeft, Trophy, TrendingUp, Medal, Loader2, Home, PartyPopper,
  Plus, Pencil, Trash2, X, Check,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Leaderboard & Wins — Rankings + Recent Wins + Manual Win CRUD
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
  source: 'pipeline' | 'manual'
}

interface ManualWin {
  id: string
  agent_name: string
  property_address: string
  sale_price: number
  win_date: string
  win_type: string
  notes: string
}

interface WinFormData {
  agent_name: string
  property_address: string
  sale_price: string
  win_date: string
  win_type: string
  notes: string
}

const emptyForm: WinFormData = {
  agent_name: '',
  property_address: '',
  sale_price: '',
  win_date: new Date().toISOString().split('T')[0],
  win_type: 'closed_deal',
  notes: '',
}

const winTypeLabels: Record<string, string> = {
  closed_deal: 'Closed Deal',
  listing_won: 'Listing Won',
  referral: 'Referral',
  award: 'Award',
  milestone: 'Milestone',
  other: 'Other',
}

export default function LeaderboardPage() {
  const { user, role, loading: authLoading } = useAuth()
  const router = useRouter()
  const [agents, setAgents] = useState<AgentRanking[]>([])
  const [wins, setWins] = useState<WinEntry[]>([])
  const [manualWins, setManualWins] = useState<ManualWin[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'volume' | 'deals'>('volume')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingWin, setEditingWin] = useState<ManualWin | null>(null)
  const [formData, setFormData] = useState<WinFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const canManage = role === 'broker' || role === 'admin' || role === 'office_manager'

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
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('role', 'agent')

      // Get closed pipeline deals
      const { data: deals } = await supabase
        .from('pipeline')
        .select('id, agent_id, property_address, contract_price, closing_date, updated_at')
        .eq('stage', 'closed')
        .order('updated_at', { ascending: false })

      // Fetch manual wins
      let mWins: ManualWin[] = []
      try {
        const res = await fetch('/api/leaderboard?period=all')
        if (res.ok) {
          const data = await res.json()
          mWins = data.manualWins || []
        }
      } catch { /* silent */ }
      setManualWins(mWins)

      // Build agent name lookup
      const nameMap = new Map<string, string>()
      const agentMap = new Map<string, AgentRanking>()
      for (const p of profiles || []) {
        nameMap.set(p.id, p.full_name || 'Unknown Agent')
        agentMap.set(p.id, {
          id: p.id,
          full_name: p.full_name || 'Unknown Agent',
          avatar_url: p.avatar_url,
          total_volume: 0,
          deal_count: 0,
        })
      }

      const winsList: WinEntry[] = []

      // Pipeline wins
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
          source: 'pipeline',
        })
      }

      // Manual wins
      for (const mw of mWins) {
        const name = mw.agent_name || 'Unknown'
        if (mw.win_type === 'closed_deal' || mw.win_type === 'listing_won') {
          // Try to find matching agent
          const key = Array.from(agentMap.entries()).find(([_, a]) =>
            a.full_name.toLowerCase() === name.toLowerCase()
          )?.[0]

          if (key && agentMap.has(key)) {
            const agent = agentMap.get(key)!
            agent.deal_count += 1
            agent.total_volume += mw.sale_price || 0
          }
        }
        winsList.push({
          id: mw.id,
          property_address: mw.property_address,
          contract_price: mw.sale_price,
          closing_date: null,
          updated_at: mw.win_date,
          agent_name: name,
          source: 'manual',
        })
      }

      winsList.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setAgents(Array.from(agentMap.values()))
      setWins(winsList.slice(0, 30))
    } catch (e) {
      console.error('Error fetching leaderboard:', e)
    }
    setLoading(false)
  }

  // CRUD handlers
  async function handleSaveWin() {
    setSaving(true)
    try {
      const payload = {
        agent_name: formData.agent_name,
        property_address: formData.property_address,
        sale_price: parseFloat(formData.sale_price) || 0,
        win_date: formData.win_date,
        win_type: formData.win_type,
        notes: formData.notes,
      }

      let res: Response
      if (editingWin) {
        res = await fetch('/api/leaderboard', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingWin.id, ...payload }),
        })
      } else {
        res = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to save')
        setSaving(false)
        return
      }

      setShowModal(false)
      setEditingWin(null)
      setFormData(emptyForm)
      fetchData()
    } catch (err: any) {
      alert(err.message || 'Failed to save')
    }
    setSaving(false)
  }

  async function handleDeleteWin(id: string) {
    try {
      const res = await fetch(`/api/leaderboard?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to delete')
        return
      }
      setDeleteConfirm(null)
      fetchData()
    } catch (err: any) {
      alert(err.message || 'Failed to delete')
    }
  }

  function openEditModal(win: ManualWin) {
    setEditingWin(win)
    setFormData({
      agent_name: win.agent_name,
      property_address: win.property_address,
      sale_price: String(win.sale_price || ''),
      win_date: win.win_date?.split('T')[0] || '',
      win_type: win.win_type || 'closed_deal',
      notes: win.notes || '',
    })
    setShowModal(true)
  }

  function openAddModal() {
    setEditingWin(null)
    setFormData(emptyForm)
    setShowModal(true)
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
    return 'border-white/5 bg-[#0a0a0f]/[0.02]'
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-[#C9A84C]" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-400" />
    return <span className="text-sm font-bold text-gray-400 w-5 text-center">{rank}</span>
  }

  const totalDeals = sorted.reduce((s, a) => s + a.deal_count, 0)
  const totalVolume = sorted.reduce((s, a) => s + a.total_volume, 0)

  const inputCls = 'w-full bg-[#0A0A0F] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#C9A84C]/50 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/20 placeholder:text-gray-400'

  if (authLoading || !user) return null

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-lg bg-[#0a0a0f]/5 hover:bg-[#0a0a0f]/10 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Leaderboard & Wins</h1>
              <p className="text-sm text-gray-400 mt-0.5">Rankings and recent closed deals</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {canManage && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9A84C] to-[#D4AF37] text-black font-semibold text-sm hover:brightness-110 transition"
              >
                <Plus className="w-4 h-4" />
                Add Win
              </button>
            )}
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Deals</p>
              <p className="text-xl font-bold">{totalDeals}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Volume</p>
              <p className="text-xl font-bold text-[#C9A84C]">{formatCurrency(totalVolume)}</p>
            </div>
          </div>
        </div>

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
                  : 'bg-[#0a0a0f]/5 text-gray-400 hover:bg-[#0a0a0f]/10 border border-transparent'
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
            {/* Rankings */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
                Rankings
              </h2>

              {sorted.length === 0 ? (
                <div className="text-center py-16">
                  <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg font-medium">No rankings yet</p>
                  <p className="text-gray-400 text-sm mt-1">Rankings will appear as agents close deals.</p>
                  {canManage && (
                    <button onClick={openAddModal} className="mt-4 px-4 py-2 rounded-lg bg-[#C9A84C]/20 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/30 transition">
                      <Plus className="w-4 h-4 inline mr-1" /> Add First Win
                    </button>
                  )}
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
                        <div className="flex items-center justify-center w-8">{getRankBadge(rank)}</div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          rank === 1 ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-[#0a0a0f]/10 text-gray-400'
                        }`}>
                          {agent.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold truncate ${rank === 1 ? 'text-[#C9A84C]' : 'text-white'}`}>
                            {agent.full_name}
                            {isMe && <span className="text-[#2EC4D6] text-xs ml-2">(You)</span>}
                          </p>
                          <p className="text-xs text-gray-400">{agent.deal_count} deal{agent.deal_count !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-lg ${rank === 1 ? 'text-[#C9A84C]' : 'text-white'}`}>
                            {formatCurrency(agent.total_volume)}
                          </p>
                          <p className="text-xs text-gray-400">volume</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent Wins */}
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <PartyPopper className="w-4 h-4 text-[#C9A84C]" />
                Recent Wins
              </h2>

              {wins.length === 0 ? (
                <div className="text-center py-12">
                  <PartyPopper className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No closed deals to celebrate yet</p>
                  {canManage && (
                    <button onClick={openAddModal} className="mt-3 px-4 py-2 rounded-lg bg-[#C9A84C]/20 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/30 transition">
                      <Plus className="w-4 h-4 inline mr-1" /> Add a Win
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {wins.map((win) => {
                    const isManual = win.source === 'manual'
                    const manualWin = isManual ? manualWins.find(m => m.id === win.id) : null

                    return (
                      <div
                        key={`${win.source}-${win.id}`}
                        className="p-4 rounded-xl border border-white/5 bg-[#0a0a0f]/[0.02] hover:border-[#C9A84C]/30 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Home className="w-4 h-4 text-[#C9A84C] shrink-0" />
                              <p className="text-white font-semibold text-sm truncate">{win.property_address}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-gray-400 text-xs">{win.agent_name}</p>
                              {isManual && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
                                  Manual
                                </span>
                              )}
                            </div>
                          </div>

                          {canManage && isManual && manualWin ? (
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <button
                                onClick={() => openEditModal(manualWin)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-[#C9A84C] hover:bg-[#0a0a0f]/5 transition"
                              >
                                <Pencil size={14} />
                              </button>
                              {deleteConfirm === win.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleDeleteWin(win.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/100/10 transition">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => setDeleteConfirm(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-[#0a0a0f]/5 transition">
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteConfirm(win.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/100/10 transition">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <PartyPopper className="w-4 h-4 text-[#C9A84C]/60 shrink-0 ml-2" />
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <span className="text-[#C9A84C] font-bold">{formatCurrency(win.contract_price)}</span>
                          <span className="text-gray-400 text-xs">
                            {formatDate(win.closing_date || win.updated_at)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Win Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-[#121216] rounded-xl border border-white/10 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">{editingWin ? 'Edit Win' : 'Add Win'}</h2>
              <button onClick={() => { setShowModal(false); setEditingWin(null); setFormData(emptyForm) }} className="p-1 rounded-lg hover:bg-[#0a0a0f]/10 text-gray-400">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Agent Name *</label>
                <input className={inputCls} placeholder="e.g. John Smith" value={formData.agent_name} onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Property Address *</label>
                <input className={inputCls} placeholder="e.g. 123 Main St, Miami, FL" value={formData.property_address} onChange={(e) => setFormData({ ...formData, property_address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Sale Price</label>
                  <input className={inputCls} type="number" placeholder="450000" value={formData.sale_price} onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Date</label>
                  <input className={inputCls} type="date" value={formData.win_date} onChange={(e) => setFormData({ ...formData, win_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Win Type</label>
                <select className={inputCls} value={formData.win_type} onChange={(e) => setFormData({ ...formData, win_type: e.target.value })}>
                  {Object.entries(winTypeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Notes (optional)</label>
                <textarea className={`${inputCls} min-h-[60px] resize-none`} placeholder="Any details..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowModal(false); setEditingWin(null); setFormData(emptyForm) }} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
                  Cancel
                </button>
                <button
                  onClick={handleSaveWin}
                  disabled={saving || !formData.agent_name.trim() || !formData.property_address.trim()}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#C9A84C] to-[#D4AF37] text-black font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition"
                >
                  {saving ? 'Saving...' : editingWin ? 'Update Win' : 'Add Win'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
