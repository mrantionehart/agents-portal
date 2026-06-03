import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Collect cookies that Supabase wants to set during auth
    const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookiesToSet.push({ name, value, options })
          },
          remove(name: string, options: CookieOptions) {
            cookiesToSet.push({ name, value: '', options: { ...options, maxAge: 0 } })
          },
        },
      }
    )

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // Normalize all auth failure modes to a single message to prevent
    // email enumeration via distinct error strings (Sprint 1: H1 partial).
    // Server-side log keeps the underlying Supabase reason for debugging.
    if (error) {
      console.warn(`[security:login] auth failure for ${email}: ${error.message}`)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!data.user) {
      console.warn(`[security:login] auth returned no user for ${email}`)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const role = profile?.role || 'agent'
    // Phase 4: brokers/admins operate in Vault, not the Agent Portal.
    const dashboardPath =
      role === 'admin' || role === 'broker'
        ? 'https://vault.hartfeltrealestate.com/dashboard'
        : '/dashboard'

    console.log(`✓ Login: ${email} (${role}) → ${dashboardPath}`)

    // Build the JSON response and apply all collected cookies
    const response = NextResponse.json(
      { success: true, redirectPath: dashboardPath },
      { status: 200 }
    )

    // Set each cookie on the actual response
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set({ name, value, ...options })
    }

    return response
  } catch (error: any) {
    // Server-side log retains the underlying message; client sees a
    // generic 500 to avoid leaking internals (Sprint 1: H1 partial).
    console.error('[security:login] handler error:', error?.message || error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
