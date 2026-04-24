'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../providers'
import { AgentPerformanceReport } from '@/components/admin/AgentPerformanceReport'

export const dynamic = 'force-dynamic'

export default function AdminReportsPage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
    // Admin only - redirect non-admins
    if (!loading && user && role !== 'admin' && role !== 'broker') {
      router.push('/dashboard')
    }
  }, [user, loading, router, role])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user || (role !== 'admin' && role !== 'broker')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-white">Agent Performance Reports</h1>
          <p className="text-sm text-gray-400 mt-1">Monitor and analyze agent performance metrics</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <AgentPerformanceReport />
      </main>
    </div>
  )
}
