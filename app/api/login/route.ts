import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeEmail } from '@/lib/ratelimit'
import { clientIp, requireRateLimit } from '@/lib/security'

// MATRIX-BROKER-ACCESS-1 — a broker/admin authenticates successfully but is
// landed on Vault by default (they operate out of Vault). To let a broker reach
// an Agent Portal surface they were deep-linked to (e.g. the Matrix Broker
// Review queue) WITHOUT weakening anything, honor a `next` param — but ONLY a
// strictly same-origin, absolute AP path. Anything else falls back to the
// unchanged default. Open-redirect safe: rejects protocol-relative (`//host`),
// any scheme, backslashes, whitespace/control chars, and any value that does
// not resolve to this origin.
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== 'string') return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (/[\s\\]/.test(next)) return null
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(next)) return null
  try {
    const base = 'https://agents.hartfeltrealestate.com'
    const u = new URL(next, base)
    if (u.origin !== base) return null
    if (!u.pathname.startsWith('/') || u.pathname.startsWith('//')) return null
    return u.pathname + u.search
  } catch {
    return null
  }
}

// Intentionally-public endpoint — anyone must be able to call /api/login
// to obtain a session. Rate limits below are the throttling layer.
// Sprint 5D marker: declares CI-enforced public intent.
export const PUBLIC_ROUTE = true

export async function POST(request: NextRequest) {
  try {
    const { email, password, next } = await request.json()

    // ---- Rate limit (Sprint 5A: H1; refactored Sprint 5D) ----
    // Two sliding-window buckets so we throttle both botnet IPs and email
    // spraying. KV-backed; fails open with telemetry if KV is unavailable
    // (deploy gap or Upstash incident). Existing Sprint 1 error
    // normalization ("Invalid email or password") is preserved for the
    // signInWithPassword paths below. 429 body comes from the wrapper —
    // standardized { error: 'Too many requests' } shape.
    const ipLimit = await requireRateLimit(
      {
        name: 'login-ip',
        identifier: clientIp(request.headers),
        limit: 5,
        window: '1 m',
      },
      request
    )
    if (ipLimit.response) return ipLimit.response

    const emailKey = normalizeEmail(email)
    if (emailKey) {
      const emailLimit = await requireRateLimit(
        {
          name: 'login-email',
          identifier: emailKey,
          limit: 10,
          window: '1 h',
        },
        request
      )
      if (emailLimit.response) return emailLimit.response
    }
    // -----------------------------------

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
      .select('role, is_active')
      .eq('id', data.user.id)
      .single()

    const role = profile?.role || 'agent'
    const isActive = profile?.is_active === true

    // ── ONBOARD-001 — Onboarding-first landing decision ─────────────────
    //
    // Brokers and admins operate out of Vault, so their destination is
    // unchanged. Agents are dispatched based on whether they have
    // completed the onboarding milestone: the very first Platform
    // Certification lesson (pcert-l01) writes a
    // `training_progress { volume: 'volume-1', volume_completed: true }`
    // row via the PILOT-D-021 bridge. That row is the single onboarding
    // signal.
    //   • Un-onboarded agent  → `/training` (Platform Certification hero,
    //     "Begin Your Journey")
    //   • Onboarded agent     → `/home` (Portal 2.0 dashboard)
    //
    // Important: this is a SOFT default-landing decision. Un-onboarded
    // agents can still navigate to `/home`, `/clients`, etc. by clicking
    // the sidebar — middleware no longer hard-blocks them (see
    // middleware.ts). The onboarding experience is a nudge, not a lock.
    //
    // Reading the flag with the authenticated Supabase client relies on
    // the standard `training_progress` RLS policy (own-row SELECT via
    // `auth.uid() = user_id`), so no service-role client is needed.
    // ── AP-INACTIVE-GATE ────────────────────────────────────────────────
    // profiles.is_active is the authoritative Agent Portal access signal.
    // Inactive users (invitees not yet promoted, suspended agents, or any
    // missing/erroring profile row) must land on /pending-activation
    // instead of any protected surface. The session IS still created so
    // that page can render for the authenticated caller.
    let redirectPath: string
    if (!isActive) {
      redirectPath = '/pending-activation'
    } else if (role === 'admin' || role === 'broker') {
      // Default stays Vault. A broker deep-linked to an AP surface (e.g. the
      // Matrix Broker Review queue) may be routed there via a same-origin
      // `next` path only; any unsafe/absent value keeps the unchanged default.
      redirectPath = safeNextPath(next) ?? 'https://vault.hartfeltrealestate.com/dashboard'
    } else {
      const { data: progress } = await supabase
        .from('training_progress')
        .select('volume_completed')
        .eq('user_id', data.user.id)
        .eq('volume', 'volume-1')
        .maybeSingle()
      const onboarded = progress?.volume_completed === true
      redirectPath = onboarded ? '/home' : '/training'
    }

    console.log(`✓ Login: ${email} (${role}) → ${redirectPath}`)

    // Build the JSON response and apply all collected cookies
    const response = NextResponse.json(
      { success: true, redirectPath: redirectPath },
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
