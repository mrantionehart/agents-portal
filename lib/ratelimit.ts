// ============================================================================
// Agent Portal — Rate-limit helper (Security Sprint 5A)
// ============================================================================
// Sliding-window rate limiter backed by Upstash Redis (or Vercel KV, which is
// Upstash under the hood). Used route-side via checkRateLimit(name, key, …).
//
// FAIL-OPEN POLICY
// ----------------
// If the KV/Redis env vars are absent OR the live check throws, this helper
// returns { ok: true, bypass: true } and emits a [security:ratelimit]
// warning. Rationale:
//   * KV outages must not break login. Brief un-rate-limited windows during a
//     real outage are preferable to denying every authentication attempt.
//   * During the deploy gap between code-landing and KV-provisioning, the
//     route behaves exactly like the pre-Sprint-5A implementation.
// All bypass events are logged loudly so operators can detect and fix.
//
// SUPPORTED ENV VARS
// ------------------
// Either pair (set whichever the platform exposes):
//   UPSTASH_REDIS_REST_URL  + UPSTASH_REDIS_REST_TOKEN   (Upstash direct)
//   KV_REST_API_URL         + KV_REST_API_TOKEN          (Vercel KV)
//
// STRUCTURED LOGS
// ---------------
// Every event is prefixed [security:ratelimit] for grep/observability.
// Identifiers (email, IP) are redacted before logging — full values stay
// only on the wire to Upstash for the sliding-window count.
// ============================================================================

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type WindowSpec = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`

let redisSingleton: Redis | null = null
let redisInitTried = false

function getRedis(): Redis | null {
  if (redisInitTried) return redisSingleton
  redisInitTried = true
  try {
    const url =
      process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const token =
      process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    if (!url || !token) {
      console.warn(
        '[security:ratelimit] KV not configured — rate-limit checks will fail open',
        { hasUrl: !!url, hasToken: !!token }
      )
      return null
    }
    redisSingleton = new Redis({ url, token })
    return redisSingleton
  } catch (err) {
    console.warn(
      '[security:ratelimit] redis init failed — failing open',
      { error: err instanceof Error ? err.message : String(err) }
    )
    return null
  }
}

// Cache Ratelimit instances per (name, limit, window) so we don't reconstruct
// them per request.
const limiterCache = new Map<string, Ratelimit>()

function getLimiter(
  name: string,
  limit: number,
  window: WindowSpec
): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  const cacheKey = `${name}|${limit}|${window}`
  const cached = limiterCache.get(cacheKey)
  if (cached) return cached
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
    prefix: `hf:rl:${name}`,
  })
  limiterCache.set(cacheKey, rl)
  return rl
}

export type LimitOutcome = {
  /** true if the request is permitted; false if blocked. Always true on bypass. */
  ok: boolean
  /** approximate requests remaining in the window */
  remaining: number
  /** UNIX millis when the window resets */
  reset: number
  /** true if KV was unavailable and we failed open */
  bypass: boolean
}

/**
 * Check a sliding-window rate limit for the given identifier.
 * Always returns { ok: true, bypass: true } if KV is unavailable.
 */
export async function checkRateLimit(
  name: string,
  identifier: string,
  limit: number,
  window: WindowSpec
): Promise<LimitOutcome> {
  const limiter = getLimiter(name, limit, window)
  if (!limiter) {
    return { ok: true, remaining: limit, reset: 0, bypass: true }
  }
  try {
    const { success, remaining, reset } = await limiter.limit(identifier)
    if (!success) {
      console.warn(
        '[security:ratelimit] limit exceeded',
        {
          name,
          identifier: redact(identifier),
          limit,
          window,
          remaining,
          reset,
        }
      )
    }
    return { ok: success, remaining, reset, bypass: false }
  } catch (err) {
    console.warn(
      '[security:ratelimit] check failed — failing open',
      {
        name,
        identifier: redact(identifier),
        error: err instanceof Error ? err.message : String(err),
      }
    )
    return { ok: true, remaining: limit, reset: 0, bypass: true }
  }
}

/**
 * Extract the client IP from a Next.js request's headers. On Vercel the
 * `x-forwarded-for` header is set by the platform and cannot be spoofed by
 * the client. Falls back to `x-real-ip`, then 'unknown'.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xreal = headers.get('x-real-ip')
  if (xreal) return xreal.trim()
  return 'unknown'
}

/**
 * Lowercase + trim an email so casing/whitespace variants share the same
 * rate-limit bucket.
 */
export function normalizeEmail(raw: string | null | undefined): string {
  if (!raw) return ''
  return String(raw).trim().toLowerCase()
}

/**
 * Redact an identifier for logging. Emails: keep first 2 chars + domain.
 * IPv4: keep first 3 octets. Anything else: keep first 4 chars.
 */
function redact(id: string): string {
  if (!id) return '<empty>'
  if (id.includes('@')) {
    const [user, domain] = id.split('@')
    const head = (user || '').slice(0, 2)
    return `${head}***@${domain || '?'}`
  }
  const parts = id.split('.')
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`
  }
  return `${id.slice(0, 4)}***`
}
