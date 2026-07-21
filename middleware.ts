import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Middleware: authentication only ────────────────────────────────────
//
// After ONBOARD-001, middleware enforces authentication and NOTHING
// else. Onboarding routing (Platform Certification-first landing for
// un-onboarded agents) is a soft default-landing decision made at
// `/api/login/route.ts` and `app/page.tsx` — NOT a hard-lock here.
// A previous incarnation of this file (the "Vol 1 training gate") issued
// unconditional redirects to `/training` for any agent without
// `training_progress { volume: 'volume-1', volume_completed: true }`,
// which prevented pilot learners from ever reaching `/home` and
// contradicted the "may still navigate elsewhere" onboarding contract.
// The gate was removed in ONBOARD-001; the `volume_completed` flag now
// serves only as a landing signal, not an access control.
export async function middleware(request: NextRequest) {
  // Skip auth check for public pages
  const publicPaths = ['/login', '/forgot-password', '/reset-password', '/logout']
  const publicPrefixes = ['/card/', '/client/', '/api/client/', '/portal/']
  if (publicPaths.includes(request.nextUrl.pathname) || publicPrefixes.some(p => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Unauth → `/login`. That's the whole enforcement.
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

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
     * - api/* (API routes)
     * - agents/api/* (Agent Portal API routes including webhooks)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api|agents/api).*)',
  ],
}
