'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Users, DollarSign, CheckCircle, Target } from 'lucide-react'

interface AgentMetrics {
  id: string
  name: string
  email?: string
  deals: number
  volume: number
  commission: number
  closings: number
  winRate: number
  avgDealSize: number
}

interface BrokerPerformanceDashboardProps {
  userId: string
  role: string
}

export default function BrokerPerformanceDashboard({ userId, role }: BrokerPerformanceDashboardProps) {
  const [agents, setAgents] = useState<AgentMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgentMetrics()
  }, [userId, role])

  const fetchAgentMetrics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('https://hartfelt-vault.vercel.app/api/broker/agents', {
        headers: {
          'X-User-ID': userId,
          'X-User-Role': role,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Add id field to each agent
        const agentsWithIds = (data.agents || []).map((agent: any, idx: number) => ({
          id: `${idx}`,
          name: agent.name,
          email: agent.email || '',
          deals: agent.deals,
          volume: agent.volume,
          commission: agent.commission,
          closings: agent.closings,
          winRate: agent.win_rate,
          avgDealSize: agent.average_deal_size,
        }))
        setAgents(agentsWithIds)
      } else {
        // Fallback to empty array if API fails
        setAgents([])
      }
    } catch (err) {
      console.log('Agent metrics API failed:', err)
      // Use empty array as fallback
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  // Keep mock data for reference (commented out)
  const mockAgents = [
    {
      id: '1',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      deals: 12,
      volume: 4200000,
      commission: 84000,
      closings: 8,
      winRate: 67,
      avgDealSize: 350000,
    },
    {
      id: '2',
      name: 'Mike Chen',
      email: 'mike@example.com',
      deals: 10,
      volume: 3800000,
      commission: 76000,
      closings: 6,
      winRate: 60,
      avgDealSize: 380000,
    },
    {
      id: '3',
      name: 'Jessica Davis',
      email: 'jessica@example.com',
      deals: 14,
      volume: 5100000,
      commission: 102000,
      closings: 9,
      winRate: 64,
      avgDealSize: 364000,
    },
    {
      id: '4',
      name: 'Robert Wilson',
      email: 'robert@example.com',
      deals: 8,
      volume: 2900000,
      commission: 58000,
      closings: 5,
      winRate: 63,
      avgDealSize: 362500,
    },
  ]

  const totalVolume = agents.reduce((sum, a) => sum + a.volume, 0)
  const totalCommission = agents.reduce((sum, a) => sum + a.commission, 0)
  const totalClosings = agents.reduce((sum, a) => sum + a.closings, 0)
  const avgWinRate = agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + a.winRate, 0) / agents.length) : 0

  if (loading) {
    return <div className="text-center py-8">Loading broker dashboard...</div>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {agents.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">No agent data available. Make sure your backend is running on port 3000.</p>
        </div>
      )}
      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Total Volume</p>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ${(totalVolume / 1000000).toFixed(1)}M
          </p>
          <p className="text-xs text-gray-500 mt-2">All agents combined</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Total Commission</p>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ${(totalCommission / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-gray-500 mt-2">GCI this month</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Closings</p>
            <CheckCircle className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalClosings}</p>
          <p className="text-xs text-gray-500 mt-2">Deals closed this month</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Avg Win Rate</p>
            <Target className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{avgWinRate}%</p>
          <p className="text-xs text-gray-500 mt-2">Team average</p>
        </div>
      </div>

      {/* Top Agents Leaderboard */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Top Agents
          </h2>
          <p className="text-sm text-gray-600 mt-1">Performance leaderboard</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Deals</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Volume</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Commission</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Closings</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Win Rate</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Avg Deal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {agents.sort((a, b) => b.commission - a.commission).map((agent, idx) => (
                <tr key={agent.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•'} {agent.name}
                      </p>
                      <p className="text-sm text-gray-600">{agent.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">{agent.deals}</td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    ${(agent.volume / 1000000).toFixed(2)}M
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    ${(agent.commission / 1000).toFixed(0)}K
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {agent.closings}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${agent.winRate}%` }}
                        ></div>
                      </div>
                      <span className="text-gray-900 font-medium">{agent.winRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    ${(agent.avgDealSize / 1000).toFixed(0)}K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Alerts Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Alerts & Actions</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-2xl">⚠️</div>
            <div>
              <p className="font-semibold text-yellow-900">Compliance Review Due</p>
              <p className="text-sm text-yellow-800 mt-1">5 agents have reviews pending broker approval</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl">📊</div>
            <div>
              <p className="font-semibold text-blue-900">Monthly Reports Ready</p>
              <p className="text-sm text-blue-800 mt-1">Download production reports for all agents</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
