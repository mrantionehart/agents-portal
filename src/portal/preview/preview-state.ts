// ============================================================================
// Broker Preview Agent View — per-tab preview state (PREVIEW-ONLY)
// ============================================================================
// The Broker of Record opens the REAL Agent Portal in a preview tab using their
// OWN shared-Supabase session (no impersonation, no agent session). This module
// is the single source of truth for "is this tab a broker preview tab", shared
// by the layout banner and the `authFetch` read-only clamp.
//
// SECURITY MODEL — this flag only ever RESTRICTS, never grants:
//   • It cannot escalate privilege. The broker already holds their own session;
//     preview mode adds a banner + a read-only clamp and nothing else. An agent
//     who forged the flag would only block their OWN writes (self-harm), never
//     gain access — so the flag is safe to keep in per-tab sessionStorage.
//   • Privacy is structural, not dependent on this flag: every agent-facing
//     endpoint is self-scoped to the caller, so a broker only ever sees their
//     own/empty data, never another agent's.
//
// Isolation mirrors the guided-training preview (persistence-preview.ts):
// per-tab sessionStorage, a disjoint key prefix, no user identifier. Closing
// the tab ends the preview.
//
// DARK by default: the whole capability is gated by a build-time flag so it
// ships disabled until deliberately enabled (separate activation).
// ============================================================================

const PREVIEW_KEY = "ht.broker.preview.active" as const;

/** Brokerage-wide gate. OFF by default → the preview capability is dark until
 *  NEXT_PUBLIC_BROKER_PREVIEW_ENABLED = "true" (separate activation). */
export function brokerPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BROKER_PREVIEW_ENABLED === "true";
}

/** Roles permitted to enter preview. Mirrors nav-config's isBrokerTier. The
 *  authoritative check is server-derived role (useAuth), never a URL param. */
export function isBrokerTierRole(role: string | null | undefined): boolean {
  return role === "broker" || role === "admin" || role === "office_manager";
}

function safeSession(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Mark THIS tab as a broker preview tab. Caller must have already confirmed
 *  the flag is enabled AND the server-derived role is broker-tier. */
export function markPreviewActive(): void {
  try {
    safeSession()?.setItem(PREVIEW_KEY, "1");
  } catch {
    /* storage unavailable (private mode / blocked) — preview simply stays off */
  }
}

export function clearPreview(): void {
  try {
    safeSession()?.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore */
  }
}

/** True when this tab is an active broker preview tab AND the capability is
 *  enabled. Both the banner and the read-only clamp read this. */
export function isPreviewActive(): boolean {
  if (!brokerPreviewEnabled()) return false;
  try {
    return safeSession()?.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

// ── Read-only clamp allowlist ───────────────────────────────────────────────
// Preview is READ-ONLY by default: every non-GET request is blocked EXCEPT the
// isolated "safe interactive testing" paths — the Ring AI roleplay PRACTICE
// endpoints, which create only the BROKER's own developmental practice sessions
// (mode=practice, never counting toward progression) and therefore cannot touch
// any agent's records, certifications, scoring, or the broker performance
// reports. Assessments (which DO count) and every real mutation (deals, signing,
// assignments, payouts, notifications, profile, follow-ups, …) stay blocked.
const SAFE_INTERACTIVE_PATTERNS: readonly RegExp[] = [
  /\/simulation\/text\/(prepare|begin|turn|complete)\b/i, // Ring text roleplay
  /\/simulation\/practice\//i, // Ring voice roleplay (prepare/join/complete/result/transcript)
];

/** Whether a mutating request to `url` is permitted in preview — only the
 *  isolated Ring roleplay practice paths are. */
export function isSafeInteractiveUrl(url: string): boolean {
  if (/\/assessment/i.test(url)) return false; // assessments count — never in preview
  return SAFE_INTERACTIVE_PATTERNS.some((re) => re.test(url));
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** The read-only decision for `authFetch`: true ⇒ block this request. */
export function previewBlocksRequest(method: string | undefined, url: string): boolean {
  if (!isPreviewActive()) return false;
  const m = (method ?? "GET").toUpperCase();
  if (!MUTATING.has(m)) return false; // reads always allowed
  return !isSafeInteractiveUrl(url); // mutations blocked unless a safe roleplay path
}

/** Error thrown for a blocked write, so callers can show an honest message. */
export class PreviewReadOnlyError extends Error {
  readonly code = "preview_read_only";
  constructor() {
    super("Broker Preview Mode is read-only — this action is disabled while previewing the agent experience.");
    this.name = "PreviewReadOnlyError";
  }
}
