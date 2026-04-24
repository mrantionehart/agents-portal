'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import AgentTCView from '@/components/tc/AgentTCView'
import AgentTCRequestEnhanced from '@/components/tc/AgentTCRequestEnhanced'
import TCDashboard from '@/components/tc/TCDashboard'
import BrokerTCManagement from '@/components/tc/BrokerTCManagement'
import TCNotifications from '@/components/tc/TCNotifications'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TransactionCoordinatorPage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (loading || !isClient) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Transaction Coordinator</h1>
              <p className="text-sm text-gray-400">Manage your TC workload and assignments</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <TCNotifications userId={user.id} userRole={role} />
            <div className="text-right">
              <p className="font-medium text-white">{user.email}</p>
              <p className="text-sm text-gray-400 capitalize">{role}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {role === 'broker' && (
          <>
            <BrokerTCManagement userId={user.id} userRole={role} />
          </>
        )}

        {role === 'tc' && (
          <>
            <TCDashboard userId={user.id} userRole={role} />
          </>
        )}

        {role === 'agent' && (
          <>
            <div className="space-y-8">
              <AgentTCRequestEnhanced userId={user.id} userRole={role} />
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Your TC's Work</h2>
                <AgentTCView userId={user.id} userRole={role} />
              </div>
            </div>
          </>
        )}

        {role !== 'broker' && role !== 'tc' && role !== 'agent' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
            <p className="text-yellow-400">
              Transaction Coordinator features are not available for your role. Please contact support.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
