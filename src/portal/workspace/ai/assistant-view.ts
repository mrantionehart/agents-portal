// ============================================================================
// TRANSACTION ASSISTANT 4.0D — pure view helpers
// ============================================================================
// No React, no I/O. Maps the envelope + transport failures into leak-safe,
// natural-language presentation. Speaks like a transaction manager — never
// exposes "Coordinator", "CollectionReport", HTTP codes, or provider errors.
// ============================================================================

import type { AssistantConfidence, AssistantError, AssistantTab } from "./assistant-types";

/** The five suggested-prompt chips shown beneath the Coordinator. Verbatim
 *  natural-language prompts — no internal terminology. */
export const ASSISTANT_PROMPT_CHIPS: ReadonlyArray<{ id: string; label: string; prompt: string }> = [
  { id: "next", label: "What should I do next?", prompt: "What should I do next?" },
  { id: "send", label: "Why can't I send this package?", prompt: "Why can't I send this package?" },
  { id: "waiting", label: "Who are we waiting on?", prompt: "Who are we waiting on?" },
  { id: "explain", label: "Explain this issue", prompt: "Explain the current issue like I'm new to this." },
  { id: "summary", label: "Summarize this transaction", prompt: "Summarize this transaction." },
] as const;

/** Valid workspace tabs a suggested action may navigate to. */
const VALID_TABS: ReadonlySet<string> = new Set<AssistantTab>([
  "overview",
  "package",
  "documents",
  "compliance",
  "commission",
  "timeline",
]);

export function isNavigableTab(tab: string | undefined | null): tab is AssistantTab {
  return typeof tab === "string" && VALID_TABS.has(tab);
}

/** Build a navigation-only href for a suggested action. */
export function tabHref(transactionId: string, tab: AssistantTab): string {
  return `/workspace/${transactionId}?tab=${tab}`;
}

/** Capitalized confidence label — High / Medium / Low. NEVER a percentage. */
export function confidenceLabel(level: AssistantConfidence): "High" | "Medium" | "Low" {
  return level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
}

export type Tone = "ok" | "info" | "warn" | "muted";

export function confidenceTone(level: AssistantConfidence): Tone {
  return level === "high" ? "ok" : level === "medium" ? "info" : "warn";
}

/** Friendly, agent-facing labels for evidence sources. The Assistant speaks
 *  like a transaction manager — it never surfaces internal engine names
 *  ("Coordinator", "CollectionReport", etc.). Unknown labels pass through. */
const SOURCE_LABELS: Record<string, string> = {
  Coordinator: "Deal status",
  Transaction: "Transaction details",
  "Package Review": "Package",
  "Missing Fields": "Required fields",
  Deadlines: "Deadlines",
  Commission: "Commission",
  "Broker Review": "Broker review",
  Parties: "Parties",
  Coach: "Guidance",
  Timeline: "Activity",
};

export function friendlySource(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/**
 * Map a transport/status failure into a friendly, leak-safe error. `status===0`
 * denotes a client-side condition (timeout / network / no-transaction). `code`
 * is the server's structured error code when available.
 */
export function mapAssistantError(status: number, code?: string | null): AssistantError {
  // Client-side conditions (no HTTP status).
  if (code === "no_transaction") {
    return { code, message: "Open a transaction first, then I can help with it." };
  }
  if (code === "timeout") {
    return { code, message: "That took too long to come back. Please try again." };
  }
  if (code === "network") {
    return { code, message: "I couldn't reach the assistant. Check your connection and try again." };
  }

  switch (status) {
    case 401:
      return { code: code ?? "unauthorized", message: "Your session expired. Please sign in again to continue." };
    case 403:
      return { code: code ?? "forbidden", message: "You don't have access to this transaction." };
    case 404:
      // Covers not-found, cross-tenant, non-owner, AND soft-deleted — all 404.
      return { code: code ?? "not_found", message: "This transaction isn't available. It may have been removed." };
    case 429:
      return { code: code ?? "rate_limited", message: "I'm handling a lot right now — give it a moment and try again." };
    case 503:
      return { code: code ?? "unavailable", message: "The assistant is temporarily unavailable. Please try again shortly." };
    case 504:
      return { code: code ?? "timeout", message: "That took too long to come back. Please try again." };
    case 400:
      return { code: code ?? "bad_request", message: "I couldn't understand that request. Try rephrasing it." };
    default:
      return { code: code ?? "error", message: "Something went wrong. Please try again." };
  }
}

/** True when the answer is low-confidence OR carries warnings — the UI surfaces
 *  these prominently so the user knows the answer may be incomplete. */
export function shouldFlagUncertainty(level: AssistantConfidence, warnings: string[]): boolean {
  return level === "low" || (Array.isArray(warnings) && warnings.length > 0);
}
