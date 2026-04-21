'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Trophy, Star, TrendingUp, Award } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PipelineTransaction {
  id: string
  property_address: string
  city: string
  contract_price: number
  closing_date: string | null
  gci: number
  agent_amount: number
}

interface PipelineStage {
  id: string
  label: string
  count: number
  volume: number
  avgDays: number
  gci: number
  probability: number
  transactions: PipelineTransaction[]
}

interface PipelineGroup {
  id: string
  label: string
  icon: string
  stages: PipelineStage[]
  summary: {
    totalDeals: number
    totalVolume: number
    potentialGCI: number
    probableGCI: number
  }
}

interface PipelineResponse {
  pipeline: PipelineGroup[]
  totals: {
    totalDeals: number
    totalVolume: number
    potentialGCI: number
    probableGCI: number
    closedDeals: number
    closedVolume: number
  }
  role: string
  agents: { id: string; full_name: string; email: string }[]
}

interface Win {
  id: string
  type: 'closed_deal' | 'milestone'
  title: string
  description: string
  agentName: string
  agentEmail: string
  propertyAddress: string
  city: string
  dealAmount: number
  gci: number
  agentAmount: number
  closingDate: string | null
  celebrationType: 'celebration' | 'milestone'
  likes: number
  createdAt: string
  stageId: string
  stageLabel: string
  groupLabel: string
}

interface LeaderboardEntry {
  agentName: string
  agentEmail: string
  closedDeals: number
  closedVolume: number
  totalWins: number
}

const FILTER_TABS = [
  { id: 'all', label: 'All Wins' },
  { id: 'closed_deal', label: 'Closed Deals' },
  { id: 'milestone', label: 'Milestones' },
]

function stageToWinType(stageId: string): 'closed_deal' | 'milestone' {
  if (stageId === 'closed') return 'closed_deal'
  return 'milestone'
}

function stageToTitle(stageId: string): string {
  switch (stageId) {
    case 'closed': return 'Deal Closed!'
    case 'under_contract': return 'Under Contract!'
    case 'active': return 'Active Listing'
    case 'appointment': return 'Appointment Set'
    case 'cultivate': return 'New Opportunity'
    default: return 'Milestone'
  }
}

function stageToCelebrationType(stageId: string): 'celebration' | 'milestone' {
  if (stageId === 'closed') return 'celebration'
  return 'milestone'
}

function stageToEmoji(stageId: string): string {
  switch (stageId) {
    case 'closed': return '🏠'
    case 'under_contract': return '🎯'
    case 'active': return '📋'
    case 'appointment': return '📅'
    case 'cultivate': return '🌱'
    default: return '⭐'
  }
}

function stageToColor(stageId: string): string {
  switch (stageId) {
    case 'closed': return 'text-green-600'
    case 'under_contract': return 'text-blue-600'
    case 'active': return 'text-yellow-600'
    case 'appointment': return 'text-purple-600'
    case 'cultivate': return 'text-gray-600'
    default: return 'text-gray-600'
  }
}

export default function WinsTrackerPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [wins, setWins] = useState<Win[]>([])
  const [winsLoading, setWinsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [likedWins, setLikedWins] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState('all')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (user) {
      loadWins()
    }
  }, [user])

  const loadWins = async () => {
    if (!user) return

    try {
      setWinsLoading(true)
      setError(null)

      // supabase imported from @/lib/supabase
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setError('Not authenticated. Please sign in again.')
        setWinsLoading(false)
        return
      }

      // Fetch pipeline data (no agent_id filter so broker/admin sees all)
      const res = await fetch('/api/pipeline', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Pipeline API returned ${res.status}`)
      }

      const data: PipelineResponse = await res.json()
      const agentName = user.user_metadata?.full_name || user.email || 'Agent'
      const agentEmail = user.email || ''

      // Convert pipeline transactions into wins
      const allWins: Win[] = []

      for (const group of data.pipeline) {
        for (const stage of group.stages) {
          // Only create wins for meaningful stages (skip cultivate for cleaner feed)
          if (stage.id === 'cultivate') continue

          for (const tx of stage.transactions) {
            allWins.push({
              id: tx.id,
              type: stageToWinType(stage.id),
              title: stageToTitle(stage.id),
              description: buildDescription(stage.id, tx, group.label),
              agentName,
              agentEmail,
              propertyAddress: tx.property_address,
              city: tx.city,
              dealAmount: tx.contract_price || 0,
              gci: tx.gci || 0,
              agentAmount: tx.agent_amount || 0,
              closingDate: tx.closing_date,
              celebrationType: stageToCelebrationType(stage.id),
              likes: 0,
              createdAt: tx.closing_date || '',
              stageId: stage.id,
              stageLabel: stage.label,
              groupLabel: group.label,
            })
          }
        }
      }

      // Sort: closed deals first, then by date descending
      allWins.sort((a, b) => {
        // Closed deals always on top
        if (a.stageId === 'closed' && b.stageId !== 'closed') return -1
        if (a.stageId !== 'closed' && b.stageId === 'closed') return 1
        // Then under_contract
        if (a.stageId === 'under_contract' && b.stageId !== 'under_contract') return -1
        if (a.stageId !== 'under_contract' && b.stageId === 'under_contract') return 1
        // Then by date
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA
      })

      setWins(allWins)

      // Build leaderboard from pipeline data
      // For broker/admin, fetch per-agent data if agents are available
      if (data.agents && data.agents.length > 0) {
        const leaderboardEntries: LeaderboardEntry[] = []

        for (const agent of data.agents) {
          try {
            const agentRes = await fetch(`/api/pipeline?agent_id=${agent.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (agentRes.ok) {
              const agentData: PipelineResponse = await agentRes.json()
              leaderboardEntries.push({
                agentName: agent.full_name || agent.email,
                agentEmail: agent.email,
                closedDeals: agentData.totals.closedDeals,
                closedVolume: agentData.totals.closedVolume,
                totalWins: agentData.totals.totalDeals,
              })
            }
          } catch {
            // Skip agents that fail to load
          }
        }

        leaderboardEntries.sort((a, b) => {
          if (b.closedDeals !== a.closedDeals) return b.closedDeals - a.closedDeals
          return b.closedVolume - a.closedVolume
        })

        // Only show agents with at least one deal
        setLeaderboard(leaderboardEntries.filter(e => e.totalWins > 0))
      } else {
        // Agent view: just show own stats
        setLeaderboard([{
          agentName,
          agentEmail,
          closedDeals: data.totals.closedDeals,
          closedVolume: data.totals.closedVolume,
          totalWins: data.totals.totalDeals,
        }])
      }
    } catch (err) {
      console.error('Error loading wins:', err)
      setError(`Failed to load wins: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setWinsLoading(false)
    }
  }

  function buildDescription(stageId: string, tx: PipelineTransaction, groupLabel: string): string {
    const addr = tx.property_address || 'Property'
    const city = tx.city ? `, ${tx.city}` : ''
    const price = tx.contract_price ? ` - $${tx.contract_price.toLocaleString()}` : ''

    switch (stageId) {
      case 'closed':
        return `Closed ${groupLabel.toLowerCase()} transaction at ${addr}${city}${price}. Congratulations!`
      case 'under_contract':
        return `${addr}${city} is now under contract${price}. Moving toward closing!`
      case 'active':
        return `${addr}${city} is actively being worked${price}.`
      case 'appointment':
        return `Appointment set for ${addr}${city}${price}.`
      default:
        return `${groupLabel} progress at ${addr}${city}${price}.`
    }
  }

  const handleLikeWin = (winId: string) => {
    setLikedWins((prev) => {
      const newLiked = new Set(prev)
      if (newLiked.has(winId)) {
        newLiked.delete(winId)
      } else {
        newLiked.add(winId)
      }
      return newLiked
    })
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Filter wins by active tab
  const filteredWins = activeFilter === 'all'
    ? wins
    : wins.filter(w => w.type === activeFilter)

  // Stats computed from wins
  const totalClosedDeals = wins.filter(w => w.type === 'closed_deal').length
  const totalClosedVolume = wins.filter(w => w.type === 'closed_deal').reduce((sum, w) => sum + w.dealAmount, 0)
  const totalMilestones = wins.filter(w => w.type === 'milestone').length

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Wins Tracker</h1>
          </div>
          <div className="flex items-center gap-4">
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
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition ${
                activeFilter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.id === 'all' && wins.length > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {wins.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Leaderboard */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                Leaderboard
              </h2>
            </div>
            <div className="divide-y">
              {leaderboard.length > 0 ? (
                leaderboard.map((agent, index) => (
                  <div key={agent.agentEmail} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`font-bold text-lg ${
                        index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : 'text-gray-700'
                      }`}>
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-gray-900">{agent.agentName}</p>
                        <p className="text-xs text-gray-600">{agent.agentEmail}</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{agent.closedDeals} closed</span>
                      {agent.closedVolume > 0 && (
                        <span>${agent.closedVolume >= 1000000
                          ? `${(agent.closedVolume / 1000000).toFixed(1)}M`
                          : `${(agent.closedVolume / 1000).toFixed(0)}K`
                        }</span>
                      )}
                    </div>
                  </div>
                ))
              ) : winsLoading ? (
                <div className="p-4 text-gray-600 text-sm">Loading...</div>
              ) : (
                <div className="p-4 text-gray-600 text-sm">No activity yet</div>
              )}
            </div>
          </div>

          {/* Activity Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Activity Stats
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Closed Deals</p>
                <p className="text-3xl font-bold text-gray-900">{totalClosedDeals}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Closed Volume</p>
                <p className="text-3xl font-bold text-gray-900">
                  {totalClosedVolume >= 1000000
                    ? `$${(totalClosedVolume / 1000000).toFixed(1)}M`
                    : totalClosedVolume > 0
                    ? `$${(totalClosedVolume / 1000).toFixed(0)}K`
                    : '$0'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Milestones</p>
                <p className="text-3xl font-bold text-gray-900">{totalMilestones}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Pipeline</p>
                <p className="text-3xl font-bold text-gray-900">{wins.length}</p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              How It Works
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-900">Auto-Generated Wins</p>
                <p className="text-gray-600">Wins are created automatically from your pipeline activity</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Track Progress</p>
                <p className="text-gray-600">See deals move from appointment to under contract to closed</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Celebrate Together</p>
                <p className="text-gray-600">Like team wins and build momentum</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wins Feed */}
        <div className="space-y-6">
          {winsLoading ? (
            <div className="text-center py-12 text-gray-600">Loading wins...</div>
          ) : filteredWins.length > 0 ? (
            filteredWins.map((win) => {
              const isLiked = likedWins.has(win.id)
              const likeCount = win.likes + (isLiked ? 1 : 0)
              return (
                <div key={win.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                  {/* Win Header */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-2xl ${stageToColor(win.stageId)}`}>
                            {stageToEmoji(win.stageId)}
                          </span>
                          <h3 className="text-xl font-bold text-gray-900">{win.title}</h3>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {win.groupLabel}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          by {win.agentName}
                          {win.closingDate && ` • ${new Date(win.closingDate).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Win Content */}
                  <div className="p-6">
                    <p className="text-gray-700 mb-4">{win.description}</p>

                    {/* Deal Details */}
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {win.propertyAddress && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Property</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {win.propertyAddress}{win.city ? `, ${win.city}` : ''}
                            </p>
                          </div>
                        )}
                        {win.dealAmount > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Contract Price</p>
                            <p className="text-sm font-semibold text-gray-900">
                              ${win.dealAmount.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {win.gci > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">GCI</p>
                            <p className="text-sm font-semibold text-green-700">
                              ${win.gci.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        )}
                        {win.agentAmount > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Agent Amount</p>
                            <p className="text-sm font-semibold text-green-700">
                              ${win.agentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Engagement */}
                    <div className="flex gap-6 pt-4 border-t">
                      <button
                        onClick={() => handleLikeWin(win.id)}
                        className={`flex items-center gap-2 transition ${
                          isLiked
                            ? 'text-red-600'
                            : 'text-gray-600 hover:text-red-600'
                        }`}
                      >
                        <Award className="w-4 h-4" />
                        <span className="text-sm">{likeCount} {likeCount === 1 ? 'Like' : 'Likes'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-4">
                {activeFilter === 'all'
                  ? 'No pipeline activity yet!'
                  : `No ${activeFilter === 'closed_deal' ? 'closed deals' : 'milestones'} yet!`
                }
              </p>
              <p className="text-gray-500 text-sm">
                Wins are automatically generated from your pipeline activity. Add transactions to see them here.
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <div className="flex gap-3">
            <Trophy className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Pipeline-Powered Wins</p>
              <p className="text-sm text-blue-800">
                Wins are automatically generated from your pipeline activity. When a deal moves to under contract or closes, it appears here as a win. Keep your pipeline updated to track your progress!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
