'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../providers'
import { ComplianceDashboard } from '@/components/admin/ComplianceDashboard'

export const dynamic = 'force-dynamic'

export default function AdminCompliancePage() {
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Compliance Management</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor and manage agent compliance status</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <ComplianceDashboard />
      </main>
    </div>
  )
}
