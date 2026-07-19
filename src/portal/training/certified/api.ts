// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Vault client
// ============================================================================
// Thin fetch client for Vault's platform-certification endpoints. Every call
// attaches the caller's Supabase Bearer token; Vault gates identity + tenant
// + role. The AP never trusts caller-supplied identifiers.
//
// This module is client-safe (no `server-only` import) — the UI components
// mount it directly and let the server enforce every authorization decision.
// ============================================================================

import { getAccessToken } from "@/lib/supabase";

import type {
  CertifiedCatalog,
  CertifiedProgress,
  LessonStatus,
  QuizAttemptResponse,
  QuizAttemptSubmission,
  QuizGetResponse,
} from "./types";
import { HARTFELT_PLATFORM_CERTIFIED_ID } from "./types";

const VAULT_BASE_URL =
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api";

/**
 * Typed error class for every Vault call. `code` is the machine-readable
 * envelope from the server; `status` is the HTTP status. UI components
 * branch on `code` for expected states (e.g. `prerequisite_not_completed`).
 */
export class CertApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly detail: unknown;
  constructor(message: string, status: number, code: string | null, detail: unknown) {
    super(message);
    this.name = "CertApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new CertApiError("No active session", 401, "no_session", null);
  }
  return fetch(`${VAULT_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.method && init.method !== "GET"
        ? { "Content-Type": "application/json" }
        : {}),
    },
    cache: "no-store",
  });
}

async function readErrorEnvelope(res: Response, prefix: string): Promise<never> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  const code =
    typeof body === "object" && body !== null && "code" in (body as object)
      ? String((body as { code: unknown }).code)
      : null;
  const message =
    typeof body === "object" && body !== null && "error" in (body as object)
      ? String((body as { error: unknown }).error)
      : `${prefix} (HTTP ${res.status})`;
  throw new CertApiError(message, res.status, code, body);
}

// ─── Catalog + progress ────────────────────────────────────────────────────

/** GET /api/platform/certifications/{cert}/catalog */
export async function fetchCatalog(
  certificationId: string = HARTFELT_PLATFORM_CERTIFIED_ID,
): Promise<CertifiedCatalog> {
  const res = await authedFetch(
    `/platform/certifications/${encodeURIComponent(certificationId)}/catalog`,
  );
  if (!res.ok) await readErrorEnvelope(res, "fetchCatalog");
  return (await res.json()) as CertifiedCatalog;
}

/** GET /api/platform/certifications/{cert}/progress */
export async function fetchProgress(
  certificationId: string = HARTFELT_PLATFORM_CERTIFIED_ID,
): Promise<CertifiedProgress> {
  const res = await authedFetch(
    `/platform/certifications/${encodeURIComponent(certificationId)}/progress`,
  );
  if (!res.ok) await readErrorEnvelope(res, "fetchProgress");
  return (await res.json()) as CertifiedProgress;
}

// ─── Lesson complete (empty body → server evaluates practical) ─────────────

/**
 * POST /api/platform/certifications/{cert}/lessons/{id}/complete
 * with an empty body. Server evaluates the lesson's declared criterion
 * (e.g. Family A signal check) and either advances the lesson or returns
 * an unmet-requirement envelope.
 *
 * Do NOT use this for tour completion — the tour engine calls
 * `submitTourCompletion` in `src/portal/tour/api.ts` with the
 * `tour_completion: true` sentinel.
 */
export async function requestPracticalCompletion(opts: {
  certificationId?: string;
  lessonId: string;
}): Promise<{ ok: true; lesson_id: string; status: LessonStatus }> {
  const cert = opts.certificationId ?? HARTFELT_PLATFORM_CERTIFIED_ID;
  const res = await authedFetch(
    `/platform/certifications/${encodeURIComponent(cert)}/lessons/${encodeURIComponent(opts.lessonId)}/complete`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (!res.ok) await readErrorEnvelope(res, "requestPracticalCompletion");
  return (await res.json()) as {
    ok: true;
    lesson_id: string;
    status: LessonStatus;
  };
}

// ─── Quiz get + attempt ────────────────────────────────────────────────────

/** GET /api/platform/certifications/{cert}/lessons/{id}/quiz */
export async function fetchLearnerSafeQuiz(opts: {
  certificationId?: string;
  lessonId: string;
}): Promise<QuizGetResponse> {
  const cert = opts.certificationId ?? HARTFELT_PLATFORM_CERTIFIED_ID;
  const res = await authedFetch(
    `/platform/certifications/${encodeURIComponent(cert)}/lessons/${encodeURIComponent(opts.lessonId)}/quiz`,
  );
  if (!res.ok) await readErrorEnvelope(res, "fetchLearnerSafeQuiz");
  return (await res.json()) as QuizGetResponse;
}

/** POST /api/platform/certifications/{cert}/lessons/{id}/quiz/attempt */
export async function submitQuizAttempt(opts: {
  certificationId?: string;
  lessonId: string;
  submission: QuizAttemptSubmission;
}): Promise<QuizAttemptResponse> {
  const cert = opts.certificationId ?? HARTFELT_PLATFORM_CERTIFIED_ID;
  const res = await authedFetch(
    `/platform/certifications/${encodeURIComponent(cert)}/lessons/${encodeURIComponent(opts.lessonId)}/quiz/attempt`,
    { method: "POST", body: JSON.stringify(opts.submission) },
  );
  if (!res.ok) await readErrorEnvelope(res, "submitQuizAttempt");
  return (await res.json()) as QuizAttemptResponse;
}
