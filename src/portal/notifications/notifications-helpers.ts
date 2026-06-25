// ============================================================================
// AGENT PORTAL 2.0 — AP2.1F — Notifications inbox helpers
// ============================================================================
// Pure derivations: schema mirror, type → category mapping, filter
// composition, time-ago formatter, icon mapping. All inputs are
// plain JSON shapes; no Supabase / DOM dependencies.
//
// Schema mirrors the EXISTING `notifications` table that the legacy
// /notifications page already reads (and the dashboard topbar bell
// in the parent Vault project queries via read_at IS NULL).
// ============================================================================

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  /** body — production column. NOT 'message'. Documented in legacy
   *  /notifications page comments (Sprint D-3 Track F.0.1 fix). */
  body: string | null;
  type: string;
  /** read_at — timestamptz. NULL = unread, ISO string = read. */
  read_at: string | null;
  created_at: string;
  /** Optional deep-link the producer (Vault) embedded. */
  action_url?: string | null;
  /** Optional polymorphic foreign key. The only `related_type` we
   *  surface a deep-link for is "transaction" (→ /workspace/<uuid>). */
  related_type?: string | null;
  related_id?: string | null;
}

// ── Categories ──────────────────────────────────────────────────────

export type Category = "transactions" | "paperwork" | "system" | "other";

/** Map an existing notification.type id to one of the spec'd filter
 *  categories. Soft mapping — unknown types fall through to "system". */
export function categoryFor(type: string): Category {
  switch (type) {
    case "deal":
    case "lead":
    case "commission":
      return "transactions";
    case "compliance":
    case "signature":
    case "envelope":
    case "portal":
    case "paperwork":
      return "paperwork";
    case "training":
    case "event":
    case "chat":
    case "system":
      return "system";
    default:
      return "other";
  }
}

export type StatusFilter = "all" | "unread";
export type CategoryFilter = "all" | "transactions" | "paperwork" | "system";

/** Apply both filters. AND across axes. */
export function applyFilters(
  rows: NotificationRow[],
  filters: { status: StatusFilter; category: CategoryFilter }
): NotificationRow[] {
  return rows.filter((n) => {
    if (filters.status === "unread" && n.read_at) return false;
    if (filters.category !== "all") {
      const cat = categoryFor(n.type);
      // "system" filter includes "other" (catch-all) so unknown types
      // surface somewhere by default.
      if (filters.category === "system" && cat !== "system" && cat !== "other") return false;
      if (filters.category === "transactions" && cat !== "transactions") return false;
      if (filters.category === "paperwork" && cat !== "paperwork") return false;
    }
    return true;
  });
}

// ── Counts ──────────────────────────────────────────────────────────

export interface InboxCounts {
  total: number;
  unread: number;
  transactions: number;
  paperwork: number;
  system: number;
}

export function inboxCounts(rows: NotificationRow[]): InboxCounts {
  let unread = 0,
    transactions = 0,
    paperwork = 0,
    system = 0;
  for (const n of rows) {
    if (!n.read_at) unread += 1;
    const c = categoryFor(n.type);
    if (c === "transactions") transactions += 1;
    else if (c === "paperwork") paperwork += 1;
    else system += 1;
  }
  return { total: rows.length, unread, transactions, paperwork, system };
}

// ── Time-ago + icon ─────────────────────────────────────────────────

/** Time-ago label. Now is passed in so tests are deterministic. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Category icon — emoji from the legacy page's set. Returns "🔔" as
 *  the default so unmapped types still get a sensible glyph. */
export function iconFor(type: string): string {
  switch (type) {
    case "deal":
      return "💼";
    case "commission":
      return "💰";
    case "lead":
      return "👤";
    case "compliance":
      return "📋";
    case "training":
      return "📚";
    case "chat":
      return "💬";
    case "event":
      return "📅";
    case "signature":
      return "✍️";
    case "envelope":
      return "📨";
    case "portal":
      return "🪪";
    default:
      return "🔔";
  }
}

// ── Link target derivation ──────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A `related_type` value we know how to deep-link safely. */
function isTransactionRelatedType(t: string | null | undefined): boolean {
  if (!t) return false;
  const v = t.toLowerCase();
  return v === "transaction" || v === "deal";
}

/** Whitelist of internal app routes we will follow as `action_url`.
 *  Anything else (including absolute URLs to external domains) is
 *  ignored to avoid letting Vault inject open redirects through the
 *  notification stream. */
function isSafeInternalUrl(url: string): boolean {
  if (!url) return false;
  // Must be a single-slash absolute path; reject protocol-relative
  // ("//evil.com"), schemes ("https://"), control chars, and back-
  // referenced ".." traversal.
  if (!url.startsWith("/")) return false;
  if (url.startsWith("//")) return false;
  if (/[\s\\]/.test(url)) return false;
  if (url.includes("..")) return false;
  // Optional further hardening: only allow paths under known portal
  // surfaces. This list mirrors the AP2.1A-H route table.
  const ALLOWED_PREFIXES = [
    "/home",
    "/workspace",
    "/clients",
    "/calendar",
    "/notifications",
    "/ai",
    "/settings",
  ];
  return ALLOWED_PREFIXES.some((p) => url === p || url.startsWith(p + "/") || url.startsWith(p + "?"));
}

/**
 * Derive a deep-link target for the row. Order:
 *   1. If related_type names a transaction AND related_id is a UUID →
 *      /workspace/<uuid>
 *   2. Else if action_url is a safe internal route → action_url
 *   3. Else null (no link rendered)
 * Pure — does no I/O.
 */
export function linkTargetFor(n: NotificationRow): string | null {
  // 1. Polymorphic foreign key.
  if (
    isTransactionRelatedType(n.related_type) &&
    typeof n.related_id === "string" &&
    UUID_RE.test(n.related_id)
  ) {
    return `/workspace/${n.related_id}`;
  }
  // 2. Producer-provided action_url, ONLY if it points at an internal
  //    portal route. Vault could otherwise inject an external redirect.
  if (typeof n.action_url === "string" && isSafeInternalUrl(n.action_url)) {
    return n.action_url;
  }
  return null;
}

// Exported for tests.
export const _internal = { isSafeInternalUrl, isTransactionRelatedType };
