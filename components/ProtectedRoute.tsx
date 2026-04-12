'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import LoadingSpinner from './LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'agent' | 'admin' | 'broker'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }

    if (!loading && user && requiredRole && role !== requiredRole) {
      if (requiredRole === 'admin' || requiredRole === 'broker') {
        if (role !== 'admin' && role !== 'broker') {
          router.push('/dashboard')
        }
      }
    }
  }, [user, loading, role, requiredRole, router])

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return null
  }

  if (requiredRole && role !== requiredRole) {
    if (requiredRole === 'admin' || requiredRole === 'broker') {
      if (role !== 'admin' && role !== 'broker') {
        return null
      }
    }
  }

  return <>{children}</>
}
