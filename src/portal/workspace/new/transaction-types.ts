// ============================================================================
// TRANSACTION OS 3.3B.3B — Portal transaction-type vocabulary (UI slice)
// ============================================================================
// The 7 CANONICAL transaction types, mirroring the Vault shared normalizer
// (Transaction OS 3.3B.1 `resolveTransactionType` canonical set). The Vault
// module cannot be imported cross-repo, so this is the portal-side mirror used
// by the wizard UI. `WizardSession.transaction_type` stores one of these ids.
//
// This is intentionally the UI slice only — labels + display metadata + the
// lease predicate. The full portal normalizer (portal_create / vault_paperwork
// views + create-route alignment for the real FAR-BAR Purchase path) lands with
// the submission orchestrator in 3.3B.3D. The legacy lib/portal-transaction-type
// mapper is NOT used here.
// ============================================================================

import {
  Home,
  Key,
  Building2,
  Building,
  Handshake,
  Layers,
  Share2,
  type LucideIcon,
} from "lucide-react";

export type CanonicalTransactionType =
  | "purchase"
  | "lease"
  | "listing"
  | "buyer_rep"
  | "commercial"
  | "wholesale"
  | "referral";

export interface TransactionTypeOption {
  id: CanonicalTransactionType;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** Fixed display order for the type picker. */
export const TRANSACTION_TYPE_OPTIONS: ReadonlyArray<TransactionTypeOption> = [
  { id: "purchase", label: "Purchase", description: "Represent a buyer under contract to purchase", icon: Key },
  { id: "lease", label: "Lease", description: "Residential lease / rental", icon: Building2 },
  { id: "listing", label: "Listing", description: "Represent a seller listing a property", icon: Home },
  { id: "buyer_rep", label: "Buyer Rep", description: "Buyer representation agreement", icon: Handshake },
  { id: "commercial", label: "Commercial", description: "Commercial transaction", icon: Building },
  { id: "wholesale", label: "Wholesale", description: "Assignment / wholesale deal", icon: Layers },
  { id: "referral", label: "Referral", description: "Referral to another agent or brokerage", icon: Share2 },
] as const;

const TYPE_ID_SET: Set<string> = new Set(
  TRANSACTION_TYPE_OPTIONS.map((t) => t.id)
);

export function isCanonicalTransactionType(
  raw: string | null | undefined
): raw is CanonicalTransactionType {
  return !!raw && TYPE_ID_SET.has(raw);
}

/** Human label for a stored transaction_type id (empty if unset/unknown). */
export function transactionTypeLabel(raw: string | null | undefined): string {
  return TRANSACTION_TYPE_OPTIONS.find((t) => t.id === raw)?.label ?? "";
}

/** Lease is the only type that uses lease start/end dates instead of
 *  contract/closing dates. */
export function isLeaseType(raw: string | null | undefined): boolean {
  return raw === "lease";
}
