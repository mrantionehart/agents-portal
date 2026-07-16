// ============================================================================
// AP2 guided-training — Vault API client
// ============================================================================
// Thin fetch client for the two Vault endpoints the tour engine talks to.
// This module does NOT touch the database. All authorization + data
// enforcement live in Vault.
// ============================================================================

import { getAccessToken } from "@/lib/supabase";
import type {
  TourGetResponse,
  TourCompletionRequest,
} from "./types";

// Client-safe Vault base URL. Inlined here (not imported from
// workspace/api.ts) because that module is `server-only` and this
// module runs in the browser via TourProvider.
const VAULT_BASE_URL =
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api";

interface FetchTourOptions {
  certificationId: string;
  lessonId: string;
  preview?: boolean;
}

/**
 * GET /api/platform/certifications/{cert}/lessons/{lesson}/tour
 *
 * Vault returns { script, mode, moduleStatus }. `mode="preview"` is set
 * server-side only for broker-tier callers requesting `?preview=true`.
 * The client MUST NOT interpret `mode` as authorization; it is UI
 * metadata only.
 */
export async function fetchTourScript(
  opts: FetchTourOptions,
): Promise<TourGetResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("no session");

  const url = new URL(
    `${VAULT_BASE_URL}/platform/certifications/${encodeURIComponent(
      opts.certificationId,
    )}/lessons/${encodeURIComponent(opts.lessonId)}/tour`,
  );
  if (opts.preview) url.searchParams.set("preview", "true");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new TourApiError(
      `fetchTourScript: ${res.status}`,
      res.status,
      await safeReadBody(res),
    );
  }
  const body = (await res.json()) as unknown;
  assertTourGetResponse(body);
  return body;
}

/**
 * POST /api/platform/certifications/{cert}/lessons/{lesson}/complete
 * with { tour_completion: true }.
 *
 * Client sends only the sentinel. Vault resolves script id, version,
 * required step count, and completion_source from the registry. The
 * server persists the metadata; the client never authors it.
 */
export async function submitTourCompletion(opts: {
  certificationId: string;
  lessonId: string;
}): Promise<{ ok: true; lesson_id: string; status: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error("no session");

  const url = new URL(
    `${VAULT_BASE_URL}/platform/certifications/${encodeURIComponent(
      opts.certificationId,
    )}/lessons/${encodeURIComponent(opts.lessonId)}/complete`,
  );

  const body: TourCompletionRequest = { tour_completion: true };
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new TourApiError(
      `submitTourCompletion: ${res.status}`,
      res.status,
      await safeReadBody(res),
    );
  }
  return (await res.json()) as { ok: true; lesson_id: string; status: string };
}

// ─── Guards ─────────────────────────────────────────────────────────────────

export class TourApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function safeReadBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function assertTourGetResponse(body: unknown): asserts body is TourGetResponse {
  if (
    !body ||
    typeof body !== "object" ||
    !("script" in body) ||
    !("mode" in body) ||
    !("moduleStatus" in body)
  ) {
    throw new Error("Malformed tour GET response");
  }
  const b = body as { mode: unknown };
  if (b.mode !== "learner" && b.mode !== "preview") {
    throw new Error("Malformed tour GET response — bad mode");
  }
}
