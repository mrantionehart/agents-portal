'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../providers'
import Link from 'next/link'
import { BarChart3, Users, TrendingUp, AlertCircle } from 'lucide-react'
import { vaultAPI } from '@/lib/vault-client'

export const dynamic = 'force-dynamic'

export default function AdminDashboardPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [allDeals, setAllDeals] = useState<any[]>([])
  const [allCommissions, setAllCommissions] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
    // Admin only - redirect non-admins to agent dashboard
    if (!loading && user && role !== 'admin' && role !== 'broker') {
      router.push('/dashboard')
    }
  }, [user, loading, router, role])

  useEffect(() => {
    if (user && (role === 'admin' || role === 'broker')) {
      fetchAdminData()
    }
  }, [user, role])

  const fetchAdminData = async () => {
    try {
      setDealsLoading(true)
      setError(null)

      // Fetch all deals with admin role
      const dealsResult = await vaultAPI.deals.list(user!.id, role)
      const dealsArray = dealsResult.deals || dealsResult.data || []
      setAllDeals(Array.isArray(dealsArray) ? dealsArray : [])

      // Fetch all commissions with admin role
      const commsResult = await vaultAPI.commissions.list(user!.id, role)
      const commsArray = commsResult.commissions || commsResult.data || []
      setAllCommissions(Array.isArray(commsArray) ? commsArray : [])

      // Extract unique agents from the deals
      const uniqueAgents = new Map()
      dealsArray.forEach((deal: any) => {
        if (deal.agent_id && !uniqueAgents.has(deal.agent_id)) {
          uniqueAgents.set(deal.agent_id, {
            id: deal.agent_id,
            name: deal.agent_name || 'Unknown Agent',
            email: deal.agent_email || '',
          })
        }
      })
      setAgents(Array.from(uniqueAgents.values()))
    } catch (err) {
      console.error('Error fetching admin data:', err)
      setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDealsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user || (role !== 'admin' && role !== 'broker')) {
    return null
  }

  const totalDeals = allDeals.length
  const totalGrossCommission = allCommissions.reduce((sum, c) => sum + (c.gross_commission || 0), 0)
  const totalPaid = allCommissions.reduce((sum, c) => sum + (c.agent_amount || 0), 0)
  const totalAgents = agents.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Broker Admin Dashboard</h1>
            <p className="text-sm text-gray-600">Manage all agents and transactions</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="font-medium text-gray-900">{user.email}</p>
              <p className="text-sm text-gray-600 capitalize">{role} Account</p>
            </div>
            <button
              onClick={handleSignOut}
              className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition"
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

        {/* Stats Section */}
        <div className="grid grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Active Agents</p>
            <p className="text-4xl font-bold text-gray-900">{totalAgents}</p>
            <p className="text-xs text-gray-500 mt-2">Team members</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Total Deals</p>
            <p className="text-4xl font-bold text-gray-900">{totalDeals}</p>
            <p className="text-xs text-gray-500 mt-2">All transactions</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Total Commission</p>
            <p className="text-4xl font-bold text-gray-900">${(totalGrossCommission / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-gray-500 mt-2">Gross earnings</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Paid Out</p>
            <p className="text-4xl font-bold text-gray-900">${(totalPaid / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-gray-500 mt-2">Agent payouts</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {/* Deals Section */}
          <div className="col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
              </div>
              {dealsLoading ? (
                <div className="p-6">Loading...</div>
              ) : allDeals.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Agent</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Property</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allDeals.slice(0, 8).map((deal) => (
                        <tr key={deal.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm text-gray-900">{deal.agent_name || 'Unknown'}</td>
                          <td className="px-6 py-3 text-sm">{deal.property_address}</td>
                          <td className="px-6 py-3 text-sm">
                            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                              {deal.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm font-medium">${(deal.contract_price || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-gray-500">No deals found</div>
              )}
              <div className="p-6 border-t border-gray-200">
                <Link href="/admin/deals" className="text-blue-600 hover:text-blue-700 font-medium">
                  View all deals →
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Tools */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Team Overview</h3>
              <div className="space-y-3">
                <Link href="/admin/agents" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <span className="font-medium text-gray-900 block">Agents</span>
                    <span className="text-xs text-gray-600">{totalAgents} active</span>
                  </div>
                </Link>
                <Link href="/admin/commissions" className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 transition">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <div>
                    <span className="font-medium text-gray-900 block">Commissions</span>
                    <span className="text-xs text-gray-600">{allCommissions.length} pending</span>
                  </div>
                </Link>
                <Link href="/admin/compliance" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <div>
                    <span className="font-medium text-gray-900 block">Compliance</span>
                    <span className="text-xs text-gray-600">Review submissions</span>
                  </div>
                </Link>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Broker Tools
              </h3>
              <p className="text-sm text-gray-600 mb-4">Manage agent compliance, approvals, and payouts.</p>
              <Link
                href="/admin/settings"
                className="block w-full text-center bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 transition text-sm font-medium"
              >
                Broker Settings
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
