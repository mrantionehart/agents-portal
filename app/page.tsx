'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './providers'

export default function HomePage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const redirected = useRef(false)

  // Hard fallback: if still on this page after 6 seconds, force redirect to /login
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!redirected.current) {
        console.warn('[Root] Auth timeout — forcing redirect to /login')
        window.location.href = '/login'
      }
    }, 6000)
    return () => clearTimeout(fallback)
  }, [])

  useEffect(() => {
    if (loading) return

    redirected.current = true

    if (user) {
      if (role === 'admin' || role === 'broker') {
        window.location.href = '/admin/dashboard'
      } else {
        window.location.href = '/dashboard'
      }
    } else {
      window.location.href = '/login'
    }
  }, [user, role, loading])

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050507]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">HartFelt Agents Portal</h1>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    </div>
  )
}
