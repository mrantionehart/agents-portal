// ============================================================================
// Agent Portal — server-side auth helper for API routes
// Used by admin routes that require broker/admin role gating.
// Matches existing pattern in app/api/auth/me/route.ts (cookie-based SSR).
// ============================================================================
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export type AdminAuthContext = {
  userId: string
  role: 'broker' | 'admin'
}

/**
 * Require an authenticated session whose profiles.role is in the allowed set.
 *
 * Returns either an AdminAuthContext on success or a NextResponse on failure.
 * Caller pattern (narrowed reliably via `instanceof NextResponse`, which works
 * regardless of TS `strict` mode):
 *
 *   const auth = await requireAdminRole()
 *   if (auth instanceof NextResponse) return auth
 *   // proceed with auth.userId / auth.role
 *
 * Fail-closed semantics: any error (cookie parse, DB lookup, missing profile,
 * unknown role) returns 401 or 403 — matching Vault Op Hardening Item 1 +
 * Portal middleware Item 6 posture. The route never silently runs with
 * elevated privileges on error.
 */
export async function requireAdminRole(
  allowed: ReadonlyArray<'broker' | 'admin'> = ['broker', 'admin'],
): Promise<AdminAuthContext | NextResponse<any>> {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete(name)
          },
        },
      },
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.warn('[hardening:phase-a] requireAdminRole profile lookup failed', {
        userId: user.id,
        error: profileError?.message,
      })
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 },
      )
    }

    const role = profile.role as string
    if (!allowed.includes(role as 'broker' | 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 },
      )
    }

    return { userId: user.id, role: role as 'broker' | 'admin' }
  } catch (err) {
    console.warn('[hardening:phase-a] requireAdminRole threw', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }
}
