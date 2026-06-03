// ============================================================================
// Agent Portal — Auth wrapper (Security Sprint 5D)
// ============================================================================
// Centralized authentication for API routes. Replaces the per-route copies
// of `getAuthedUser` that drifted across the codebase (compliance/upload,
// new-leads, et al each had a verbatim duplicate with subtle differences).
//
// Usage patterns
// --------------
//   1. HOF (clean fit for simple routes):
//        export const GET = withAuth(async (req, { user }) => { ... })
//
//   2. Helper (when routes need interleaved auth + rate-limit + formData):
//        export async function POST(req: NextRequest) {
//          const auth = await requireAuth(req)
//          if (auth.response) return auth.response
//          const user = auth.user
//          // ... rest of handler
//        }
//
// Both styles flow through the same `getAuthedUser` extraction so the
// underlying behavior is identical.
//
// Auth modes supported
// --------------------
//   * Authorization: Bearer <token>      (mobile / direct API clients)
//   * Supabase session cookie            (browser-set by @supabase/ssr)
//
// Returns 401 with `{ error: 'Unauthorized' }` on missing/invalid session.
// ============================================================================

import { createClient, User } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export type AuthedUser = User

const UNAUTHORIZED_BODY = { error: 'Unauthorized' } as const

// Build a fresh NextResponse on every call — Sprint 5A lesson learned;
// module-scope responses have their body stream consumed on first read.
const unauthorized = () => NextResponse.json(UNAUTHORIZED_BODY, { status: 401 })

/**
 * Extract the authenticated user from a request. Returns null if no valid
 * session is present. Does NOT log on absence — the caller is expected to
 * decide whether absence is an error or just a public-route signal.
 */
export async function getAuthedUser(
  request: NextRequest
): Promise<AuthedUser | null> {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) return null
      return data.user
    } catch {
      return null
    }
  }

  try {
    // Stub response holds any session cookies the SSR client wants to set
    // during getUser() (e.g. token refresh). We discard it — auth.me /
    // login are the routes that actually update cookies.
    const stubResponse = NextResponse.json({})
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            stubResponse.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            stubResponse.cookies.delete({ name, ...options })
          },
        },
      }
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

/**
 * Helper: { response, user? } discriminated union.
 * Usage:
 *   const auth = await requireAuth(request)
 *   if (auth.response) return auth.response
 *   const user = auth.user
 */
export async function requireAuth(
  request: NextRequest
): Promise<
  | { response: NextResponse; user?: undefined }
  | { user: AuthedUser; response?: undefined }
> {
  const user = await getAuthedUser(request)
  if (!user) return { response: unauthorized() }
  return { user }
}

/**
 * HOF wrapper. The handler receives the authenticated user in the context.
 * For dynamic routes the second argument carries `params`; pass it through.
 */
export function withAuth<P = unknown>(
  handler: (
    request: NextRequest,
    ctx: { user: AuthedUser; params?: P }
  ) => Promise<NextResponse> | NextResponse
) {
  return async (
    request: NextRequest,
    route?: { params: P }
  ): Promise<NextResponse> => {
    const user = await getAuthedUser(request)
    if (!user) return unauthorized()
    return handler(request, { user, params: route?.params })
  }
}
