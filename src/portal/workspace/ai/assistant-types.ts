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

export type DraftAudience = "buyer" | "seller" | "broker" | "internal";
export type DraftChannel = "note" | "email";

/** The 10 registered draft types (mirror of the Vault registry). */
export type DraftType =
  | "buyer_follow_up"
  | "seller_follow_up"
  | "broker_update"
  | "internal_note"
  | "deadline_reminder"
  | "missing_document_reminder"
  | "signature_reminder"
  | "statutory_disclosure_reminder"
  | "closing_prep_checklist"
  | "transaction_summary_for_agent";

/** 4.0E rich draft (mirror of the Vault envelope). facts_used reuses the
 *  evidence shape; confidence/warnings are server-derived. */
export interface AssistantDraft {
  title: string;
  audience: DraftAudience;
  channel: DraftChannel;
  subject?: string;
  body: string;
  facts_used: AssistantEvidence[];
  confidence: AssistantConfidence;
  warnings: string[];
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

/** One conversation turn held in memory only (no persistence). `expectedAudience`
 *  (when a draft was requested) drives the presentation-only audience fallback. */
export type AssistantMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; kind: "answer"; envelope: AssistantEnvelope; expectedAudience?: DraftAudience }
  | { role: "assistant"; kind: "error"; error: AssistantError }
  | { role: "assistant"; kind: "intro"; content: string };
