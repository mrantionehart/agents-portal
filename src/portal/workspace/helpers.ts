// ============================================================================
// AGENT PORTAL 2.0 — Workspace pure helpers
// ============================================================================
// Badge mapping + filter composition + label translations. Vocabulary
// MIRRORS Vault P1B (workspace UI on Vault) so agents see the same
// words across both surfaces. If the vocabulary changes there it
// changes here — never the other way around.
// ============================================================================

import type { StatusFilter, TypeFilter, WorkspaceCard } from "./types";

export interface UiBadge {
  label: string;
  tone: "ok" | "warn" | "info" | "muted";
}

/** Display badge per the readiness tier + next_action. */
export function badgeForCard(card: WorkspaceCard): UiBadge {
  if (card.readiness_tier === "ready_for_signature") {
    return { label: "Ready for Signature Prep", tone: "ok" };
  }
  if (card.readiness_tier === "ready_for_review") {
    return { label: "Ready for Broker Review", tone: "info" };
  }
  if (card.next_action === "request_party_attestation") {
    return { label: "Awaiting Party Disclosure", tone: "warn" };
  }
  if (card.next_action === "continue_collection") {
    return { label: "Needs More Info", tone: "warn" };
  }
  return { label: card.readiness_tier.replace(/_/g, " "), tone: "muted" };
}

/** Human-friendly type label. */
export function typeLabel(t: string | null): string {
  if (!t) return "—";
  if (t === "buyer_rep") return "Buyer Rep";
  if (t === "lease") return "Lease";
  if (t === "purchase") return "Purchase";
  if (t === "listing") return "Listing";
  if (t === "buyer") return "Buyer";
  if (t === "seller") return "Seller";
  return t;
}

/** Stage label — same vocabulary as Vault P1C. */
export function stageLabel(stage: string): string {
  switch (stage) {
    case "intake": return "Intake";
    case "drafting": return "Drafting";
    case "awaiting_statutory": return "Awaiting Party Disclosure";
    case "broker_review": return "Broker Review";
    case "in_signature": return "In Signature";
    case "ready_for_signature": return "Ready for Signature Prep";
    case "closing": return "Closing";
    case "complete": return "Complete";
    default: return stage.replace(/_/g, " ");
  }
}

/** Risk tier label (P1A placeholder; will be filled in by Vault P1E). */
export function riskLabel(risk: WorkspaceCard["risk_tier"]): string {
  switch (risk) {
    case "low": return "Low Risk";
    case "medium": return "Medium Risk";
    case "high": return "High Risk";
    case "critical": return "Critical";
    case "unknown":
    default:
      return "—";
  }
}

/** Client-side filter composition. AND across the two axes. */
export function applyFilters(
  cards: WorkspaceCard[],
  filters: { status: StatusFilter; type: TypeFilter }
): WorkspaceCard[] {
  return cards.filter((c) => {
    if (filters.type !== "all" && c.transaction_type !== filters.type) return false;
    if (filters.status === "ready_for_review") return c.readiness_tier === "ready_for_review";
    if (filters.status === "ready_for_signature") return c.readiness_tier === "ready_for_signature";
    if (filters.status === "needs_more_info") {
      return (
        c.next_action === "continue_collection" ||
        c.next_action === "request_party_attestation"
      );
    }
    return true;
  });
}

/** Map a Vault HTTP error code → user-facing copy. */
export function errorMessageFor(status: number, fallback?: string): string {
  if (status === 401) return "Please sign in to view your workspace.";
  if (status === 403) return "You don't have permission to view this workspace.";
  return fallback ?? `Couldn't load the workspace (HTTP ${status}).`;
}

/** Vault deep-link builders. NEVER mutates anything — just URL strings. */
export function vaultTransactionUrl(txnId: string, vaultBase: string): string {
  return `${vaultBase}/transactions/${txnId}`;
}

export function vaultPaperworkUrl(txnId: string, vaultBase: string): string {
  return `${vaultBase}/paperwork/transactions/${txnId}`;
}
