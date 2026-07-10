// ============================================================================
// TRANSACTION ASSISTANT 4.0D — client-side envelope types
// ============================================================================
// Mirror of the Vault 4.0C grounded response envelope (the Agent Portal is a
// separate repo, so the shape is declared here — NOT imported). Presentation
// only; the UI never constructs these, it only renders what Vault returns.
// ============================================================================

export type AssistantConfidence = "high" | "medium" | "low";

export type AssistantMode =
  | "auto"
  | "explain"
  | "guide"
  | "summarize"
  | "draft"
  | "answer";

/** Workspace tabs a suggested action may deep-link to. */
export type AssistantTab =
  | "overview"
  | "package"
  | "documents"
  | "compliance"
  | "commission"
  | "timeline";

export interface AssistantEvidence {
  source: string;
  fact: string;
}

export interface AssistantSuggestedAction {
  label: string;
  tab?: AssistantTab;
}

export interface AssistantDraft {
  channel: "note" | "email";
  audience: "buyer" | "seller" | "broker" | "internal";
  subject?: string;
  body: string;
}

/** The full grounded envelope returned by
 *  POST /api/platform/transactions/[id]/assistant. */
export interface AssistantEnvelope {
  request_id: string;
  context_version: string;
  directive_version: string;
  assistant_version: string;
  answer: string;
  sources: string[];
  evidence: AssistantEvidence[];
  confidence: AssistantConfidence;
  suggested_actions: AssistantSuggestedAction[];
  draft: AssistantDraft | null;
  warnings: string[];
}

/** A user-facing, leak-safe error (never a stack trace or raw provider text). */
export interface AssistantError {
  /** Stable code for tests/telemetry — NOT shown verbatim to the user. */
  code: string;
  /** Friendly, natural-language message shown in a chat bubble. */
  message: string;
}

// The cross `?: undefined` members keep BOTH properties present on the union so
// this narrows even under the repo's `strict: false` (no strictNullChecks),
// where a boolean-literal discriminant alone would not narrow.
export type AssistantResult =
  | { ok: true; envelope: AssistantEnvelope; error?: undefined }
  | { ok: false; error: AssistantError; envelope?: undefined };

/** One conversation turn held in memory only (no persistence). */
export type AssistantMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; kind: "answer"; envelope: AssistantEnvelope }
  | { role: "assistant"; kind: "error"; error: AssistantError }
  | { role: "assistant"; kind: "intro"; content: string };
