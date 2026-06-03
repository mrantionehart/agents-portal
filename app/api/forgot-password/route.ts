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
import { normalizeEmail } from '@/lib/ratelimit'
import { clientIp, requireRateLimit } from '@/lib/security'

// Intentionally-public endpoint — unauthenticated callers must reach it to
// initiate password reset. Always-success response shape prevents email
// enumeration regardless of rate-limit state. (Sprint 5D marker.)
export const PUBLIC_ROUTE = true

// Build a fresh NextResponse on every call — a shared module-level instance
// would have its body stream consumed after the first return and send empty
// bodies on subsequent requests.
const alwaysSuccess = () =>
  NextResponse.json({ success: true }, { status: 200 })

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Malformed JSON — still return success (no enumeration)
      console.warn('[security:forgot-password] malformed body')
      return alwaysSuccess()
    }

    const ip = clientIp(request.headers)
    const emailKey = normalizeEmail(body?.email)
    const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : undefined

    // ---- Rate limit (Sprint 5A; refactored Sprint 5D) ----
    // NB: trips return alwaysSuccess() — NOT the wrapper's 429 — to
    // preserve the no-enumeration contract. The wrapper response is
    // intentionally discarded; we still log the trip for ops visibility.
    const ipLimit = await requireRateLimit(
      { name: 'forgot-ip', identifier: ip, limit: 3, window: '1 h' },
      request
    )
    if (ipLimit.response) {
      console.warn('[security:forgot-password] ip limit hit')
      return alwaysSuccess()
    }

    if (emailKey) {
      const emailLimit = await requireRateLimit(
        { name: 'forgot-email', identifier: emailKey, limit: 3, window: '1 h' },
        request
      )
      if (emailLimit.response) {
        console.warn('[security:forgot-password] email limit hit')
        return alwaysSuccess()
      }
    } else {
      // No email provided — nothing to do, but don't leak that.
      return alwaysSuccess()
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

    return alwaysSuccess()
  } catch (err: any) {
    // Never leak internals; always return success.
    console.error(
      '[security:forgot-password] handler error',
      err?.message || String(err)
    )
    return alwaysSuccess()
  }
}
