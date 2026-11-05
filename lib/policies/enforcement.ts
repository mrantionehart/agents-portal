// ============================================================================
// A4 — policy-acknowledgment enforcement classification
// ============================================================================
// 🛑 ENFORCEMENT IS OFF. While it is off the acknowledgment prompt is shown and
// can be dismissed for the session, and NOTHING is blocked. This file only
// classifies actions; no action in the portal is wired to it yet. Turning
// enforcement on is a broker decision, and a client-side block can be
// bypassed — durable enforcement belongs in Vault, on the write routes.
//
// 🔑 RESTRICTION IS OPT-IN. Only new, agent-initiated activity can ever be
// restricted. Existing obligations (open deals, paperwork, clients, messages,
// commissions, training …) are always allowed, even when enforced and even
// when the acknowledgment check itself failed.
// ============================================================================

/** The single switch. Flip only on a broker decision. */
export const POLICY_ACK_ENFORCEMENT = false

export const ALWAYS_ALLOWED_ACTIONS = [
  'existing_transaction',
  'cma',
  'docusign',
  'clients',
  'communications',
  'commissions',
  'training',
  'inbound_leads',
] as const

export const RESTRICTED_WHEN_ENFORCED_ACTIONS = [
  'new_transaction',
  'new_listing',
  'outbound_marketing',
] as const

export type AlwaysAllowedAction = (typeof ALWAYS_ALLOWED_ACTIONS)[number]
export type RestrictedAction = (typeof RESTRICTED_WHEN_ENFORCED_ACTIONS)[number]
export type PolicyGatedAction = AlwaysAllowedAction | RestrictedAction

export type ActionClass = 'always_allowed' | 'restricted_when_enforced'

export function classifyPolicyAction(action: string): ActionClass {
  return (RESTRICTED_WHEN_ENFORCED_ACTIONS as readonly string[]).includes(action)
    ? 'restricted_when_enforced'
    : // Anything not explicitly restricted — including an unknown action — is
      // allowed: restriction must be named, never inferred.
      'always_allowed'
}

/**
 * Whether an action would be blocked. `owed` is true when acknowledgments are
 * outstanding OR the check could not be completed (fail closed).
 */
export function isPolicyActionBlocked(
  action: string,
  opts: { owed: boolean; enforcement?: boolean },
): boolean {
  const enforcement = opts.enforcement ?? POLICY_ACK_ENFORCEMENT
  if (!enforcement || !opts.owed) return false
  return classifyPolicyAction(action) === 'restricted_when_enforced'
}
