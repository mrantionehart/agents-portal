'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Plus, DollarSign, Calendar, AlertCircle, TrendingUp } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../components/compliance-notifications'
import AddDealModal from '@/components/AddDealModal'
import { createClient } from '@supabase/supabase-js'

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

const PIPELINE_STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-blue-100', textColor: 'text-blue-900', borderColor: 'border-blue-300', icon: '⭐' },
  { id: 'contacted', label: 'Contacted', color: 'bg-purple-100', textColor: 'text-purple-900', borderColor: 'border-purple-300', icon: '📞' },
  { id: 'showing', label: 'Showing', color: 'bg-orange-100', textColor: 'text-orange-900', borderColor: 'border-orange-300', icon: '👁️' },
  { id: 'offer', label: 'Offer Sent', color: 'bg-yellow-100', textColor: 'text-yellow-900', borderColor: 'border-yellow-300', icon: '📄' },
  { id: 'contract', label: 'Under Contract', color: 'bg-green-100', textColor: 'text-green-900', borderColor: 'border-green-300', icon: '✅' },
  { id: 'inspection', label: 'Inspection', color: 'bg-teal-100', textColor: 'text-teal-900', borderColor: 'border-teal-300', icon: '🔍' },
  { id: 'clear', label: 'Clear to Close', color: 'bg-cyan-100', textColor: 'text-cyan-900', borderColor: 'border-cyan-300', icon: '🔓' },
  { id: 'closed', label: 'Closed', color: 'bg-amber-100', textColor: 'text-amber-900', borderColor: 'border-amber-300', icon: '🏆' },
]

export default function PipelinePage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pipelineData, setPipelineData] = useState<Record<string, Deal[]>>({})
  const [totalValue, setTotalValue] = useState(0)
  const [dealStats, setDealStats] = useState({ total: 0, inProgress: 0, closing: 0 })
  const [showAddDealModal, setShowAddDealModal] = useState(false)
  const [agents, setAgents] = useState<Array<{ id: string; email: string; name?: string }>>([])
  const [addingDeal, setAddingDeal] = useState(false)

  useEffect(() => {
    if (user) {
      loadDeals()
    }
  }, [user])

  useEffect(() => {
    if (deals.length > 0) {
      organizeDealsByStage()
      calculateStats()
    }
  }, [deals])

  const loadDeals = async () => {
    if (!user) return
    try {
      setDealsLoading(true)
      setError(null)
      const result = await vaultAPI.deals.list(user.id, role)
      const dealsArray = Array.isArray(result) ? result : result.deals || []
      setDeals(dealsArray)
    } catch (err) {
      console.error('Error loading deals:', err)
      setError(`Failed to load deals: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDealsLoading(false)
    }
  }

  const organizeDealsByStage = () => {
    const organized: Record<string, Deal[]> = {}
    PIPELINE_STAGES.forEach((stage) => {
      organized[stage.id] = deals.filter((deal) => deal.stage === stage.id || deal.status === stage.id)
    })
    setPipelineData(organized)

    const total = deals.reduce((sum, deal) => sum + (deal.contract_price || 0), 0)
    setTotalValue(total)
  }

  const calculateStats = () => {
    const closedStages = ['closed']
    const inProgressStages = ['contacted', 'showing', 'offer', 'contract', 'inspection', 'clear']

    setDealStats({
      total: deals.length,
      inProgress: deals.filter((d) => inProgressStages.includes(d.stage || d.status)).length,
      closing: deals.filter((d) => closedStages.includes(d.stage || d.status)).length,
    })
  }

  const handleMoveDeal = async (dealId: string, newStage: string) => {
    if (!user) return

    try {
      await vaultAPI.deals.updateStage(dealId, newStage, user.id, role)
      setDeals((prevDeals) =>
        prevDeals.map((deal) =>
          deal.id === dealId ? { ...deal, stage: newStage, status: newStage } : deal
        )
      )
    } catch (err) {
      setError(`Failed to move deal: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const loadAgents = async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get all users with agent role
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, name')
          .eq('role', 'agent')

        if (data) {
          setAgents(data)
        }
      }
    } catch (err) {
      console.error('Error loading agents:', err)
    }
  }

  const handleAddDeal = async (dealData: any) => {
    if (!user) return

    setAddingDeal(true)
    try {
      const newDeal = await vaultAPI.deals.create(
        {
          ...dealData,
          created_at: new Date().toISOString(),
        },
        user.id,
        role
      )

      // Add to local state
      setDeals(prevDeals => [...prevDeals, newDeal])
      setShowAddDealModal(false)
    } catch (err) {
      console.error('Error adding deal:', err)
      throw err
    } finally {
      setAddingDeal(false)
    }
  }

  // Load agents when component mounts (for brokers/admins)
  useEffect(() => {
    if (role !== 'agent') {
      loadAgents()
    }
  }, [role])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

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
        <div className="max-w-full px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Deal Pipeline</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAddDealModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Deal
            </button>
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
      <main className="px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Stats Section */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Total Deals</p>
            <p className="text-3xl font-bold text-gray-900">{dealStats.total}</p>
            <p className="text-xs text-gray-500 mt-2">In your pipeline</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium mb-1">In Progress</p>
            <p className="text-3xl font-bold text-gray-900">{dealStats.inProgress}</p>
            <p className="text-xs text-gray-500 mt-2">Active transactions</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Closed</p>
            <p className="text-3xl font-bold text-gray-900">{dealStats.closing}</p>
            <p className="text-xs text-gray-500 mt-2">Completed deals</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Total Value</p>
            <p className="text-3xl font-bold text-gray-900">${(totalValue / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-gray-500 mt-2">Pipeline value</p>
          </div>
        </div>

        {/* Pipeline Kanban Board */}
        {dealsLoading ? (
          <div className="text-center py-12 text-gray-600">Loading pipeline...</div>
        ) : (
          <div className="grid grid-cols-8 gap-4 overflow-x-auto pb-8">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.id} className="flex flex-col min-w-80">
                {/* Stage Header */}
                <div className={`${stage.color} rounded-t-lg p-4 border-b-2 ${stage.borderColor}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-bold ${stage.textColor} text-lg flex items-center gap-2`}>
                        {stage.icon} {stage.label}
                      </h3>
                      <p className={`text-sm ${stage.textColor} opacity-75 mt-1`}>
                        {pipelineData[stage.id]?.length || 0} deals
                      </p>
                    </div>
                  </div>

                  {/* Stage Value */}
                  {pipelineData[stage.id] && pipelineData[stage.id].length > 0 && (
                    <div className={`text-sm font-semibold ${stage.textColor} mt-2 flex items-center gap-1`}>
                      <DollarSign className="w-4 h-4" />
                      ${(
                        pipelineData[stage.id].reduce((sum, deal) => sum + (deal.contract_price || 0), 0) /
                        1000000
                      ).toFixed(1)}M
                    </div>
                  )}
                </div>

                {/* Deal Cards */}
                <div className="flex-1 bg-gray-50 rounded-b-lg p-4 space-y-3 min-h-96">
                  {pipelineData[stage.id] && pipelineData[stage.id].length > 0 ? (
                    pipelineData[stage.id].map((deal) => (
                      <div
                        key={deal.id}
                        onClick={() => router.push(`/deals/${deal.id}`)}
                        className={`${stage.color} rounded-lg p-4 border-2 ${stage.borderColor} cursor-pointer hover:shadow-lg transition`}
                      >
                        {/* Client Name */}
                        <p className={`font-bold ${stage.textColor} text-sm mb-1 truncate`}>
                          {deal.client_name}
                        </p>

                        {/* Property Address */}
                        <p className={`${stage.textColor} text-xs mb-3 opacity-75 truncate`}>
                          {deal.property_address}
                        </p>

                        {/* Price */}
                        <div className={`text-lg font-bold ${stage.textColor} mb-3`}>
                          ${(deal.contract_price || 0).toLocaleString()}
                        </div>

                        {/* Move to Next Stage Button */}
                        {stage.id !== 'closed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const nextStageIndex = PIPELINE_STAGES.findIndex((s) => s.id === stage.id) + 1
                              if (nextStageIndex < PIPELINE_STAGES.length) {
                                handleMoveDeal(deal.id, PIPELINE_STAGES[nextStageIndex].id)
                              }
                            }}
                            className={`w-full py-1 px-2 rounded text-xs font-medium transition ${
                              stage.id === 'closed'
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                : `${stage.color} text-gray-700 hover:opacity-80`
                            }`}
                          >
                            Move →
                          </button>
                        )}

                        {stage.id === 'closed' && (
                          <div className="text-center py-1 text-xs font-medium text-green-700">
                            ✓ Closed
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm text-center">
                      <p>No deals in {stage.label.toLowerCase()}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!dealsLoading && deals.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-4">No deals in your pipeline yet.</p>
            <p className="text-gray-500 text-sm">Deals will appear here once they are created in your system.</p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <div className="flex gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Pipeline Overview</p>
              <p className="text-sm text-blue-800">
                Your deal pipeline shows all transactions from initial contact through closing. Move deals between stages as they progress. The pipeline value shows the total contract value of all deals in each stage.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Add Deal Modal */}
      <AddDealModal
        isOpen={showAddDealModal}
        onClose={() => setShowAddDealModal(false)}
        onAdd={handleAddDeal}
        userRole={role}
        currentUserId={user?.id}
        agents={agents}
        loading={addingDeal}
      />
    </div>
  )
}
