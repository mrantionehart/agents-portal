'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './providers'

export default function HomePage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (user) {
      // Route based on user role
      if (role === 'admin' || role === 'broker') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    } else {
      // No user — send to login
      router.push('/login')
    }
  }, [user, role, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050507]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">HartFelt Agents Portal</h1>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}
