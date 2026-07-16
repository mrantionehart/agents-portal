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

// Issue 3 — deep validation of the tour GET response.
//
// The tour engine cannot render a partially-malformed script without
// throwing mid-render (e.g. `.map()` on a missing `bodyContent`). This
// validator walks the response shape completely so a malformed body
// surfaces as a graceful error state instead of crashing the Portal.
//
// The check is intentionally conservative: any unknown interaction
// kind, unknown content-node type, non-array `steps`, or missing
// required field on a step throws with an actionable message. TourProvider
// catches these into its error-state branch.

const VALID_INTERACTION_KINDS = new Set([
  "informational",
  "target_click",
  "route_change",
  "state_confirmation",
  "manual_confirmation",
]);
const VALID_NODE_TYPES = new Set(["heading", "paragraph", "list"]);
const VALID_PLACEMENTS = new Set(["top", "right", "bottom", "left", "center"]);
const VALID_MODULE_STATUSES = new Set(["draft", "published", "archived"]);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function validateContentNode(node: unknown, ctx: string): void {
  if (!node || typeof node !== "object") {
    throw new TourResponseShapeError(`${ctx}: content node is not an object`);
  }
  const n = node as Record<string, unknown>;
  if (typeof n.type !== "string" || !VALID_NODE_TYPES.has(n.type)) {
    throw new TourResponseShapeError(
      `${ctx}: content node has unknown type "${String(n.type)}"`,
    );
  }
  if (n.type === "heading") {
    if (n.level !== 2 && n.level !== 3) {
      throw new TourResponseShapeError(`${ctx}: heading level must be 2 or 3`);
    }
    if (typeof n.text !== "string") {
      throw new TourResponseShapeError(`${ctx}: heading text must be a string`);
    }
  } else if (n.type === "paragraph") {
    if (typeof n.text !== "string") {
      throw new TourResponseShapeError(`${ctx}: paragraph text must be a string`);
    }
  } else if (n.type === "list") {
    if (typeof n.ordered !== "boolean") {
      throw new TourResponseShapeError(`${ctx}: list.ordered must be a boolean`);
    }
    if (!Array.isArray(n.items)) {
      throw new TourResponseShapeError(`${ctx}: list.items must be an array`);
    }
    for (let i = 0; i < n.items.length; i++) {
      if (typeof n.items[i] !== "string") {
        throw new TourResponseShapeError(`${ctx}: list.items[${i}] must be a string`);
      }
    }
  }
}

function validateInteraction(v: unknown, ctx: string): void {
  if (!v || typeof v !== "object") {
    throw new TourResponseShapeError(`${ctx}: interaction is not an object`);
  }
  const i = v as Record<string, unknown>;
  if (typeof i.kind !== "string" || !VALID_INTERACTION_KINDS.has(i.kind)) {
    throw new TourResponseShapeError(
      `${ctx}: unknown interaction kind "${String(i.kind)}"`,
    );
  }
  if (i.kind === "target_click" && !isNonEmptyString(i.targetId)) {
    throw new TourResponseShapeError(
      `${ctx}: target_click requires a non-empty targetId`,
    );
  }
  if (i.kind === "route_change" && !isNonEmptyString(i.expectedRoute)) {
    throw new TourResponseShapeError(
      `${ctx}: route_change requires a non-empty expectedRoute`,
    );
  }
  if (i.kind === "manual_confirmation" && !isNonEmptyString(i.confirmLabel)) {
    throw new TourResponseShapeError(
      `${ctx}: manual_confirmation requires a non-empty confirmLabel`,
    );
  }
}

function validateStep(step: unknown, index: number): void {
  const ctx = `step[${index}]`;
  if (!step || typeof step !== "object") {
    throw new TourResponseShapeError(`${ctx}: not an object`);
  }
  const s = step as Record<string, unknown>;
  if (!isNonEmptyString(s.id)) {
    throw new TourResponseShapeError(`${ctx}: missing id`);
  }
  if (typeof s.order !== "number" || !Number.isFinite(s.order)) {
    throw new TourResponseShapeError(`${ctx}: missing/invalid order`);
  }
  if (typeof s.title !== "string") {
    throw new TourResponseShapeError(`${ctx}: title must be a string`);
  }
  if (s.targetId !== null && !isNonEmptyString(s.targetId)) {
    throw new TourResponseShapeError(`${ctx}: targetId must be null or non-empty string`);
  }
  if (typeof s.placement !== "string" || !VALID_PLACEMENTS.has(s.placement)) {
    throw new TourResponseShapeError(
      `${ctx}: bad placement "${String(s.placement)}"`,
    );
  }
  if (typeof s.optional !== "boolean") {
    throw new TourResponseShapeError(`${ctx}: optional must be a boolean`);
  }
  if (!Array.isArray(s.bodyContent)) {
    throw new TourResponseShapeError(`${ctx}: bodyContent must be an array`);
  }
  for (let i = 0; i < s.bodyContent.length; i++) {
    validateContentNode(s.bodyContent[i], `${ctx}.bodyContent[${i}]`);
  }
  validateInteraction(s.interaction, ctx);
}

export function assertTourGetResponse(body: unknown): asserts body is TourGetResponse {
  if (!body || typeof body !== "object") {
    throw new TourResponseShapeError("Response body is not an object");
  }
  const b = body as Record<string, unknown>;

  if (b.mode !== "learner" && b.mode !== "preview") {
    throw new TourResponseShapeError(`Bad mode "${String(b.mode)}"`);
  }
  if (typeof b.moduleStatus !== "string" || !VALID_MODULE_STATUSES.has(b.moduleStatus)) {
    throw new TourResponseShapeError(
      `Bad moduleStatus "${String(b.moduleStatus)}"`,
    );
  }
  if (!b.script || typeof b.script !== "object") {
    throw new TourResponseShapeError("script is missing or not an object");
  }
  const s = b.script as Record<string, unknown>;
  if (!isNonEmptyString(s.id)) {
    throw new TourResponseShapeError("script.id must be a non-empty string");
  }
  if (!isNonEmptyString(s.lessonId)) {
    throw new TourResponseShapeError("script.lessonId must be a non-empty string");
  }
  if (!isNonEmptyString(s.certificationId)) {
    throw new TourResponseShapeError("script.certificationId must be a non-empty string");
  }
  if (!isNonEmptyString(s.scriptVersion)) {
    throw new TourResponseShapeError("script.scriptVersion must be a non-empty string");
  }
  if (!Array.isArray(s.steps)) {
    throw new TourResponseShapeError("script.steps is not an array");
  }
  if (s.steps.length === 0) {
    throw new TourResponseShapeError("script.steps is empty");
  }
  for (let i = 0; i < s.steps.length; i++) {
    validateStep(s.steps[i], i);
  }
}

/**
 * Thrown when the tour GET response fails deep-shape validation. Caught
 * by TourProvider.start() and surfaced as an error state.
 */
export class TourResponseShapeError extends Error {
  constructor(message: string) {
    super(`Malformed tour response — ${message}`);
    this.name = "TourResponseShapeError";
  }
}
