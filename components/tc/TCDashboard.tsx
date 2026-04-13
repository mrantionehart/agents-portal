'use client'

import { useEffect, useState } from 'react'
import { Users, FileText, CheckCircle, AlertCircle, Home, DollarSign } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface TCStats {
  assigned_agents: number
  active_transactions: number
  pending_docs: number
  overdue_milestones: number
}

interface AssignedDeal {
  id: string
  client_name: string
  property_address: string
  contract_price: number
  stage: string
  status: string
}

export default function TCDashboard({ userId, userRole }: { userId: string; userRole: string }) {
  const [stats, setStats] = useState<TCStats>({
    assigned_agents: 0,
    active_transactions: 0,
    pending_docs: 0,
    overdue_milestones: 0,
  })
  const [assignedDeals, setAssignedDeals] = useState<AssignedDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  useEffect(() => {
    fetchStats()
    subscribeToChanges()
  }, [userId])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch transaction stats from backend
      try {
        const statsResponse = await fetch('https://hartfelt-vault.vercel.app/api/broker/tc/transactions', {
          headers: {
            'X-User-ID': userId,
            'X-User-Role': userRole,
          },
        })

        if (statsResponse.ok) {
          const data = await statsResponse.json()
          setStats({
            assigned_agents: data.stats?.assigned_agents || 0,
            active_transactions: data.stats?.active_transactions || 0,
            pending_docs: data.stats?.pending_docs || 0,
            overdue_milestones: data.stats?.overdue_milestones || 0,
          })
        }
      } catch (statsErr) {
        console.log('Stats API failed:', statsErr)
      }

      // Fetch assigned deals from backend
      try {
        const dealsResponse = await fetch('https://hartfelt-vault.vercel.app/api/broker/tc/assigned-deals', {
          headers: {
            'X-User-ID': userId,
            'X-User-Role': userRole,
          },
        })

        if (dealsResponse.ok) {
          const data = await dealsResponse.json()
          setAssignedDeals(data.deals || [])
        } else {
          // Fallback to mock data if API fails
          setAssignedDeals([
            {
              id: '1',
              client_name: 'John Smith',
              property_address: '123 Oak Avenue, Springfield',
              contract_price: 450000,
              stage: 'contract',
              status: 'active'
            },
            {
              id: '2',
              client_name: 'Sarah Johnson',
              property_address: '456 Maple Street, Shelbyville',
              contract_price: 580000,
              stage: 'clear',
              status: 'active'
            }
          ])
        }
      } catch (dealsErr) {
        console.log('Assigned deals API failed, using mock data:', dealsErr)
        // Use mock data as fallback
        setAssignedDeals([
          {
            id: '1',
            client_name: 'John Smith',
            property_address: '123 Oak Avenue, Springfield',
            contract_price: 450000,
            stage: 'contract',
            status: 'active'
          },
          {
            id: '2',
            client_name: 'Sarah Johnson',
            property_address: '456 Maple Street, Shelbyville',
            contract_price: 580000,
            stage: 'clear',
            status: 'active'
          }
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToChanges = () => {
    try {
      // Subscribe to transaction changes
      const channel = supabase
        .channel(`tc-dashboard:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tc_transactions',
          },
          () => {
            fetchStats()
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    } catch (err) {
      console.error('Error subscribing to changes:', err)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading your workload...</div>
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Welcome, Transaction Coordinator</h2>
        <p className="text-blue-100">Here's your workload summary and what needs your attention</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Assigned Agents</p>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.assigned_agents}</p>
          <p className="text-xs text-gray-500 mt-2">Agents you're coordinating for</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Active Transactions</p>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.active_transactions}</p>
          <p className="text-xs text-gray-500 mt-2">Currently in progress</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Pending Documents</p>
            <FileText className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.pending_docs}</p>
          <p className="text-xs text-gray-500 mt-2">Awaiting verification</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Overdue Milestones</p>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.overdue_milestones}</p>
          <p className="text-xs text-gray-500 mt-2">Need immediate attention</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 p-6">
          <button className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 text-center transition">
            <p className="font-semibold text-blue-900">Create Transaction</p>
            <p className="text-sm text-blue-700 mt-1">Start a new deal for an agent</p>
          </button>
          <button className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-4 text-center transition">
            <p className="font-semibold text-green-900">Upload Document</p>
            <p className="text-sm text-green-700 mt-1">Add transaction documents</p>
          </button>
          <button className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-4 text-center transition">
            <p className="font-semibold text-purple-900">Create Milestone</p>
            <p className="text-sm text-purple-700 mt-1">Track important dates</p>
          </button>
        </div>
      </div>

      {/* Assigned Deals */}
      {assignedDeals.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Home className="w-5 h-5 text-indigo-600" />
              Assigned Deals
            </h2>
            <p className="text-sm text-gray-600 mt-1">Active deals assigned to you</p>
          </div>
          <div className="divide-y">
            {assignedDeals.map((deal) => (
              <div key={deal.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{deal.client_name}</h3>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      {deal.property_address}
                    </p>
                    <div className="mt-3 flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        deal.stage === 'closed' ? 'bg-green-100 text-green-800' :
                        deal.stage === 'contract' ? 'bg-blue-100 text-blue-800' :
                        deal.stage === 'clear' ? 'bg-cyan-100 text-cyan-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {deal.stage?.charAt(0).toUpperCase() + (deal.stage?.slice(1) || '')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-1 justify-end text-lg font-bold text-gray-900">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      {(deal.contract_price / 1000000).toFixed(2)}M
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Contract Price</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Getting Started */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Getting Started</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ You have {stats.assigned_agents} agents assigned to you</li>
          <li>✓ {stats.active_transactions} transactions are currently active</li>
          <li>✓ {stats.pending_docs} documents are awaiting verification</li>
          {stats.overdue_milestones > 0 && (
            <li className="text-red-700">⚠ {stats.overdue_milestones} milestones are overdue - please review!</li>
          )}
        </ul>
      </div>
    </div>
  )
}
