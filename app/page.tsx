'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './providers'

export default function HomePage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Only redirect if auth is fully loaded and we have a user
    if (!loading && user) {
      // Route based on user role
      if (role === 'admin' || role === 'broker') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    }
    // If not loading and NO user, middleware will handle redirect to /login
    // Do NOT redirect here to avoid loops
  }, [user, role, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">HartFelt Agents Portal</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
