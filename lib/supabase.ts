import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// ── PORTAL.1A — cached access token ─────────────────────────────────────────
// authFetch / vault-api must NEVER call supabase.auth.getSession() on the
// request path: it intermittently hangs on the navigator LockManager, and the
// old code then sent Vault requests with no Bearer → 401 → "Sign-in expired".
// Instead we cache the access token from a single onAuthStateChange
// subscription (push-based, no lock, no network) and read it synchronously.
let cachedAccessToken: string | undefined

// Subscribe once, in the browser only. onAuthStateChange fires INITIAL_SESSION
// as soon as the client hydrates its session from cookies, then SIGNED_IN /
// TOKEN_REFRESHED / SIGNED_OUT thereafter — so the cache stays current without
// ever polling getSession().
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      cachedAccessToken = undefined
    } else if (
      event === 'INITIAL_SESSION' ||
      event === 'SIGNED_IN' ||
      event === 'TOKEN_REFRESHED' ||
      event === 'USER_UPDATED'
    ) {
      cachedAccessToken = session?.access_token ?? undefined
    }
  })
}

/** Synchronously returns the cached access token (undefined if not hydrated). */
export function getCachedAccessToken(): string | undefined {
  return cachedAccessToken
}

/**
 * Returns the access token: cached value synchronously, or — when the cache is
 * cold (very early, before INITIAL_SESSION) — waits briefly for the next
 * onAuthStateChange event. NEVER calls getSession(). Bounded by timeoutMs.
 */
export async function getAccessToken(timeoutMs = 2000): Promise<string | undefined> {
  if (cachedAccessToken) return cachedAccessToken
  return new Promise<string | undefined>((resolve) => {
    let sub: { unsubscribe: () => void } | undefined
    const giveUp = setTimeout(() => {
      sub?.unsubscribe()
      resolve(cachedAccessToken)
    }, timeoutMs)
    const result = supabase.auth.onAuthStateChange((_event, session) => {
      const tok = session?.access_token
      if (tok) {
        cachedAccessToken = tok
        clearTimeout(giveUp)
        sub?.unsubscribe()
        resolve(tok)
      }
    })
    sub = result.data.subscription
  })
}

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
 * Authenticated fetch — attaches the Bearer token from the CACHED Supabase
 * session (never getSession()). On a 401 with a token that was rejected, it
 * refreshes once and retries once (self-heal), so an expired token recovers
 * without a full page reload.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Overall bound so a hung network / refresh can never leave the caller stuck.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    // 1. Cached token synchronously; 2. cold cache → brief onAuthStateChange
    //    wait. NEVER calls getSession() (the LockManager hang point).
    const accessToken = await getAccessToken(2000)

    const doFetch = (token: string | undefined) => {
      const headers = new Headers(options.headers || {})
      if (token) headers.set('Authorization', `Bearer ${token}`)
      else headers.delete('Authorization')
      return fetch(url, { ...options, headers, signal: controller.signal })
    }

    let res = await doFetch(accessToken)

    // 3. 401 self-heal — only when we actually sent a token (so this is a
    //    stale/expired token, not a logged-out caller). Refresh once (bounded)
    //    + retry once. No infinite retries.
    if (res.status === 401 && accessToken) {
      try {
        const refreshResult = await Promise.race([
          supabase.auth.refreshSession(),
          new Promise<{ data: { session: null }; error: Error }>((resolve) =>
            setTimeout(
              () => resolve({ data: { session: null }, error: new Error('refresh timeout') }),
              3000
            )
          ),
        ])
        const refreshed = refreshResult.data?.session?.access_token
        if (!refreshResult.error && refreshed) {
          cachedAccessToken = refreshed
          res = await doFetch(refreshed)
        }
        // else: refresh failed/timed out → fall through, return the original 401.
      } catch (refreshErr) {
        console.warn('authFetch: refreshSession failed after 401:', refreshErr)
      }
    }

    return res
  } finally {
    clearTimeout(timeout)
  }
}
