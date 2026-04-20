'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'

/**
 * TrainingGate — wraps page content and redirects agents to /training
 * if they haven't completed Volume 1. Brokers/admins always pass.
 *
 * Usage:
 *   <TrainingGate>
 *     <YourPageContent />
 *   </TrainingGate>
 */
export default function TrainingGate({ children }: { children: React.ReactNode }) {
  const { user, role, loading, trainingGate } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Wait for auth + training gate to load
    if (loading || !user || !role) return

    // Brokers/admins always pass
    if (role === 'broker' || role === 'admin') return

    // If gate is closed, redirect to training
    if (!trainingGate.gateOpen) {
      router.replace('/training')
    }
  }, [loading, user, role, trainingGate.gateOpen, router])

  // While loading, show nothing (the page's own loading state handles this)
  if (loading) return null

  // If agent hasn't passed gate, show nothing while redirecting
  if (role === 'agent' && !trainingGate.gateOpen) return null

  return <>{children}</>
}
