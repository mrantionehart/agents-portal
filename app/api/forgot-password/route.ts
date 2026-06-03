// ============================================================================
// POST /api/forgot-password  (Security Sprint 5A)
// ============================================================================
// Server-side wrapper for Supabase password reset that adds per-IP and
// per-email rate limits. Always returns { success: true } regardless of
// whether the email exists, the reset email succeeded, or the rate limit
// was tripped — no enumeration surface. Underlying outcomes are logged
// server-side under [security:forgot-password] for ops visibility.
// ============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIp, normalizeEmail } from '@/lib/ratelimit'

const ALWAYS_SUCCESS = NextResponse.json({ success: true }, { status: 200 })

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Malformed JSON — still return success (no enumeration)
      console.warn('[security:forgot-password] malformed body')
      return ALWAYS_SUCCESS
    }

    const ip = clientIp(request.headers)
    const emailKey = normalizeEmail(body?.email)
    const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : undefined

    // ---- Rate limit ----
    const ipCheck = await checkRateLimit('forgot-ip', ip, 3, '1 h')
    if (!ipCheck.ok) {
      console.warn(
        '[security:forgot-password] ip limit hit',
        { reset: ipCheck.reset }
      )
      return ALWAYS_SUCCESS
    }

    if (emailKey) {
      const emailCheck = await checkRateLimit('forgot-email', emailKey, 3, '1 h')
      if (!emailCheck.ok) {
        console.warn(
          '[security:forgot-password] email limit hit',
          { reset: emailCheck.reset }
        )
        return ALWAYS_SUCCESS
      }
    } else {
      // No email provided — nothing to do, but don't leak that.
      return ALWAYS_SUCCESS
    }

    // ---- Initiate reset ----
    // Anon client; resetPasswordForEmail does not require a session.
    // No-op cookie handlers — this endpoint does not modify the session.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get() { return undefined },
          set(_n: string, _v: string, _o: CookieOptions) {},
          remove(_n: string, _o: CookieOptions) {},
        },
      }
    )

    const { error } = await supabase.auth.resetPasswordForEmail(emailKey, {
      redirectTo,
    })

    if (error) {
      // Log; still return success (no enumeration of valid/invalid emails).
      console.warn(
        '[security:forgot-password] supabase reset error',
        { code: (error as any).status, message: error.message }
      )
    } else {
      console.log('[security:forgot-password] reset initiated')
    }

    return ALWAYS_SUCCESS
  } catch (err: any) {
    // Never leak internals; always return success.
    console.error(
      '[security:forgot-password] handler error',
      err?.message || String(err)
    )
    return ALWAYS_SUCCESS
  }
}
