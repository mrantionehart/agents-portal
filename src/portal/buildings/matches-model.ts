// ============================================================================
// EASE-2.0-PLAN-STR-DESTINATION-1 — "Your Matches" on /buildings
// ============================================================================
// The Daily Game Plan needs somewhere to send `str_match_unread`. Rather than
// a new screen, the agent's own matches get a small section on the building
// directory they already have — the page is already about Airbnb-friendly
// buildings, which is exactly what a match points at.
//
// Presentation only. The existing AP proxy forwards to Vault, and VAULT does
// the scoping: an agent-tier caller is narrowed to `agent_id = caller` AND
// `tenant_id = caller's tenant` inside `listStrMatchesForCaller`. Nothing here
// filters by identity, because nothing here is trusted to.
//
// ── ON `?match=<id>` ────────────────────────────────────────────────────────
// The id in the URL is used ONLY to decide which row to highlight among rows
// Vault already returned. It is never sent as an authorization claim and never
// used to fetch anything extra. A foreign id simply matches nothing.
//
// ── ON ORDERING ─────────────────────────────────────────────────────────────
// Vault orders by `match_score DESC, created_at DESC` and that order is kept
// verbatim. `match_score` is deliberately never re-sorted, re-weighted, or
// shown as a number: ranking belongs to Vault, and a score in the UI invites
// the Portal to start disagreeing with it.
// ============================================================================

/** The existing authenticated proxy. Vault re-verifies and scopes. */
export const MATCHES_ENDPOINT = "/api/broker/str-matches";

/** Only statuses the canonical API treats as active. Mirrors Vault's default. */
export const ACTIVE_MATCH_STATUSES = ["new", "saved"] as const;

export interface MatchRow {
  readonly id: string;
  readonly buildingLabel: string;
  /** City / neighborhood line, when the building carries one. */
  readonly locality: string | null;
  /** The first couple of Vault's own reasons — never re-worded. */
  readonly reasons: readonly string[];
  readonly listingsCount: number | null;
  readonly isRead: boolean;
}

export interface MatchesResult {
  readonly matches: MatchRow[];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Shape Vault's enriched rows for display.
 *
 * Deliberately narrow. `EnrichedStrMatch` carries `client { id, full_name }`,
 * and a client's name has no business on a building directory — so it is not
 * read here at all, rather than read and then hidden. Same for the raw score.
 */
export function toMatchRows(payload: unknown): MatchRow[] {
  const list = (payload as { matches?: unknown })?.matches;
  if (!Array.isArray(list)) return [];

  const out: MatchRow[] = [];
  for (const raw of list) {
    const m = raw as Record<string, unknown>;
    const id = str(m.id);
    if (id === null) continue;

    const building = m.building as Record<string, unknown> | null | undefined;
    const label = str(building?.name) ?? "Property match";
    const city = str(building?.city);
    const hood = str(building?.neighborhood);

    const reasons = Array.isArray(m.match_reasons)
      ? m.match_reasons.filter((r): r is string => typeof r === "string" && r.trim() !== "").slice(0, 2)
      : [];

    out.push({
      id,
      buildingLabel: label,
      locality: hood && city ? `${hood}, ${city}` : hood ?? city,
      reasons,
      listingsCount:
        typeof m.matched_listings_count === "number" ? m.matched_listings_count : null,
      isRead: m.is_read === true,
    });
  }
  return out;
}

/**
 * The caller's own active matches.
 *
 * `status` is the only filter sent, and it is the canonical active set. No
 * agent id, no tenant id — supplying either would be both useless (Vault
 * ignores it) and a lie about where authority lives.
 */
export async function fetchMyMatches(
  opts: { signal?: AbortSignal } = {},
): Promise<MatchesResult> {
  const params = new URLSearchParams({ status: ACTIVE_MATCH_STATUSES.join(",") });
  const res = await fetch(`${MATCHES_ENDPOINT}?${params.toString()}`, {
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`matches_request_failed_${res.status}`);
  return { matches: toMatchRows(await res.json()) };
}

/**
 * Mark one match read, through the existing canonical mutation.
 *
 * This is the ONLY write in this feature and it fires only from an explicit
 * user action. Rendering the page must never call it: a match that marks
 * itself read on sight disappears from the Daily Game Plan before the agent
 * has done anything about it.
 */
export async function markMatchReviewed(matchId: string): Promise<boolean> {
  const res = await fetch(MATCHES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ match_ids: [matchId] }),
  });
  if (!res.ok) return false;
  const body = await res.json().catch(() => null);
  return (body as { success?: boolean } | null)?.success === true;
}
