// ============================================================================
// V4 TRAINING MODE — Vault /api/activity-sessions/* HTTP client
// ============================================================================
// Typed wrapper over the four Vault endpoints shipped in PR #12:
//
//   POST   /api/activity-sessions/start
//   GET    /api/activity-sessions/[id]
//   PATCH  /api/activity-sessions/[id]
//   POST   /api/activity-sessions/[id]/complete
//
// Every call attaches a Supabase Bearer token (via `getAccessToken()` from
// the shared AP supabase helper) and reads the base URL from
// `NEXT_PUBLIC_VAULT_API_URL`. This mirrors the tour-api pattern
// (`src/portal/tour/api.ts`) — deliberately NOT going through `authFetch`
// because we want a typed error class + explicit response validators.
//
// A caller sees exactly two channels:
//   * Success → typed row projection.
//   * `SessionApiError` → `code` classifies the failure so the UI can
//     render a specific recovery path (see failure-states doc in §17).
// ============================================================================

import { getAccessToken } from "../../../../lib/supabase";

import type { StoreErrorCode } from "./session-store";

const VAULT_API_URL =
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api";

// ─── Types mirroring Vault's response shapes ───────────────────────────────

export interface ActivitySessionProvenance {
  user_id: string;
  tenant_id: string;
  certification_id: string;
  certification_version: string;
  lesson_id: string;
  evaluator_key: string;
  criterion_version: string;
  activity_type: string;
}

export interface ActivitySessionTimestamps {
  started_at: string;
  expires_at: string;
  completed_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The projection GET /api/activity-sessions/[id] returns. Matches
 * `projectSession` in the Vault route source.
 */
export interface ActivitySession {
  id: string;
  provenance: ActivitySessionProvenance;
  status: "active" | "completed" | "expired" | "revoked" | "abandoned";
  state: Record<string, unknown>;
  completed_steps: string[];
  timestamps: ActivitySessionTimestamps;
  revocation_reason: string | null;
}

/** Response shape from POST /start. */
export interface StartedSession {
  id: string;
  activity_type: string;
  status: string;
  started_at: string;
  expires_at: string;
  state: Record<string, unknown>;
  completed_steps: string[];
}

/** Response shape from POST /complete. */
export interface CompletedSession {
  id: string;
  status: string;
  completed_at: string;
}

// ─── Error class ──────────────────────────────────────────────────────────

export class SessionApiError extends Error {
  readonly code: StoreErrorCode;
  readonly httpStatus: number | null;
  readonly apiCode: string | null;

  constructor(
    code: StoreErrorCode,
    message: string,
    httpStatus: number | null,
    apiCode: string | null,
  ) {
    super(message);
    this.name = "SessionApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.apiCode = apiCode;
  }
}

/**
 * Map a Vault response envelope + HTTP status to a StoreErrorCode.
 *
 * PILOT-D-008 (2026-07-19): the pre-fix mapping collapsed EVERY 409
 * (including the validator's per-reason codes like `session_missing_step`
 * and `session_invalid_state`) into a bare `session_not_active`, which
 * then rendered to the learner as "This training session is no longer
 * active." — the literal opposite of what the server said in the
 * `session_missing_step` case, where the session is still active but the
 * learner's completion payload was incomplete. This mapping now:
 *
 *   1. Preserves each explicitly-documented Vault code as its own
 *      StoreErrorCode, so the UI can pick per-code recovery text.
 *   2. Falls THROUGH — not down — for unknown 409 codes: returns
 *      `"unknown"` so the UX renders a neutral fail-closed message
 *      and the raw server code stays available on the SessionApiError
 *      for diagnostics + runbook capture.
 *
 * We must never again silently downgrade an unknown server code into a
 * concrete misleading UX state.
 */
export function classifyApiFailure(
  httpStatus: number,
  apiCode: string | null,
): StoreErrorCode {
  if (httpStatus === 401) return "unauthorized";
  if (httpStatus === 403) return "forbidden";
  if (httpStatus === 404) return "session_not_found";
  if (httpStatus === 409) {
    switch (apiCode) {
      case "session_expired":
        return "session_expired";
      case "session_not_active":
        return "session_not_active";
      // Vault's complete route surfaces `session_revoked` distinctly
      // from `session_not_active`; both mean "session is terminal, not
      // recoverable via the same session id" — surfacing as
      // `session_not_active` gives the same UX affordance as either.
      case "session_revoked":
        return "session_not_active";
      // The start route's concurrency guard (a DIFFERENT session for
      // this lesson is already active). Surfacing as
      // `session_not_active` is the right learner-facing shape — the
      // start attempt cannot proceed until the old session is
      // resolved.
      case "active_session_exists":
        return "session_not_active";
      case "session_missing_step":
        return "session_missing_step";
      case "session_invalid_state":
        return "session_invalid_state";
      // Any other 409 (including future validator codes we haven't
      // taught the UI yet). Do NOT collapse into a specific concrete
      // state — return `unknown` so the UX shows a neutral fail-closed
      // message and the raw `apiCode` remains on the SessionApiError
      // for logs and runbook triage.
      default:
        return "unknown";
    }
  }
  if (httpStatus >= 500) return "network_error";
  return "unknown";
}

// ─── Fetch primitive ──────────────────────────────────────────────────────

interface CallOpts {
  method: "GET" | "POST" | "PATCH";
  path: string;
  body?: unknown;
  fetchImpl?: typeof fetch;
  getAccessTokenImpl?: () => Promise<string | null>;
}

async function call<T>(opts: CallOpts): Promise<T> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const tokenImpl = opts.getAccessTokenImpl ?? getAccessToken;
  const token = await tokenImpl();
  if (!token) {
    throw new SessionApiError(
      "unauthorized",
      "No Supabase session found — please sign in again.",
      null,
      null,
    );
  }
  const url = `${VAULT_API_URL}${opts.path}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    throw new SessionApiError(
      "network_error",
      err instanceof Error ? err.message : "Network error",
      null,
      null,
    );
  }

  let bodyJson: Record<string, unknown> | null = null;
  try {
    bodyJson = (await response.json()) as Record<string, unknown>;
  } catch {
    bodyJson = null;
  }

  if (!response.ok) {
    const apiCode =
      typeof bodyJson?.code === "string" ? (bodyJson.code as string) : null;
    const detail =
      typeof bodyJson?.error === "string"
        ? (bodyJson.error as string)
        : `HTTP ${response.status}`;
    throw new SessionApiError(
      classifyApiFailure(response.status, apiCode),
      detail,
      response.status,
      apiCode,
    );
  }

  return bodyJson as unknown as T;
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface StartSessionInput {
  certification_id: string;
  certification_version: string;
  lesson_id: string;
  activity_type: string;
  evaluator_key: string;
  criterion_version: string;
  ttl_seconds?: number;
  state?: Record<string, unknown>;
}

export async function startSession(
  input: StartSessionInput,
  deps: { fetchImpl?: typeof fetch; getAccessTokenImpl?: () => Promise<string | null> } = {},
): Promise<StartedSession> {
  const body = await call<{ ok: true; session: StartedSession }>({
    method: "POST",
    path: "/activity-sessions/start",
    body: input,
    ...deps,
  });
  return body.session;
}

export async function getSession(
  id: string,
  deps: { fetchImpl?: typeof fetch; getAccessTokenImpl?: () => Promise<string | null> } = {},
): Promise<ActivitySession> {
  const body = await call<{ ok: true; session: ActivitySession }>({
    method: "GET",
    path: `/activity-sessions/${encodeURIComponent(id)}`,
    ...deps,
  });
  return body.session;
}

export interface PatchSessionInput {
  state?: Record<string, unknown>;
  completed_steps?: string[];
}

export async function patchSession(
  id: string,
  input: PatchSessionInput,
  deps: { fetchImpl?: typeof fetch; getAccessTokenImpl?: () => Promise<string | null> } = {},
): Promise<ActivitySession> {
  const body = await call<{ ok: true; session: ActivitySession }>({
    method: "PATCH",
    path: `/activity-sessions/${encodeURIComponent(id)}`,
    body: input,
    ...deps,
  });
  return body.session;
}

export async function completeSession(
  id: string,
  deps: { fetchImpl?: typeof fetch; getAccessTokenImpl?: () => Promise<string | null> } = {},
): Promise<CompletedSession> {
  const body = await call<{ ok: true; session: CompletedSession }>({
    method: "POST",
    path: `/activity-sessions/${encodeURIComponent(id)}/complete`,
    ...deps,
  });
  return body.session;
}
