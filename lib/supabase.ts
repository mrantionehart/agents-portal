import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'agent' | 'admin' | 'broker' | 'office_manager'

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) return 'agent'
  return (data?.role as UserRole) || 'agent'
}

export async function getAuthUser() {
  return getCurrentUser()
}

export async function signInWithPassword(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password })
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (!error && data.user) {
    // Create profile entry
    await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role: 'agent',
      })
      .single()
  }

  return { data, error }
}

export async function signOut() {
  return await supabase.auth.signOut()
}

/**
 * Authenticated fetch — automatically includes Bearer token from Supabase session.
 * Use this instead of raw fetch() for all API routes that need auth.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Timeout covers the ENTIRE operation (getSession + fetch) to prevent infinite hang
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    // Wrap getSession in its own timeout — this is the most common hang point
    let accessToken: string | undefined
    try {
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout')), 5000)
        ),
      ])
      accessToken = sessionResult.data?.session?.access_token
    } catch (sessionErr) {
      console.warn('authFetch: getSession failed/timed out, proceeding without token:', sessionErr)
    }

    const headers = new Headers(options.headers || {})
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
    return await fetch(url, { ...options, headers, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
