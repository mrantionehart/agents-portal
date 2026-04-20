'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { BarChart3, FileText, Briefcase, BookOpen, Users, HelpCircle, Calculator, Settings as SettingsIcon, Sparkles, TrendingUp, Mail, CalendarIcon, Trophy, Gift, ClipboardList, CheckSquare, Plus } from 'lucide-react'
import { vaultAPI } from '@/lib/vault-client'
import { createClient } from '@supabase/supabase-js'
import PolicyAcceptanceModal from '../policy-acceptance/modal'
import ComplianceNotifications from '../components/compliance-notifications'
import SupportModal from '@/components/SupportModal'
import SidebarNav from '../components/SidebarNav'
import BrokerViewToggle from '../components/BrokerViewToggle'
import NotificationsPanel from '../components/NotificationsPanel'
import TrainingGate from '../components/TrainingGate'

export default function DashboardPage() {
  const { user, role, loading, signOut, trainingGate } = useAuth()
  const router = useRouter()
  const [deals, setDeals] = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [policyAccepted, setPolicyAccepted] = useState(true)
  const [checkingPolicy, setCheckingPolicy] = useState(true)
  const [supportModalOpen, setSupportModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'agent' | 'broker'>('agent')
  const [vol2BannerDismissed, setVol2BannerDismissed] = useState(false)

  // Auth check handled by middleware - remove to prevent flashing
  // useEffect(() => {
  //   if (!loading && !user) {
  //     router.push('/login')
  //   }
  // }, [user, loading, router])

  useEffect(() => {
    if (user && role) {
      // Check policy only for agents, not for admins/brokers
      if (role === 'agent') {
        // Check localStorage first to avoid re-checking on every mount
        const cachedAcceptance = localStorage.getItem(`policy_accepted_${user.id}`)
        if (cachedAcceptance === 'true') {
          setPolicyAccepted(true)
          setCheckingPolicy(false)
        } else {
          checkPolicyAcceptance()
        }
      } else {
        setPolicyAccepted(true)
        setCheckingPolicy(false)
      }
      // Don't fetch data - disabled to prevent flashing
      // fetchData()
    } else if (user && !role) {
      // Role is still loading, wait for it
      setCheckingPolicy(true)
    }
  }, [user, role])

  const checkPolicyAcceptance = async () => {
    try {
      setCheckingPolicy(true)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Policy check timeout')), 5000)
        )

        const queryPromise = supabase
          .from('policy_acceptances')
          .select('*')
          .eq('user_id', user!.id)
          .eq('policy_type', 'brokerage_manual')
          .single()

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

        if (data) {
          setPolicyAccepted(true)
        } else {
          setPolicyAccepted(false)
        }
      } else {
        setPolicyAccepted(true)
      }
    } catch (err) {
      console.log('No policy acceptance found or check failed, showing modal:', err)
      setPolicyAccepted(false)
    } finally {
      setCheckingPolicy(false)
    }
  }

  const fetchData = async () => {
    try {
      setDealsLoading(true)
      setError(null)

      // Fetch deals from Vault API (filtered by role)
      const dealsResult = await vaultAPI.deals.list(user!.id, role)
      const dealsArray = dealsResult.deals || dealsResult.data || []
      setDeals(Array.isArray(dealsArray) ? dealsArray : [])

      // Fetch commissions from Vault API (filtered by role)
      const commsResult = await vaultAPI.commissions.list(user!.id, role)
      const commsArray = commsResult.commissions || commsResult.data || []
      setCommissions(Array.isArray(commsArray) ? commsArray : [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(`Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDealsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading || checkingPolicy) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  // Show policy acceptance modal if not accepted
  if (!policyAccepted) {
    return (
      <PolicyAcceptanceModal
        userId={user.id}
        userName={user.user_metadata?.full_name || user.email || 'User'}
        onAcceptance={() => setPolicyAccepted(true)}
      />
    )
  }

  const totalDeals = deals.length
  const totalGrossCommission = commissions.reduce((sum, c) => sum + (c.gross_commission || 0), 0)
  const totalEarned = commissions.reduce((sum, c) => sum + (c.agent_amount || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Navigation */}
      <SidebarNav
        onSignOut={handleSignOut}
        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
        role={role}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back to your workspace</p>
            </div>
            <div className="flex items-center gap-6">
              {(role === 'broker' || role === 'admin') && (
                <BrokerViewToggle role={role} currentView={viewMode} onViewChange={setViewMode} />
              )}
              <NotificationsPanel userId={user?.id} role={role} />
              <button
                onClick={() => setSupportModalOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Help"
              >
                <HelpCircle className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Vol 2 Training Nudge — shown to agents who completed Vol 1 but not Vol 2 */}
        {role === 'agent' && trainingGate.gateOpen && !trainingGate.vol2.done && !vol2BannerDismissed && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-blue-900 font-semibold text-sm">Level Up with Volume 2 Training</h4>
              <p className="text-blue-800 text-xs mt-1">
                You&apos;ve completed the foundations — now take your skills to the next level with advanced modules on
                negotiation, scaling, and market mastery.
                {trainingGate.vol2.completed.length > 0
                  ? ` You're ${trainingGate.vol2.completed.length} of ${trainingGate.vol2.total} modules in.`
                  : ` ${trainingGate.vol2.total} modules are ready for you.`}
              </p>
              <a
                href="/training"
                className="inline-block mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
              >
                Start Volume 2 →
              </a>
            </div>
            <button
              onClick={() => setVol2BannerDismissed(true)}
              className="text-blue-400 hover:text-blue-600 text-lg leading-none"
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

        {/* Production Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Production — This Month</h2>
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-amber-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Volume</p>
              <p className="text-3xl font-bold text-amber-600">{totalDeals > 0 ? `$${(totalDeals * 500000 / 1000000).toFixed(1)}M` : '$0'}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-green-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Closings</p>
              <p className="text-3xl font-bold text-green-600">{totalDeals}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-cyan-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Commission</p>
              <p className="text-3xl font-bold text-cyan-600">${(totalGrossCommission / 1000).toFixed(0)}K</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-amber-600">
              <p className="text-gray-600 text-sm font-medium mb-2">GCI</p>
              <p className="text-3xl font-bold text-amber-700">${(totalGrossCommission / 1000).toFixed(0)}K</p>
            </div>
          </div>
        </div>

        {/* Quick Actions - Moved higher for faster access */}
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-5 gap-3">
            <Link href="/pipeline" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-50 transition text-sm text-gray-700 hover:text-amber-700">
              <Plus className="w-4 h-4" />
              New Deal
            </Link>
            <Link href="/leads" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-cyan-50 transition text-sm text-gray-700 hover:text-cyan-700">
              <Users className="w-4 h-4" />
              Add Lead
            </Link>
            <Link href="/documents" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-orange-50 transition text-sm text-gray-700 hover:text-orange-700">
              <FileText className="w-4 h-4" />
              Upload Doc
            </Link>
            <Link href="/transaction-coordinator" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-emerald-50 transition text-sm text-gray-700 hover:text-emerald-700">
              <CheckSquare className="w-4 h-4" />
              Request TC
            </Link>
            <Link href="/ai-chat" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 transition text-sm text-gray-700 hover:text-indigo-700">
              <Sparkles className="w-4 h-4" />
              Ask AI
            </Link>
          </div>
        </div>

        {/* My Deals Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">My Deals</h2>
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-cyan-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Active</p>
              <p className="text-3xl font-bold text-cyan-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-amber-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Under Contract</p>
              <p className="text-3xl font-bold text-amber-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-green-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Closing Soon</p>
              <p className="text-3xl font-bold text-green-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-red-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Closing This Week</p>
              <p className="text-3xl font-bold text-red-600">0</p>
              <p className="text-xs text-gray-500 mt-2">Critical</p>
            </div>
          </div>
        </div>

        {/* Pipeline Snapshot */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pipeline</h2>
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Leads</p>
              <p className="text-3xl font-bold text-blue-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-yellow-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Active</p>
              <p className="text-3xl font-bold text-yellow-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-amber-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Under Contract</p>
              <p className="text-3xl font-bold text-amber-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-green-500">
              <p className="text-gray-600 text-sm font-medium mb-2">Closed (MTD)</p>
              <p className="text-3xl font-bold text-green-600">0</p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Total Deals</p>
            <p className="text-4xl font-bold text-gray-900">{totalDeals}</p>
            <p className="text-xs text-gray-500 mt-2">Active transactions</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Total Commissions</p>
            <p className="text-4xl font-bold text-gray-900">${(totalGrossCommission / 1000).toFixed(1)}K</p>
            <p className="text-xs text-gray-500 mt-2">Gross earnings</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium mb-1">Net Earned</p>
            <p className="text-4xl font-bold text-gray-900">${(totalEarned / 1000).toFixed(1)}K</p>
            <p className="text-xs text-gray-500 mt-2">After splits & fees</p>
          </div>
        </div>

        {/* Admin Section - Only visible to brokers/admins */}
        {(role === 'broker' || role === 'admin') && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-gray-700" />
              Admin Tools
            </h2>
            <div className="grid grid-cols-5 gap-4">
              <Link href="/brokerage" className="group">
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer group-hover:bg-cyan-50 border-l-4 border-cyan-600">
                  <Users className="w-8 h-8 text-cyan-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Brokerage</h3>
                  <p className="text-sm text-gray-600">All agents & deals</p>
                </div>
              </Link>

              <Link href="/recruiting" className="group">
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer group-hover:bg-purple-50 border-l-4 border-purple-600">
                  <Sparkles className="w-8 h-8 text-purple-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Recruiting</h3>
                  <p className="text-sm text-gray-600">Build team</p>
                </div>
              </Link>

              <Link href="/admin/onboarding" className="group">
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer group-hover:bg-blue-50 border-l-4 border-blue-600">
                  <ClipboardList className="w-8 h-8 text-blue-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Onboarding</h3>
                  <p className="text-sm text-gray-600">New agents</p>
                </div>
              </Link>

              <Link href="/admin-settings" className="group">
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer group-hover:bg-indigo-50 border-l-4 border-indigo-600">
                  <SettingsIcon className="w-8 h-8 text-indigo-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Settings</h3>
                  <p className="text-sm text-gray-600">Config</p>
                </div>
              </Link>

              <Link href="/compliance" className="group">
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer group-hover:bg-yellow-50 border-l-4 border-yellow-600">
                  <FileText className="w-8 h-8 text-yellow-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Compliance</h3>
                  <p className="text-sm text-gray-600">Review</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {/* Deals Section */}
          <div className="col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Recent Deals</h2>
              </div>
              {dealsLoading ? (
                <div className="p-6">Loading...</div>
              ) : deals.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Property</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {deals.slice(0, 5).map((deal) => (
                        <tr key={deal.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm">{deal.property_address}</td>
                          <td className="px-6 py-3 text-sm capitalize">{deal.type}</td>
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
                <Link href="/deals" className="text-blue-600 hover:text-blue-700 font-medium">
                  View all deals →
                </Link>
              </div>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Quick Tools</h3>
              <div className="space-y-3">
                <Link href="/commission-calculator" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">Commission Calculator</span>
                </Link>
                <Link href="/commissions" className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 transition">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">View Commissions</span>
                </Link>
                <Link href="/compliance" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition">
                  <FileText className="w-5 h-5 text-orange-600" />
                  <span className="font-medium text-gray-900">Compliance Docs</span>
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Support
              </h3>
              <p className="text-sm text-gray-600 mb-4">Need help? Contact our support team.</p>
              <button
                onClick={() => setSupportModalOpen(true)}
                className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 transition text-sm font-medium"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
        </main>

        <SupportModal
          isOpen={supportModalOpen}
          onClose={() => setSupportModalOpen(false)}
          userEmail={user?.email}
          userName={user?.user_metadata?.name || user?.email?.split('@')[0]}
        />
      </div>
    </div>
  )
}
