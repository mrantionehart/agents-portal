// ============================================================================
// Agent Portal — Webhook signature wrapper (Security Sprint 5D)
// ============================================================================
// HMAC-SHA256 signature verification, centralized. Replaces the per-route
// copies of `verifyDocuSignSignature` that had drifted between the
// onboarding and docusign webhooks (one included an explicit length check
// before timingSafeEqual; the other did not — a real correctness gap that
// this wrapper eliminates).
//
// Constant-time comparison (`timingSafeEqual`) is enforced. Length is
// checked explicitly before the comparison because timingSafeEqual throws
// on length mismatch — the explicit short-circuit returns false instead.
//
// Usage patterns
// --------------
//   1. HOF (clean fit; handler receives the raw body):
//        export const POST = withWebhookSignature(
//          { header: 'X-Docusign-Signature-1', secret: process.env.DOCUSIGN_WEBHOOK_SECRET, logPrefix: '[security:docusign-webhook]' },
//          async (req, { rawBody }) => { ... }
//        )
//
//   2. Helper:
//        const verify = await requireWebhookSignature(req, { header: ..., secret: ... })
//        if (verify.response) return verify.response
//        const rawBody = verify.rawBody
//
// Returns 401 `{ error: 'Unauthorized: invalid signature' }` on failure to
// match the established DocuSign-style rejection contract.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export type WebhookSignatureConfig = {
  /** Header name carrying the signature, e.g. 'X-Docusign-Signature-1'. */
  header: string
  /** Secret used to compute the HMAC. Usually pulled from process.env. */
  secret: string | undefined
  /**
   * Output encoding of the digest. DocuSign uses base64. Stripe-style
   * webhooks use hex. Default: base64.
   */
  encoding?: 'base64' | 'hex'
  /** Log prefix for ops correlation, e.g. '[security:docusign-webhook]'. */
  logPrefix?: string
}

const INVALID_SIG_BODY = { error: 'Unauthorized: invalid signature' } as const

// Build a fresh NextResponse on every call — Sprint 5A lesson.
const invalidSignature = () =>
  NextResponse.json(INVALID_SIG_BODY, { status: 401 })

/**
 * Pure HMAC-SHA256 verification. Constant-time. Returns false on:
 *   * Missing signature header
 *   * Missing/empty secret
 *   * Length mismatch (timingSafeEqual would throw)
 *   * Digest mismatch
 *   * Any thrown exception during compute
 */
export function verifyHmacSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
  encoding: 'base64' | 'hex' = 'base64'
): boolean {
  if (!signature || !secret) return false
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest(encoding)
    const sigBuf = Buffer.from(signature, 'utf8')
    const expBuf = Buffer.from(expected, 'utf8')
    if (sigBuf.length !== expBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

/**
 * Helper variant. Consumes the request body once (req.text()), verifies,
 * and hands the rawBody back to the caller for re-parsing.
 */
export async function requireWebhookSignature(
  request: NextRequest,
  config: WebhookSignatureConfig
): Promise<
  | { response: NextResponse; rawBody?: undefined }
  | { rawBody: string; response?: undefined }
> {
  const rawBody = await request.text()
  const signature = request.headers.get(config.header)
  if (!verifyHmacSignature(rawBody, signature, config.secret, config.encoding)) {
    if (config.logPrefix) {
      console.error(`${config.logPrefix} invalid signature`, {
        hasSignature: !!signature,
        hasSecret: !!config.secret,
      })
    }
    return { response: invalidSignature() }
  }
  return { rawBody }
}

/**
 * HOF wrapper. The handler receives the verified raw body in the context
 * so it doesn't have to consume the stream a second time. Params are
 * forwarded for dynamic routes.
 */
export function withWebhookSignature<P = unknown>(
  config: WebhookSignatureConfig,
  handler: (
    request: NextRequest,
    ctx: { rawBody: string; params?: P }
  ) => Promise<NextResponse> | NextResponse
) {
  return async (
    request: NextRequest,
    route?: { params: P }
  ): Promise<NextResponse> => {
    const verify = await requireWebhookSignature(request, config)
    if (verify.response) return verify.response
    return handler(request, { rawBody: verify.rawBody, params: route?.params })
  }
}
