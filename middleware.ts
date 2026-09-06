import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Middleware: authentication + is_active gate ────────────────────────
//
// After ONBOARD-001, middleware enforces authentication and NOTHING
// else. Onboarding routing (Platform Certification-first landing for
// un-onboarded agents) is a soft default-landing decision made at
// `/api/login/route.ts` and `app/page.tsx` — NOT a hard-lock here.
//
// ── AP-INACTIVE-GATE (this file) ───────────────────────────────────────
// Adds an is_active gate to prevent inactive-authenticated users from
// reaching protected pages. The AP historically only checked "valid
// Supabase session + role='agent'" — an inactive invitee or a suspended
// agent could still browse the portal. Fixed here.
//
// Order of enforcement (matches the design lock):
//   1. Public path → allow (never gated)
//   2. Missing session → /login
//   3. Session + pathname === '/pending-activation' → allow (loop-safe;
//      pending-activation is exempt from the is_active gate but still
//      requires auth)
//   4. Session + is_active === false → /pending-activation
//   5. Session + is_active === true → next()
//
// Profile lookup uses the same SSR client (RLS-safe: profiles has a
// self-read policy). If the lookup errors or the profile row is absent,
// the middleware fails CLOSED — treats the user as inactive and redirects
// to /pending-activation. Never grants access on error.
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── STEP 1 — public paths / prefixes ─────────────────────────────────
  const publicPaths = ['/login', '/forgot-password', '/reset-password', '/logout']
  const publicPrefixes = ['/card/', '/client/', '/api/client/', '/portal/']
  if (
    publicPaths.includes(pathname) ||
    publicPrefixes.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  const response = NextResponse.next({ request: { headers: request.headers } })

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
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── STEP 2 — no session → /login ─────────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── STEP 3 — /pending-activation is exempt from the is_active gate ───
  // Authenticated users can always reach this page (loop prevention +
  // affordance for inactive users to see their state).
  if (pathname === '/pending-activation') {
    return response
  }

  // ── STEP 4 — is_active gate. Fail closed on error / missing row. ─────
  let isActive = false
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()
    isActive = profile?.is_active === true
  } catch {
    isActive = false
  }

  if (!isActive) {
    return NextResponse.redirect(new URL('/pending-activation', request.url))
  }

  // ── STEP 5 — active → proceed ────────────────────────────────────────
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/* (API routes — is_active gate applied via requireAuth instead)
     * - agents/api/* (Agent Portal API routes including webhooks)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api|agents/api).*)',
  ],
}
