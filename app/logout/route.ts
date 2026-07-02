import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// AGENT.SIGN.2D.1 — the TopBar "Sign out" links to `/logout`, which had no
// route (→ 404), so the session could never be cleared in a normal window.
// This handler signs the user out server-side (clearing the @supabase/ssr
// auth cookies via the remove handler) and redirects to /login. A plain GET,
// matching the existing `<a href="/logout">` navigation.
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    }
  )

  try {
    await supabase.auth.signOut()
  } catch {
    // Best-effort — even if the provider call fails, the redirect below sends
    // the user to /login and the middleware will re-gate any stale session.
  }

  return response
}
