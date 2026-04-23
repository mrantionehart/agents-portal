'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, authFetch } from '@/lib/supabase'

type TrainingGateInfo = {
  gateOpen: boolean
  vol1: { completed: number[]; total: number; done: boolean }
  vol2: { completed: number[]; total: number; done: boolean }
}

type AuthContextType = {
  user: User | null
  role: string | null
  loading: boolean
  trainingGate: TrainingGateInfo
  refreshTrainingGate: () => Promise<void>
  signOut: () => Promise<void>
}

const DEFAULT_GATE: TrainingGateInfo = {
  gateOpen: true, // default open until checked
  vol1: { completed: [], total: 9, done: false },
  vol2: { completed: [], total: 7, done: false },
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  trainingGate: DEFAULT_GATE,
  refreshTrainingGate: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [trainingGate, setTrainingGate] = useState<TrainingGateInfo>(DEFAULT_GATE)

  const fetchTrainingGate = async () => {
    try {
      const resp = await authFetch('/api/training/gate')
      if (resp.ok) {
        const data = await resp.json()
        setTrainingGate({
          gateOpen: data.gateOpen === true,
          vol1: data.vol1 || DEFAULT_GATE.vol1,
          vol2: data.vol2 || DEFAULT_GATE.vol2,
        })
      }
    } catch (err) {
      console.error('Training gate check failed:', err)
      // Fail open — don't lock agents out if API errors
      setTrainingGate({ ...DEFAULT_GATE, gateOpen: true })
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get user from server-side session (reads from cookies)
        const response = await authFetch('/api/auth/me')
        const { user: userData, role: userRole } = await response.json()

        if (userData) {
          setUser({ id: userData.id, email: userData.email } as any)
          setRole(userRole)
        } else {
          setUser(null)
          setRole(null)
        }
      } catch (error) {
        console.error('Auth init error:', error)
        setUser(null)
        setRole(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()
          setRole(data?.role || 'agent')
        } catch (err) {
          console.error('Error fetching role:', err)
          setRole('agent') // Default to agent role on error
        }
      } else {
        setRole(null)
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  // Fetch training gate after auth resolves
  useEffect(() => {
    if (user && role) {
      fetchTrainingGate()
    }
  }, [user, role])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    setTrainingGate(DEFAULT_GATE)
  }

  return (
    <AuthContext.Provider value={{
      user,
      role,
      loading,
      trainingGate,
      refreshTrainingGate: fetchTrainingGate,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
