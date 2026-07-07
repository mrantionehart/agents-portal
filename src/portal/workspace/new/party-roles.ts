// ============================================================================
// TRANSACTION OS 3.3B.3B — Party role vocabulary (UI slice)
// ============================================================================
// The 14 EXISTING transaction_parties roles — mirrors the Vault
// transaction_parties.role CHECK constraint honored by the agent party
// endpoint (Transaction OS 3.3B.2). NO new roles: attorney / inspector / title /
// buyer_agent / seller_agent are NOT in the schema and are out of scope
// (future migration). The wizard's party editor offers only these.
// ============================================================================

export type PartyRole =
  | "buyer"
  | "co_buyer"
  | "seller"
  | "co_seller"
  | "tenant"
  | "co_tenant"
  | "landlord"
  | "co_landlord"
  | "agent"
  | "co_broker"
  | "broker"
  | "escrow"
  | "lender"
  | "guarantor";

export interface PartyRoleOption {
  id: PartyRole;
  label: string;
}

/** Ordered for the role dropdown — the common parties first. */
export const PARTY_ROLE_OPTIONS: ReadonlyArray<PartyRoleOption> = [
  { id: "buyer", label: "Buyer" },
  { id: "co_buyer", label: "Co-Buyer" },
  { id: "seller", label: "Seller" },
  { id: "co_seller", label: "Co-Seller" },
  { id: "tenant", label: "Tenant" },
  { id: "co_tenant", label: "Co-Tenant" },
  { id: "landlord", label: "Landlord" },
  { id: "co_landlord", label: "Co-Landlord" },
  { id: "agent", label: "Agent" },
  { id: "co_broker", label: "Co-Broker" },
  { id: "broker", label: "Broker" },
  { id: "escrow", label: "Escrow" },
  { id: "lender", label: "Lender" },
  { id: "guarantor", label: "Guarantor" },
] as const;

const ROLE_ID_SET: Set<string> = new Set(PARTY_ROLE_OPTIONS.map((r) => r.id));

export function isPartyRole(raw: string | null | undefined): raw is PartyRole {
  return !!raw && ROLE_ID_SET.has(raw);
}

export function partyRoleLabel(raw: string | null | undefined): string {
  return PARTY_ROLE_OPTIONS.find((r) => r.id === raw)?.label ?? "";
}
