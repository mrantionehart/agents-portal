// ============================================================================
// Agent Portal — Rate-limit wrapper (Security Sprint 5D)
// ============================================================================
// Thin wrapper around the existing lib/ratelimit.ts helper. Adds:
//   * Standardized 429 response shape: { error: 'Too many requests' }
//   * HOF style for routes whose limits run before any other logic
//   * Helper style for routes whose limits interleave with parsing
//
// Both styles flow through `checkRateLimit` from lib/ratelimit.ts, so the
// fail-open semantics and [security:ratelimit] log format established in
// Sprint 5A apply uniformly.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIp } from '@/lib/ratelimit'

type WindowSpec = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`

export type Bucket = {
  /** Bucket name, e.g. 'card-ip'. Becomes part of the Upstash key prefix. */
  name: string
  /** Window expression understood by @upstash/ratelimit (e.g. '1 m'). */
  window: WindowSpec
  /** Allowed requests per window. */
  limit: number
  /**
   * How to derive the identifier (IP, user id, transaction id, …).
   * String form: a constant identifier. Function form: computed per-request.
   */
  identifier: string | ((req: NextRequest) => string)
}

// Build a fresh NextResponse on every call — Sprint 5A lesson learned.
const tooManyRequests = () =>
  NextResponse.json({ error: 'Too many requests' }, { status: 429 })

function resolveIdentifier(bucket: Bucket, req: NextRequest): string {
  return typeof bucket.identifier === 'function'
    ? bucket.identifier(req)
    : bucket.identifier
}

/**
 * Helper variant. Pass a single bucket or array; the first bucket that
 * trips returns a 429. Fail-open behavior is preserved by checkRateLimit
 * itself when KV is unavailable.
 *
 * Usage:
 *   const limit = await requireRateLimit(
 *     { name: 'login-ip', identifier: ip, limit: 5, window: '1 m' },
 *     request
 *   )
 *   if (limit.response) return limit.response
 */
export async function requireRateLimit(
  buckets: Bucket | Bucket[],
  request: NextRequest
): Promise<{ response: NextResponse } | { response?: undefined }> {
  const list = Array.isArray(buckets) ? buckets : [buckets]
  for (const bucket of list) {
    const id = resolveIdentifier(bucket, request)
    const outcome = await checkRateLimit(
      bucket.name,
      id,
      bucket.limit,
      bucket.window
    )
    if (!outcome.ok) return { response: tooManyRequests() }
  }
  return {}
}

/**
 * HOF wrapper. All buckets are checked sequentially before the handler runs.
 * For dynamic routes, params are forwarded.
 *
 * Usage:
 *   export const GET = withRateLimit(
 *     { name: 'card-ip', identifier: clientIp, limit: 30, window: '1 m' },
 *     async (req, { params }) => { ... }
 *   )
 *
 * The `clientIp` import is re-exported below so route files don't need to
 * import from two different modules.
 */
export function withRateLimit<P = unknown>(
  buckets: Bucket | Bucket[],
  handler: (
    request: NextRequest,
    ctx: { params?: P }
  ) => Promise<NextResponse> | NextResponse
) {
  return async (
    request: NextRequest,
    route?: { params: P }
  ): Promise<NextResponse> => {
    const check = await requireRateLimit(buckets, request)
    if (check.response) return check.response
    return handler(request, { params: route?.params })
  }
}

// Re-export the IP extractor so wrappers and handlers can pull from a
// single security barrel.
export { clientIp }
