'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Plus, Trophy, Star, TrendingUp, Award, Trash2, AlertCircle, MessageSquare } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../components/compliance-notifications'

interface Win {
  id: string
  type: 'closed_deal' | 'milestone' | 'award' | 'personal'
  title: string
  description: string
  agentId: string
  agentEmail: string
  agentName: string
  propertyAddress?: string
  dealAmount?: number
  imageUrl?: string
  celebrationType: 'celebration' | 'milestone' | 'achievement'
  likes: number
  comments: string[]
  createdAt: string
}

const WIN_TYPES = [
  { id: 'closed_deal', label: 'Closed Deal', icon: '🏠', color: 'text-green-600' },
  { id: 'milestone', label: 'Milestone', icon: '🎯', color: 'text-blue-600' },
  { id: 'award', label: 'Award', icon: '🏆', color: 'text-yellow-600' },
  { id: 'personal', label: 'Personal Achievement', icon: '⭐', color: 'text-purple-600' },
]

export default function WinsTrackerPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [wins, setWins] = useState<Win[]>([])
  const [winsLoading, setWinsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [likedWins, setLikedWins] = useState<Set<string>>(new Set())
  const [newWin, setNewWin] = useState({
    type: 'closed_deal' as const,
    title: '',
    description: '',
    propertyAddress: '',
    dealAmount: '',
    celebrationType: 'celebration' as const,
  })

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

      // Placeholder: In production, Vault API would have /api/wins endpoint
      setWins([])
    } catch (err) {
      console.error('Error loading wins:', err)
      setError(`Failed to load wins: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setWinsLoading(false)
    }
  }

  const handleAddWin = () => {
    if (!newWin.title || !newWin.description) {
      alert('Please fill in title and description')
      return
    }

    const win: Win = {
      id: `w${Date.now()}`,
      ...newWin,
      dealAmount: newWin.dealAmount ? parseInt(newWin.dealAmount) : undefined,
      agentId: user!.id,
      agentEmail: user!.email || '',
      agentName: user!.user_metadata?.full_name || user!.email || 'Agent',
      likes: 0,
      comments: [],
      createdAt: new Date().toISOString(),
    }

    setWins([win, ...wins])
    setNewWin({
      type: 'closed_deal',
      title: '',
      description: '',
      propertyAddress: '',
      dealAmount: '',
      celebrationType: 'celebration',
    })
    setShowAddForm(false)
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

    setWins(
      wins.map((w) => ({
        ...w,
        likes:
          likedWins.has(w.id) && w.id === winId
            ? w.likes - 1
            : !likedWins.has(w.id) && w.id === winId
            ? w.likes + 1
            : w.likes,
      }))
    )
  }

  const handleDeleteWin = (winId: string) => {
    if (confirm('Delete this win?')) {
      setWins(wins.filter((w) => w.id !== winId))
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Calculate leaderboard
  const leaderboard = Array.from(
    wins.reduce(
      (map, win) => {
        const key = win.agentEmail
        if (!map.has(key)) {
          map.set(key, {
            agentEmail: win.agentEmail,
            agentName: win.agentName,
            totalDeals: 0,
            totalValue: 0,
            winsCount: 0,
          })
        }
        const entry = map.get(key)!
        entry.winsCount += 1
        if (win.type === 'closed_deal') {
          entry.totalDeals += 1
          if (win.dealAmount) entry.totalValue += win.dealAmount
        }
        return map
      },
      new Map<
        string,
        {
          agentEmail: string
          agentName: string
          totalDeals: number
          totalValue: number
          winsCount: number
        }
      >()
    )
  )
    .sort((a, b) => b[1].winsCount - a[1].winsCount)
    .map(([_, value]) => value)

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
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Add Win Button */}
        <div className="mb-8">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'Cancel' : 'Share a Win'}
          </button>
        </div>

        {/* Add Win Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Share Your Win!</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type of Win *</label>
                <select
                  value={newWin.type}
                  onChange={(e) => setNewWin({ ...newWin, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {WIN_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Celebration Type</label>
                <select
                  value={newWin.celebrationType}
                  onChange={(e) => setNewWin({ ...newWin, celebrationType: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="celebration">Celebration</option>
                  <option value="milestone">Milestone</option>
                  <option value="achievement">Achievement</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  value={newWin.title}
                  onChange={(e) => setNewWin({ ...newWin, title: e.target.value })}
                  placeholder="e.g., Closed $500K Deal in Miami Beach"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  value={newWin.description}
                  onChange={(e) => setNewWin({ ...newWin, description: e.target.value })}
                  placeholder="Tell us about this win! What made it special?"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {newWin.type === 'closed_deal' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Property Address</label>
                    <input
                      type="text"
                      value={newWin.propertyAddress}
                      onChange={(e) => setNewWin({ ...newWin, propertyAddress: e.target.value })}
                      placeholder="123 Main St, Miami, FL"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Deal Amount</label>
                    <input
                      type="number"
                      value={newWin.dealAmount}
                      onChange={(e) => setNewWin({ ...newWin, dealAmount: e.target.value })}
                      placeholder="$500,000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <button
                onClick={handleAddWin}
                className="col-span-2 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Share Win
              </button>
            </div>
          </div>
        )}

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
                      <span>{agent.winsCount} wins</span>
                      {agent.totalDeals > 0 && <span>${(agent.totalValue / 1000000).toFixed(1)}M</span>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-gray-600 text-sm">No wins yet!</div>
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
                <p className="text-sm text-gray-600 mb-1">Total Wins</p>
                <p className="text-3xl font-bold text-gray-900">{wins.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">My Wins</p>
                <p className="text-3xl font-bold text-gray-900">
                  {wins.filter((w) => w.agentEmail === user?.email).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Likes</p>
                <p className="text-3xl font-bold text-gray-900">
                  {wins.reduce((sum, w) => sum + w.likes, 0)}
                </p>
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
                <p className="font-semibold text-gray-900">Share Wins</p>
                <p className="text-gray-600">Post your deals, milestones, and achievements</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Celebrate Together</p>
                <p className="text-gray-600">Like and comment on team wins</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Build Momentum</p>
                <p className="text-gray-600">Track success and inspire your team</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wins Feed */}
        <div className="space-y-6">
          {winsLoading ? (
            <div className="text-center py-12 text-gray-600">Loading wins...</div>
          ) : wins.length > 0 ? (
            wins.map((win) => {
              const winType = WIN_TYPES.find((t) => t.id === win.type)
              const isOwnWin = win.agentEmail === user?.email
              return (
                <div key={win.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                  {/* Win Header */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-2xl ${winType?.color}`}>{winType?.icon}</span>
                          <h3 className="text-xl font-bold text-gray-900">{win.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600">
                          by {win.agentName} {win.createdAt && `• ${new Date(win.createdAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      {isOwnWin && (
                        <button
                          onClick={() => handleDeleteWin(win.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Win Content */}
                  <div className="p-6">
                    <p className="text-gray-700 mb-4">{win.description}</p>

                    {win.type === 'closed_deal' && (
                      <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-1">
                        {win.propertyAddress && (
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">Property:</span> {win.propertyAddress}
                          </p>
                        )}
                        {win.dealAmount && (
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">Amount:</span> ${win.dealAmount.toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Engagement */}
                    <div className="flex gap-6 pt-4 border-t">
                      <button
                        onClick={() => handleLikeWin(win.id)}
                        className={`flex items-center gap-2 transition ${
                          likedWins.has(win.id)
                            ? 'text-red-600'
                            : 'text-gray-600 hover:text-red-600'
                        }`}
                      >
                        <Award className="w-4 h-4" />
                        <span className="text-sm">{win.likes} Likes</span>
                      </button>

                      <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm">{win.comments.length} Comments</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-4">No wins shared yet!</p>
              <p className="text-gray-500 text-sm">Share your first win to celebrate your success with the team.</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Celebrate Success</p>
              <p className="text-sm text-blue-800">
                Share your wins with the team! Post closed deals, milestones, and personal achievements. Like and comment on team wins to celebrate together and build momentum.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
