'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import {
  Briefcase, Home, Key, Building2, Share2, Layers,
  DollarSign, TrendingUp, ArrowRight, Plus, AlertCircle
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

interface PipelineStage {
  id: string
  label: string
  count: number
  volume: number
  avgDays: number
  gci: number
  probability: number
  transactions: {
    id: string
    property_address: string
    city: string
    contract_price: number
    closing_date: string
    gci: number
    agent_amount: number
  }[]
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

interface PipelineTotals {
  totalDeals: number
  totalVolume: number
  potentialGCI: number
  probableGCI: number
  closedDeals: number
  closedVolume: number
}

const iconMap: Record<string, any> = {
  home: Home,
  key: Key,
  building: Building2,
  share: Share2,
  layers: Layers,
}

const stageLineColors: Record<string, string> = {
  listings: 'bg-teal-400',
  buyers: 'bg-red-400',
  leases: 'bg-blue-400',
  referrals: 'bg-amber-400',
  other: 'bg-purple-400',
}

const stageBadgeColors: Record<string, string> = {
  listings: 'bg-teal-500',
  buyers: 'bg-red-500/100',
  leases: 'bg-blue-500/100',
  referrals: 'bg-amber-500/100',
  other: 'bg-purple-500/100',
}

export default function PipelinePage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  const [pipeline, setPipeline] = useState<PipelineGroup[]>([])
  const [totals, setTotals] = useState<PipelineTotals | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [userRole, setUserRole] = useState('agent')
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [loadingData, setLoadingData] = useState(true)

  const loadPipeline = useCallback(async () => {
    setLoadingData(true)
    try {
      const params = selectedAgent ? `?agent_id=${selectedAgent}` : ''
      const res = await fetch(`/api/pipeline${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPipeline(data.pipeline || [])
      setTotals(data.totals || null)
      setAgents(data.agents || [])
      setUserRole(data.role || 'agent')
    } catch (err) {
      console.error('Failed to load pipeline:', err)
    } finally {
      setLoadingData(false)
    }
  }, [selectedAgent])

  useEffect(() => { if (user) loadPipeline() }, [user, loadPipeline])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const formatCurrency = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 2)}K`
    return `$${n.toFixed(0)}`
  }

  const formatVolume = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
    return `${n}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#050507] flex">
      <SidebarNav onSignOut={handleSignOut} userName={user?.user_metadata?.full_name} role={role} />

      <div className="flex-1 p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-blue-600" />
              Deals Pipeline
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Track your opportunities from cultivation to close
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Agent selector for broker/admin */}
            {['broker', 'admin'].includes(userRole) && agents.length > 0 && (
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="px-4 py-2.5 bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#C9A84C]/30"
              >
                <option value="">All Agents</option>
                {agents.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => router.push('/transactions/new')}
              className="bg-teal-600 text-white px-4 py-2.5 rounded-lg hover:bg-teal-700 transition flex items-center gap-2 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Create Opportunity
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        {totals && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Deals</span>
              </div>
              <p className="text-3xl font-bold text-white">{totals.totalDeals}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Volume</span>
              </div>
              <p className="text-3xl font-bold text-white">{formatCurrency(totals.totalVolume)}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Potential GCI</span>
              </div>
              <p className="text-3xl font-bold text-amber-600">{formatCurrency(totals.potentialGCI)}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Probable Income</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(totals.probableGCI)}</p>
            </div>
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : pipeline.length === 0 || (totals && totals.totalDeals === 0) ? (
          <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-400 mb-2">No deals in your pipeline yet</p>
            <p className="text-sm text-gray-400 mb-6">Create a transaction to start tracking your opportunities</p>
            <button
              onClick={() => router.push('/transactions/new')}
              className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition inline-flex items-center gap-2 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Create Opportunity
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {pipeline.map(group => {
              const Icon = iconMap[group.icon] || Briefcase
              const lineColor = stageLineColors[group.id] || 'bg-[#1a1a2e]'
              const badgeColor = stageBadgeColors[group.id] || 'bg-[#050507]0'

              return (
                <div key={group.id} className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] overflow-hidden">
                  <div className="flex items-stretch">
                    {/* Pipeline stages */}
                    <div className="flex-1 p-6 pb-5">
                      {/* Group title */}
                      <div className="flex items-center gap-2.5 mb-5">
                        <Icon className="w-5 h-5 text-gray-400" />
                        <h2 className="text-base font-bold text-white">{group.label}</h2>
                      </div>

                      {/* Stage labels */}
                      <div className="flex items-center mb-3 px-4">
                        {group.stages.map((stage, idx) => (
                          <div key={stage.id} className="flex items-center flex-1">
                            <span className="text-[11px] font-semibold text-gray-400 text-center w-full">
                              {stage.label}
                            </span>
                            {idx < group.stages.length - 1 && (
                              <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Stage circles with connecting line */}
                      <div className="relative flex items-center mb-3 px-4">
                        {/* Connecting line */}
                        <div className={`absolute top-1/2 left-[12%] right-[12%] h-[3px] rounded-full ${lineColor}`}
                          style={{ transform: 'translateY(-50%)' }} />

                        {group.stages.map((stage) => (
                          <div key={stage.id} className="flex-1 flex justify-center relative z-10">
                            <div className="flex flex-col items-center">
                              {/* Circle with icon */}
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-[#0a0a0f] border-2 ${
                                stage.count > 0 ? 'border-[#1a1a2e] shadow-sm shadow-black/10' : 'border-[#1a1a2e]'
                              }`}>
                                <Icon className="w-5 h-5 text-gray-400" />
                              </div>
                              {/* Count badge */}
                              <div className={`-mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white ${
                                stage.count > 0 ? badgeColor : 'bg-gray-400'
                              }`}>
                                {stage.count}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Volume + Avg Time */}
                      <div className="flex items-center px-4 mt-1">
                        {group.stages.map(stage => (
                          <div key={stage.id} className="flex-1 text-center">
                            <p className="text-xs text-gray-400">
                              Volume: {stage.volume > 0 ? formatVolume(stage.volume) : '0'}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              Avg. Time: {stage.avgDays > 0 ? `${stage.avgDays} days` : '0.1 days'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* GCI Sidebar */}
                    <div className="w-72 border-l border-[#1a1a2e] bg-[#050507] p-6 flex flex-col justify-center">
                      <h3 className="text-base font-bold text-white mb-4">GCI</h3>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">Potential Income</span>
                            <span className="text-lg font-bold text-blue-600">
                              {formatCurrency(group.summary.potentialGCI)}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Total commission from all opportunities {group.label.toLowerCase()}
                          </p>
                        </div>

                        <div className="border-t border-[#1a1a2e] pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">Probable Income</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(group.summary.probableGCI)}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Adjusted commission based on each stage's probability to close
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
