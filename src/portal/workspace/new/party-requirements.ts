// ============================================================================
// TRANSACTION OS 3.3B.3C — Required parties by transaction type
// ============================================================================
// The canonical "who must be on this transaction" table, keyed by the 7
// canonical transaction types (transaction-types.ts). Pure data + a pure
// predicate. No API, no Vault — this only drives the wizard's client-side
// party validation.
// ============================================================================

import type { CanonicalTransactionType } from "./transaction-types";
import type { PartyRole } from "./party-roles";
import { partyRoleLabel } from "./party-roles";

/** A single required-party rule: a role that must be present, with the label
 *  used in error messages. */
export interface RequiredPartyRule {
  role: PartyRole;
  label: string;
}

/**
 * Required roles per transaction type. Types not listed here (commercial /
 * wholesale / referral) have no specific required role — they only require at
 * least one party (see `requiresAtLeastOneParty`).
 */
export const REQUIRED_PARTIES_BY_TYPE: Record<
  CanonicalTransactionType,
  ReadonlyArray<RequiredPartyRule>
> = {
  purchase: [{ role: "buyer", label: "Buyer" }],
  buyer_rep: [{ role: "buyer", label: "Buyer" }],
  listing: [{ role: "seller", label: "Seller" }],
  lease: [
    { role: "landlord", label: "Landlord" },
    { role: "tenant", label: "Tenant" },
  ],
  commercial: [],
  wholesale: [],
  referral: [],
};

/** Types with no specific required role still require ≥1 party of any kind. */
const AT_LEAST_ONE_PARTY_TYPES: ReadonlySet<CanonicalTransactionType> = new Set([
  "commercial",
  "wholesale",
  "referral",
]);

export function requiredPartyRules(
  type: string | null | undefined
): ReadonlyArray<RequiredPartyRule> {
  if (!type || !(type in REQUIRED_PARTIES_BY_TYPE)) return [];
  return REQUIRED_PARTIES_BY_TYPE[type as CanonicalTransactionType];
}

export function requiresAtLeastOneParty(
  type: string | null | undefined
): boolean {
  return !!type && AT_LEAST_ONE_PARTY_TYPES.has(type as CanonicalTransactionType);
}

/** Convenience for messages, e.g. "Add a Buyer" / "Add a Landlord and Tenant". */
export function requiredRoleLabels(
  type: string | null | undefined
): string[] {
  return requiredPartyRules(type).map((r) => r.label || partyRoleLabel(r.role));
}
