// ============================================================================
// Agent Portal — Service-role intent wrapper (Sprint 8B Phase 3)
// ============================================================================
// Every legitimate use of SUPABASE_SERVICE_ROLE_KEY in the Agent Portal
// flows through this single chokepoint. The wrapper does NOT change behavior
// — it returns the same `createClient(URL, SERVICE_ROLE_KEY)` instance the
// route would have built on its own. What it adds is:
//
//   1. Centralized env-var validation. If URL or key is missing, the call
//      throws immediately with a clear message instead of silently
//      constructing a half-broken client.
//
//   2. A structured `[security:service-role]` log line per call. Each line
//      carries the declared `reason` from a narrow union type, plus optional
//      caller context (`userId`, `role`, `context`). Ops can grep
//      Vercel logs by reason to validate that every service-role call site
//      is intentional and accounted for.
//
//   3. Compile-time intent enforcement. The `ServiceRoleReason` union forces
//      every caller to pick a known reason. Adding a new SR call site
//      requires either picking an existing reason or extending the union —
//      both visible in code review.
//
// The wrapper is the only place in the runtime bundle that should reference
// `process.env.SUPABASE_SERVICE_ROLE_KEY`. The repo also contains operator
// CLI scripts (delete-all-agents.js, migrate.js, run-migration*.js) that
// reference the key — those are deploy-excluded via .vercelignore and are
// not part of the runtime surface.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The narrow set of reasons for which a service-role client may be
 * created. Adding to this list is a deliberate act — it should be
 * paired with an audit trail entry in the relevant Sprint 8B report.
 */
export type ServiceRoleReason =
  // Signed external webhooks (no user JWT exists)
  | 'webhook-docusign-envelope'
  | 'webhook-onboarding-idempotency'
  // Token-gated public access (custom JWT, no Supabase auth user)
  | 'token-gated-deal-session'
  // Compliance writer paths — INSERT into RLS-only tables
  | 'compliance-upload-notification-fanout'
  // (compliance-review-broker-action retired — D-3 Track D: PF-DVL
  // confirmed document_verification_log has wide-open "Allow all for
  // service role" policy (USING true); Track C had already landed
  // broker UPDATE on documents; compliance/review now runs under
  // user JWT.)
  | 'compliance-scan-broker-action'
  // (compliance-transactions-broker-list retired — D-3 Track C: documents
  // table got documents_agent_own_transaction_select; full coverage now
  // verified for the compliance/transactions read path.)
  // CloseIQ broker / agent actions
  // (closeiq-broker-offer-approval retired — Phase 4B: full RLS coverage via
  // migration 025; closeiq main route now runs under user JWT.)
  // (closeiq-doc-insert + closeiq-template-management retired — D-3 Track B:
  // documents storage bucket policies backfilled; closeiq/bundle, contract,
  // and templates routes now run under user JWT.)
  // Broker cross-user surfaces
  // (broker-pipeline-view + leaderboard-broker-wins + transactions-broker-create
  // retired — Phase 4B: full RLS coverage verified in production for
  // transactions, commissions, manual_wins, profiles. Routes converted to
  // userClient(request).)
  | 'calendar-broker-mgmt'
  // System / cron paths
  | 'license-check-system-scan'
  | 'push-token-lookup'
  // Notification fan-out from agent-triggered routes
  | 'broker-fan-out'

/**
 * Optional caller context. Pass whichever fields are available at the
 * call site — none are required. Webhooks and the token-gated public
 * page won't have a userId; `context` can describe the route or trigger.
 */
export type ServiceRoleCaller = {
  /** Authenticated user id, if any. */
  userId?: string
  /** Caller role at the time of the call, if known. */
  role?: string
  /** Free-form context — route name, cron source, trigger event. */
  context?: string
}

/**
 * Build a service-role-backed Supabase client.
 *
 * Throws if the URL or key env vars are missing — the wrapper deliberately
 * refuses to construct a half-configured client. Logs a structured
 * `[security:service-role]` info line for ops visibility.
 *
 * Caller context fields are emitted only when present (no `undefined`
 * fields in the log). Secrets are never logged.
 */
export function adminClient(
  reason: ServiceRoleReason,
  caller?: ServiceRoleCaller
): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    // Fail loud — silently returning a non-service-role client would be a
    // privilege downgrade that masks an env misconfiguration.
    throw new Error(
      `[security:service-role] missing env vars — reason=${reason} ` +
        `hasUrl=${!!url} hasKey=${!!key}`
    )
  }

  const fields: Record<string, string> = { reason }
  if (caller?.userId) fields.userId = caller.userId
  if (caller?.role) fields.role = caller.role
  if (caller?.context) fields.context = caller.context

  console.info('[security:service-role] adminClient', fields)

  return createClient(url, key)
}
