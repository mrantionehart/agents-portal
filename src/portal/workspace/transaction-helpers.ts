// ============================================================================
// AGENT PORTAL 2.0 — Per-transaction workspace helpers
// ============================================================================
// Pure derivations for the /workspace/[transactionId] page. Vocabulary
// mirrors Vault P1C so an agent sees the same labels whether they open
// the per-txn screen on Vault or in the Portal.
// ============================================================================

import type { WorkspaceCard } from "./types";

export type StageLabel =
  | "Intake"
  | "Drafting"
  | "Awaiting Party Disclosure"
  | "Broker Review"
  | "In Signature"
  | "Ready for Signature Prep"
  | "Closing"
  | "Complete"
  | string;

/** Stage label — same wording as the cards on the index. */
export function stageLabel(stage: string): StageLabel {
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

/** Compact next-action label. */
export function nextActionLabel(action: string): string {
  switch (action) {
    case "request_party_attestation": return "Send a portal invite";
    case "collect_field": return "Answer the next question";
    case "prepare_package": return "Prepare for broker review";
    case "ready_for_signature": return "Ready for signature preparation";
    default: return action.replace(/_/g, " ");
  }
}

/** Plain-language status explanation for the header strip. */
export function statusExplanation(card: WorkspaceCard): string {
  if (card.readiness_tier === "ready_for_signature") {
    return "All required fields are answered and statutory disclosures are complete. Broker confirmation is required before any envelope is sent.";
  }
  if (card.readiness_tier === "ready_for_review") {
    return "The package is ready for broker review. Broker confirmation is required before anything moves forward.";
  }
  if (card.next_action === "request_party_attestation") {
    return "A statutory disclosure is outstanding. Only the party can answer; ask the AI to send the portal invite when ready.";
  }
  if (card.next_action === "continue_collection") {
    return "Some required fields are still missing. Work through the next question to keep readiness moving.";
  }
  return "Continue working through the next action below.";
}

/** Friendly readiness sentence — e.g. "You're 87% complete. …" */
export function readinessLanguage(card: WorkspaceCard): string {
  if (card.readiness_score >= 100) {
    return "Readiness: 100%. Package is ready for signature preparation.";
  }
  if (card.readiness_score >= 86) {
    return `Readiness: ${card.readiness_score}%. Package is ready for broker review.`;
  }
  return `You're ${card.readiness_score}% complete.`;
}

/** Vault deep-link builders. Single source of truth for the link
 *  patterns used by the Quick Links section. */
export function vaultTransactionUrl(txnId: string, vaultBase: string): string {
  return `${vaultBase}/transactions/${txnId}`;
}
export function vaultPaperworkUrl(txnId: string, vaultBase: string): string {
  return `${vaultBase}/paperwork/transactions/${txnId}`;
}

/** Type label for the header strip. */
export function transactionTypeLabel(t: string | null): string {
  if (!t) return "—";
  if (t === "buyer_rep") return "Buyer Rep";
  if (t === "lease") return "Lease";
  if (t === "purchase") return "Purchase";
  if (t === "listing") return "Listing";
  if (t === "buyer") return "Buyer";
  if (t === "seller") return "Seller";
  return t;
}

/** Risk-tier label (Vault P1A still emits "unknown" until P1E ships). */
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

/** Find a card by transaction id. Returns undefined when missing. */
export function findCardById(
  cards: WorkspaceCard[],
  txnId: string
): WorkspaceCard | undefined {
  return cards.find((c) => c.transaction_id === txnId);
}
