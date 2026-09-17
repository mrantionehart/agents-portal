// ============================================================================
// COMM-1C — Vault Ring learner API client (Agent Portal side)
// ============================================================================
// The Agent Portal has NO Ring engine of its own. Every call here reaches the
// EXISTING, already-agent-capable Vault learner APIs cross-origin, using the
// logged-in agent's Supabase Bearer token (via the Portal's `authFetch`). Vault
// derives tenant + learner from the token — so this client NEVER sends
// tenantId, learnerId, mode, authoritative, or outcome. Those are Vault's to
// decide; sending them would be a spoof surface. Do not add them.
//
// Auth bridge proven in production by /api/meetings ("consumed by both the
// Agent Portal and EASE. Agent-capable (gateCaller)."). The Ring learner APIs
// use the same default gateCaller path.
// ============================================================================

import { authFetch } from "@/lib/supabase";
import { VAULT_API_URL } from "@/lib/vault-client";

/** The Seller Lead Certification is built on the Acquisition scenario program.
 *  Omitting certificationId on a Vault route defaults to Acquisition, but we
 *  pass it explicitly so the intent is legible and stable. */
export const ACQUISITION_CERTIFICATION_ID = "hartfelt-holdings-acquisition-certified";

/** A Vault Ring API error. `notEnabled` is true when the route answered 404 with
 *  an empty body — the Vault feature flag is dark (text practice / assessment),
 *  which the UI renders as an honest "not available yet" state, NOT a crash. */
export class RingApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly notEnabled: boolean;
  constructor(status: number, code: string | null, notEnabled: boolean, message?: string) {
    super(message ?? code ?? `ring_api_${status}`);
    this.name = "RingApiError";
    this.status = status;
    this.code = code;
    this.notEnabled = notEnabled;
  }
}

async function parseBody(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function ringRequest(path: string, init?: RequestInit): Promise<any> {
  const res = await authFetch(`${VAULT_API_URL}${path}`, init);
  const body = await parseBody(res);
  if (res.ok) return body;
  const code: string | null = body && typeof body.error === "string" ? body.error : null;
  // A dark text/assessment route answers 404 with an EMPTY body. A genuine
  // "not found" answers 404 with { error: "not_found" } (or similar). Only the
  // empty-body 404 is treated as "feature not enabled".
  const notEnabled = res.status === 404 && body === null;
  throw new RingApiError(res.status, code, notEnabled, code ?? undefined);
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  };
}

// ── Types (mirror the Vault contracts) ──────────────────────────────────────

export type RingLevel = 1 | 2 | 3 | 4;

export interface TextPrepareResult {
  sessionId: string;
  scenarioLabel: string;
  attemptNumber: number;
  countsTowardProgression: boolean;
  reused: boolean;
  level: number | null;
}
export interface TextBeginResult {
  sessionId: string;
  openingMessage: string;
  resumed: boolean;
}
export interface TextTurnResult {
  counterpartyMessage: string;
  ended: boolean;
  counterpartyDisengaging: boolean;
}
export type TextRole = "counterparty" | "learner";
export interface TextStateResult {
  sessionId: string;
  status: string;
  sealed: boolean;
  scenarioLabel: string;
  level: number | null;
  ended: boolean;
  messages: Array<{ role: TextRole; content: string }>;
}
export interface Coaching {
  strengths: string[];
  improvements: string[];
  missedOpportunities: string[];
  coaching: string[];
}
export type CompletionResult =
  | { status: "ready"; sessionId: string; turnCount?: number; coaching: Coaching }
  | { status: "analyzing"; sessionId: string; turnCount?: number; pollAfterMs: number }
  | { status: "failed"; sessionId: string; retryable: boolean };
export type ResultPoll =
  | { status: "ready"; sessionId: string; coaching: Coaching }
  | { status: "analyzing"; sessionId: string; pollAfterMs: number }
  | { status: "failed"; sessionId: string; retryable: boolean };

export interface PracticeRow {
  sessionId: string;
  channel: "text" | "voice";
  displayAttempt: number;
  startedAt: string;
  scenarioLabel: string;
  level: RingLevel | null;
  turnCount: number;
  durationSeconds: number | null;
  status: string;
  score: number | null;
  coverage: number;
  reportable: boolean;
}
export interface PracticeHistory {
  rows: PracticeRow[];
  completed: number;
  trend: "improving" | "steady" | "needs_focus" | null;
}

export type RequirementStatus = "not_started" | "passed";
export interface CertRequirement {
  requirementId: string;
  label: string;
  status: RequirementStatus;
  evidenceScenarioId?: string;
}
export interface CertProgress {
  certificationId: string;
  certificationVersion: string;
  status: "not_started" | "in_progress" | "requirements_met";
  completed: number;
  total: number;
  requirements: CertRequirement[];
  missing: string[];
}
export interface StartAssessmentResult {
  ok: true;
  sessionId: string;
  requirementId: string;
  scenarioLabel: string;
  attemptNumber: number;
  level: RingLevel | null;
}

// ── Text practice ───────────────────────────────────────────────────────────

export function prepareText(
  certificationId: string,
  level: RingLevel | null,
): Promise<TextPrepareResult> {
  return ringRequest("/simulation/text/prepare", jsonInit("POST", { level, certificationId }));
}

export function beginText(certificationId: string, sessionId: string): Promise<TextBeginResult> {
  return ringRequest("/simulation/text/begin", jsonInit("POST", { sessionId, certificationId }));
}

export function sendTurn(
  certificationId: string,
  sessionId: string,
  message: string,
): Promise<TextTurnResult> {
  return ringRequest(
    "/simulation/text/turn",
    jsonInit("POST", { sessionId, message, certificationId }),
  );
}

export function getTextState(
  certificationId: string,
  sessionId: string,
): Promise<TextStateResult> {
  const q = new URLSearchParams({ sessionId, certificationId });
  return ringRequest(`/simulation/text/state?${q.toString()}`, { method: "GET" });
}

export function completeText(
  certificationId: string,
  sessionId: string,
  retry = false,
): Promise<CompletionResult> {
  return ringRequest(
    "/simulation/text/complete",
    jsonInit("POST", { sessionId, retry, certificationId }),
  );
}

export function getTextResult(
  certificationId: string,
  sessionId: string,
): Promise<ResultPoll> {
  const q = new URLSearchParams({ sessionId, certificationId });
  return ringRequest(`/simulation/text/result?${q.toString()}`, { method: "GET" });
}

// ── Practice history ─────────────────────────────────────────────────────────

export function getPracticeHistory(certificationId: string): Promise<PracticeHistory> {
  const q = new URLSearchParams({ certificationId });
  return ringRequest(`/simulation/practice/history?${q.toString()}`, { method: "GET" });
}

// ── Seller Lead Certification ─────────────────────────────────────────────────

export function getCertificationProgress(): Promise<CertProgress> {
  return ringRequest("/ring/seller-certification/progress", { method: "GET" });
}

/** Start (or continue) a certification assessment. `requirementId` omitted =
 *  next unmet requirement. DARK behind the Vault RING_SELLER_CERT_ASSESSMENT_ENABLED
 *  flag: throws RingApiError with notEnabled=true (404 empty body) when off. */
export function startAssessment(requirementId?: string): Promise<StartAssessmentResult> {
  return ringRequest(
    "/ring/seller-certification/start-assessment",
    jsonInit("POST", requirementId ? { requirementId } : {}),
  );
}
