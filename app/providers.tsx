'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, authFetch } from '@/lib/supabase'
import { clearAllLearnerResumeForUser } from '@/src/portal/tour/persistence-learner'

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
        // Use plain fetch instead of authFetch to avoid getSession() deadlock.
        // The /api/auth/me route reads cookies server-side — no Bearer token needed.
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        try {
          const response = await fetch('/api/auth/me', { signal: controller.signal })
          clearTimeout(timeout)

          if (!response.ok) {
            setUser(null)
            setRole(null)
            return
          }
          const { user: userData, role: userRole } = await response.json()

          if (userData) {
            setUser({ id: userData.id, email: userData.email } as any)
            setRole(userRole)
          } else {
            setUser(null)
            setRole(null)
          }
        } catch (fetchErr) {
          clearTimeout(timeout)
          console.warn('Auth init fetch failed:', fetchErr)
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

    // GoTrue invokes onAuthStateChange callbacks WHILE HOLDING the
    // `sb-<ref>-auth-token` navigator Web Lock. Calling any lock-acquiring Supabase
    // method (getSession / getUser / .from()) synchronously inside the callback
    // re-enters that same lock and DEADLOCKS it — the callback awaits a query that
    // needs the lock the callback itself is holding. That is what hung the profile
    // page's fetchProfile (it could never acquire the lock), and it was aggravated
    // across tabs because Web Locks are shared per-origin. Keep this callback
    // lock-free: synchronous state only, and defer any role/Supabase work to a
    // macrotask so it runs AFTER the callback returns and the lock is released.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (!session?.user) {
        setRole(null)
        return
      }
      // Resolve role WITHOUT the client auth lock: /api/auth/me reads the session
      // cookie server-side (no navigator lock, no Bearer). Deferred to a macrotask
      // so it never runs inside the lock-held callback.
      setTimeout(() => {
        fetch('/api/auth/me')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d?.role) setRole(d.role) })
          .catch(() => { /* keep last-known role; initAuth already set it from /api/auth/me */ })
      }, 0)
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
    // Wipe learner-mode guided-tour resume cache BEFORE the auth
    // handshake so a partial failure never leaves stale state keyed
    // to the outgoing user.
    try {
      clearAllLearnerResumeForUser(user?.id ?? null)
    } catch {
      // Storage may be unavailable (private mode, quota). Non-fatal.
    }
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
