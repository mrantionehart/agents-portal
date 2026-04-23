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
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(options.headers || {})
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  return fetch(url, { ...options, headers })
}
