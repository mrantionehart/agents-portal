'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Users, TrendingUp, DollarSign, AlertCircle, BarChart3, Search, Filter } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../components/compliance-notifications'

interface Agent {
  id: string
  email: string
  name: string
  role: string
}

interface Deal {
  id: string
  property_address: string
  client_name: string
  contract_price: number
  stage: string
  status: string
  created_at: string
  closing_date?: string
  agent_id: string
  notes?: string
}

interface AgentStats {
  agentId: string
  agentName: string
  agentEmail: string
  totalLeads: number
  totalDeals: number
  dealsPipeline: number
  dealsCompleted: number
  totalCommissions: number
  earnedAmount: number
  leads: any[]
  deals: any[]
}

interface BrokerageStats {
  totalAgents: number
  totalLeads: number
  totalDeals: number
  dealsPipeline: number
  dealsCompleted: number
  totalCommissions: number
  totalEarned: number
}

const PIPELINE_STAGES = [
  { id: 'new', label: 'New Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'showing', label: 'Showing' },
  { id: 'offer', label: 'Offer Sent' },
  { id: 'contract', label: 'Under Contract' },
  { id: 'inspection', label: 'Inspection' },
  { id: 'clear', label: 'Clear to Close' },
  { id: 'closed', label: 'Closed' },
]

export default function BrokeragePage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentStats, setAgentStats] = useState<Map<string, AgentStats>>(new Map())
  const [brokerageStats, setBrokerageStats] = useState<BrokerageStats>({
    totalAgents: 0,
    totalLeads: 0,
    totalDeals: 0,
    dealsPipeline: 0,
    dealsCompleted: 0,
    totalCommissions: 0,
    totalEarned: 0,
  })
  const [allDeals, setAllDeals] = useState<Deal[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'agents' | 'deals' | 'commissions'>('overview')

  useEffect(() => {
    if (user && (role === 'broker' || role === 'admin')) {
      loadBrokerageData()
    }
  }, [user, role])

  const loadBrokerageData = async () => {
    if (!user || (role !== 'broker' && role !== 'admin')) return

    try {
      setDataLoading(true)
      setError(null)

      // Fetch all deals via Vault API
      const result = await vaultAPI.deals.list(user.id, role)
      const dealsArray = Array.isArray(result) ? result : result.deals || []

      // Store all deals
      setAllDeals(dealsArray)

      // Extract unique agents from deals
      const uniqueAgents = Array.from(
        new Map(
          dealsArray
            .filter((d: Deal) => d.agent_id)
            .map((d: Deal) => [d.agent_id, { id: d.agent_id, email: '', name: '', role: 'agent' }])
        ).values()
      ) as Agent[]
      setAgents(uniqueAgents)

      // Calculate brokerage stats
      const stats: BrokerageStats = {
        totalAgents: new Set(dealsArray.map((d: Deal) => d.agent_id)).size,
        totalLeads: 0,
        totalDeals: dealsArray.length,
        dealsPipeline: dealsArray.filter((d: Deal) => (d.stage || d.status) !== 'closed').length,
        dealsCompleted: dealsArray.filter((d: Deal) => (d.stage || d.status) === 'closed').length,
        totalCommissions: 0,
        totalEarned: 0,
      }

      setBrokerageStats(stats)
    } catch (err) {
      console.error('Error loading brokerage data:', err)
      setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDataLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  // Only allow brokers and admins
  if (!user || (role !== 'broker' && role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">Only brokers and admins can access this page.</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
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
            <h1 className="text-2xl font-bold text-gray-900">Brokerage Management</h1>
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

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 border-b border-gray-200">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              viewMode === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setViewMode('agents')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              viewMode === 'agents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Agents
          </button>
          <button
            onClick={() => setViewMode('deals')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              viewMode === 'deals'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All Deals
          </button>
          <button
            onClick={() => setViewMode('commissions')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              viewMode === 'commissions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Commissions
          </button>
        </div>

        {/* Overview Section */}
        {viewMode === 'overview' && (
          <>
            {/* Brokerage Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Total Agents</p>
                    <p className="text-3xl font-bold text-gray-900">{brokerageStats.totalAgents}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-1">All Deals</p>
                    <p className="text-3xl font-bold text-gray-900">{brokerageStats.totalDeals}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-1">In Pipeline</p>
                    <p className="text-3xl font-bold text-gray-900">{brokerageStats.dealsPipeline}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-orange-500 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Commissions</p>
                    <p className="text-3xl font-bold text-gray-900">${(brokerageStats.totalEarned / 1000).toFixed(1)}K</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-purple-500 opacity-20" />
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4">Deal Status Breakdown</h3>
                <div className="space-y-3">
                  {PIPELINE_STAGES.map((stage) => (
                    <div key={stage.id} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{stage.label}</span>
                      <span className="font-semibold text-gray-900">0</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4">Top Performers</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">No agents data</p>
                      <p className="text-sm text-gray-600">Agents will appear here once data loads</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Agents Section */}
        {viewMode === 'agents' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Team Agents</h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600">No agents loaded yet. Vault API integration needed for /api/agents endpoint.</p>
            </div>
          </div>
        )}

        {/* All Deals Section */}
        {viewMode === 'deals' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">All Brokerage Deals</h2>
                <p className="text-sm text-gray-600">{allDeals.length} total deals</p>
              </div>

              {/* Search and Filter Controls */}
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-64 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by property address or client name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={selectedAgent || ''}
                  onChange={(e) => setSelectedAgent(e.target.value || null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                >
                  <option value="">All Agents</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.email || agent.id}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStage || ''}
                  onChange={(e) => setSelectedStage(e.target.value || null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                >
                  <option value="">All Stages</option>
                  {PIPELINE_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {dataLoading ? (
              <div className="p-6 text-center text-gray-600">Loading deals...</div>
            ) : allDeals.length === 0 ? (
              <div className="p-6 text-center text-gray-600">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>No deals in the brokerage yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Property Address</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Client Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Contract Price</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Stage</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Agent ID</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Closing Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDeals
                      .filter((deal) => {
                        const matchesSearch =
                          !searchTerm ||
                          deal.property_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          deal.client_name.toLowerCase().includes(searchTerm.toLowerCase())

                        const matchesAgent = !selectedAgent || deal.agent_id === selectedAgent
                        const matchesStage = !selectedStage || (deal.stage || deal.status) === selectedStage

                        return matchesSearch && matchesAgent && matchesStage
                      })
                      .map((deal) => {
                        const stageConfig = PIPELINE_STAGES.find((s) => s.id === (deal.stage || deal.status))
                        const stageColors: Record<string, { bg: string; text: string }> = {
                          new: { bg: 'bg-blue-100', text: 'text-blue-900' },
                          contacted: { bg: 'bg-purple-100', text: 'text-purple-900' },
                          showing: { bg: 'bg-orange-100', text: 'text-orange-900' },
                          offer: { bg: 'bg-yellow-100', text: 'text-yellow-900' },
                          contract: { bg: 'bg-green-100', text: 'text-green-900' },
                          inspection: { bg: 'bg-teal-100', text: 'text-teal-900' },
                          clear: { bg: 'bg-cyan-100', text: 'text-cyan-900' },
                          closed: { bg: 'bg-amber-100', text: 'text-amber-900' },
                        }
                        const colors = stageColors[deal.stage || deal.status] || { bg: 'bg-gray-100', text: 'text-gray-900' }

                        return (
                          <tr
                            key={deal.id}
                            className="border-t border-gray-200 hover:bg-gray-50 transition cursor-pointer"
                            onClick={() => router.push(`/deals/${deal.id}`)}
                          >
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium truncate max-w-xs">
                              {deal.property_address}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">{deal.client_name}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                              ${(deal.contract_price || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                                {stageConfig?.label || (deal.stage || deal.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">{deal.agent_id.substring(0, 8)}...</td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {deal.closing_date ? new Date(deal.closing_date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {new Date(deal.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Commissions Section */}
        {viewMode === 'commissions' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Commission Tracking</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-600">Commission data will appear here once integrated with full Vault API.</p>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Brokerage Management</p>
              <p className="text-sm text-blue-800">
                View all agents' leads, deals, and commission performance. This dashboard requires Vault API endpoints for agents listing and multi-agent data aggregation.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
