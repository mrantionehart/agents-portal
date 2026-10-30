import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ACTIVE_PROFILE_SELECT, isActiveProfile } from '@/lib/security/activeProfile'

// ── Middleware: authentication + account-standing gate ─────────────────
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
//   4. Session + standing is not active → /pending-activation
//   5. Session + standing IS active → next()
//
// ── P8.1C-SEC ──────────────────────────────────────────────────────────
// Step 4 used to read `is_active` ALONE. `profiles` carries THREE
// independent standing signals and a Vault soft-delete writes only
// `deleted_at`, so a removed broker whose `is_active` was never flipped
// walked straight through this gate for six months
// (`349fdfb8-9d12-4826-a1a9-5e7e970b5319`). Standing is now decided by
// `isActiveProfile` in lib/security/activeProfile.ts — the one predicate
// this file and `requireAuth` share.
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

  // ── STEP 4 — account-standing gate. Fail closed on error / missing row. ─
  // P8.1C-SEC — was `is_active` ALONE, which admitted a profile that Vault
  // had soft-deleted (`deleted_at` set, `is_active` left true). All three
  // signals now, through the one predicate in lib/security/activeProfile.ts.
  // The select goes through ACTIVE_PROFILE_SELECT because an unselected
  // column comes back `undefined` and would read as "no marker".
  let isActive = false
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select(ACTIVE_PROFILE_SELECT)
      .eq('id', user.id)
      .single()
    isActive = isActiveProfile(profile)
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
