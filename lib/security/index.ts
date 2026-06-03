// ============================================================================
// Agent Portal — Security barrel (Sprint 5D)
// ============================================================================
// Single import surface for the route security wrappers. New route handlers
// should pull all of withAuth / withRateLimit / withWebhookSignature from
// this module rather than from individual files.
//
// The PUBLIC_ROUTE marker is the explicit opt-out used by intentionally
// public endpoints (login, forgot-password, card slug, news, autocomplete).
// The CI check at scripts/check-api-routes.js asserts every new route.ts
// either uses one of the wrappers or sets `export const PUBLIC_ROUTE = true`.
// ============================================================================

export {
  type AuthedUser,
  getAuthedUser,
  requireAuth,
  userClient,
  withAuth,
} from './withAuth'

export {
  type Bucket,
  requireRateLimit,
  withRateLimit,
  clientIp,
} from './withRateLimit'

export {
  type WebhookSignatureConfig,
  verifyHmacSignature,
  requireWebhookSignature,
  withWebhookSignature,
} from './withWebhookSignature'
