'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Users, AlertCircle, CheckCircle } from 'lucide-react'
import BrokerPerformanceDashboard from '../components/BrokerPerformanceDashboard'
import TCDashboard from '@/components/tc/TCDashboard'
import ComplianceDashboard from '../components/ComplianceDashboard'
import SidebarNav from '../components/SidebarNav'

export default function BrokerDashboardPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'broker' | 'tc' | 'compliance'>('broker')

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Only allow brokers and admins
  if (!loading && role !== 'broker' && role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="bg-[#0a0a0f] rounded-lg shadow p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-4">Only brokers and admins can view this dashboard.</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#050507] flex">
      {/* Sidebar Navigation */}
      <SidebarNav
        onSignOut={handleSignOut}
        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
        role={role}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-[#0a0a0f] border-b border-[#1a1a2e] sticky top-0 z-40">
          <div className="px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-6 h-6" />
                  Broker Performance Dashboard
                </h1>
                <p className="text-sm text-gray-400">Monitor agent performance and team metrics</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="bg-[#0a0a0f] border-b border-[#1a1a2e] px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('broker')}
              className={`py-4 px-2 font-medium border-b-2 transition ${
                activeTab === 'broker'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Broker View
              </div>
            </button>
            <button
              onClick={() => setActiveTab('tc')}
              className={`py-4 px-2 font-medium border-b-2 transition ${
                activeTab === 'tc'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                TC View
              </div>
            </button>
            <button
              onClick={() => setActiveTab('compliance')}
              className={`py-4 px-2 font-medium border-b-2 transition ${
                activeTab === 'compliance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Compliance
              </div>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          {activeTab === 'broker' && <BrokerPerformanceDashboard userId={user.id} role={role} />}
          {activeTab === 'tc' && <TCDashboard userId={user.id} userRole={role} />}
          {activeTab === 'compliance' && <ComplianceDashboard userId={user.id} role={role} />}
        </main>
      </div>
    </div>
  )
}
