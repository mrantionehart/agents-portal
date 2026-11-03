// ============================================================================
// Matrix MLS Simulator — Vault API client (Agent Portal side)
// ============================================================================
// Like the Ring client, the Portal holds NO simulator engine. Every call
// reaches the EXISTING agent-capable Vault matrix-sim routes cross-origin with
// the agent's Supabase Bearer token (via authFetch). Vault derives tenant +
// learner from the token, so this client NEVER sends tenantId, learnerId, or a
// score/passed/approval flag — those are Vault's to decide. Do not add them.
// ============================================================================

import { authFetch } from "@/lib/supabase";
import { VAULT_API_URL } from "@/lib/vault-client";

export class MatrixApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly notEnabled: boolean;
  readonly fieldErrors?: Record<string, string>;
  constructor(status: number, code: string | null, notEnabled: boolean, fieldErrors?: Record<string, string>) {
    super(code ?? `matrix_api_${status}`);
    this.name = "MatrixApiError";
    this.status = status;
    this.code = code;
    this.notEnabled = notEnabled;
    this.fieldErrors = fieldErrors;
  }
}

async function parseBody(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function matrixRequest(path: string, init?: RequestInit): Promise<any> {
  const res = await authFetch(`${VAULT_API_URL}${path}`, init);
  const body = await parseBody(res);
  if (res.ok) return body;
  const code: string | null = body && typeof body.error === "string" ? body.error : null;
  const notEnabled = res.status === 404 && body === null;
  const fieldErrors = body && typeof body.fieldErrors === "object" ? body.fieldErrors : undefined;
  throw new MatrixApiError(res.status, code, notEnabled, fieldErrors);
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) };
}

// ── Types (mirror the Vault service's learner-safe projections) ─────────────

export type MatrixFieldValue = string | number;

export interface LearnerSafeField {
  id: string;
  label: string;
  type: "text" | "number" | "enum" | "date" | "boolean" | "textarea";
  required: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  autoPopulated?: boolean;
  help?: string;
}
export interface PreparedExercise {
  attemptId: string;
  scenarioId: string;
  scenarioLabel: string;
  briefing: string;
  fields: LearnerSafeField[];
  values: Record<string, MatrixFieldValue | "">;
  hints: Array<{ fieldId: string; hint: string }>;
}
export interface CoachingItem { fieldId: string; label: string; critical: boolean; }
export interface SubmitResult {
  submissionId: string;
  scorePct: number;
  passed: boolean;
  criticalErrorCount: number;
  coaching: CoachingItem[];
  reviewStatus: "submitted";
}
export interface ReviewQueueItem {
  submissionId: string;
  learnerId: string;
  scenarioId: string;
  scorePct: number;
  criticalErrorCount: number;
  passed: boolean;
  reviewStatus: string;
  submittedAt: string | null;
}
export interface CertifyOutcome {
  certified: boolean;
  issued: boolean;
  reviewStatus: "approved" | "rejected";
}
export interface LatestResult {
  submissionId: string;
  scorePct: number;
  passed: boolean;
  reviewStatus: string;
}

// ── Learner ───────────────────────────────────────────────────────────────

export function prepareExercise(): Promise<PreparedExercise> {
  return matrixRequest("/matrix-sim/prepare", jsonInit("POST"));
}
export function saveDraft(attemptId: string, values: Record<string, MatrixFieldValue | "">): Promise<{ ok: true }> {
  return matrixRequest(
    `/matrix-sim/attempts/${encodeURIComponent(attemptId)}/draft`,
    jsonInit("PUT", { values }),
  );
}
export function submitAttempt(attemptId: string): Promise<SubmitResult> {
  return matrixRequest(`/matrix-sim/attempts/${encodeURIComponent(attemptId)}/submit`, jsonInit("POST"));
}
export function getLatestResult(): Promise<{ result: LatestResult | null }> {
  return matrixRequest("/matrix-sim/result", { method: "GET" });
}

// ── Broker ──────────────────────────────────────────────────────────────────

export function getReviewQueue(): Promise<{ queue: ReviewQueueItem[] }> {
  return matrixRequest("/matrix-sim/review", { method: "GET" });
}
export function certifySubmission(
  submissionId: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<CertifyOutcome> {
  return matrixRequest(
    `/matrix-sim/submissions/${encodeURIComponent(submissionId)}/certify`,
    jsonInit("POST", { decision, ...(note ? { note } : {}) }),
  );
}
