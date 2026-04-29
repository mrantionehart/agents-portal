import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Pages that agents can access even before completing Vol 1 training
const TRAINING_GATE_ALLOWED = ['/login', '/forgot-password', '/reset-password', '/training', '/training-interactive']

export async function middleware(request: NextRequest) {
  // Skip auth check for public pages
  const publicPaths = ['/login', '/forgot-password', '/reset-password']
  if (publicPaths.includes(request.nextUrl.pathname)) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

  let response = NextResponse.next({
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

  // If user is NOT logged in and trying to access protected routes, redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ─── Training Gate ─────────────────────────────────────────────────
  // Check if the current path is already allowed (training pages, login)
  const path = request.nextUrl.pathname
  const isAllowedPath = TRAINING_GATE_ALLOWED.some(
    (p) => path === p || path.startsWith(p + '/')
  )

  if (!isAllowedPath) {
    try {
      // Use service role to bypass RLS for this check
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Get user role
      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role || 'agent'

      // Only gate agents — brokers and admins always pass
      if (role === 'agent') {
        const { data: progress } = await admin
          .from('training_progress')
          .select('volume_completed')
          .eq('user_id', user.id)
          .eq('volume', 'volume-1')
          .single()

        if (!progress?.volume_completed) {
          return NextResponse.redirect(new URL('/training', request.url))
        }
      }
    } catch (err) {
      // Fail open — if the check fails, let them through
      console.error('Training gate middleware error:', err)
    }
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
