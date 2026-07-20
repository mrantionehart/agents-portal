// ============================================================================
// HOTFIX.AP.STR.001 — Buildings (Portal 2.0) shared model
// ============================================================================
// The Agent Portal 2.0 "Buildings" surface presents the Vault-backed
// Airbnb-friendly building set. This module is the single source for the
// data shape, the display metadata, the approved user-facing copy, and the
// thin fetch wrapper.
//
// HARD CONSTRAINTS (do not relax without product + Vault approval):
//   - The data comes from the EXISTING proxy: /api/broker/str-directory ->
//     proxyToVault -> Vault (auth, role, tenant, field-gating). No new
//     backend, no broadened contract. Vault decides what fields an agent
//     sees; this file never assumes broker-tier fields.
//   - The dataset is ONLY the verified Airbnb-friendly set. Do NOT label it
//     "All Buildings", claim rental permission, or guarantee eligibility.
//   - No category parameter is sent: the agent-tier response already IS the
//     Airbnb-friendly set, so pinning a category would imply other categories
//     are available here.
// ============================================================================

/** Existing Vault-backed proxy. Unchanged by HOTFIX.AP.STR.001. */
export const BUILDINGS_ENDPOINT = "/api/broker/str-directory";

// ── Approved user-facing copy (product-locked, Decision 2) ──────────────────
export const BUILDINGS_PAGE_TITLE = "Buildings";
export const BUILDINGS_CATEGORY_LABEL = "Airbnb Friendly";
export const BUILDINGS_INTRO_COPY =
  "Explore buildings currently identified as Airbnb-friendly. Rental policies can change and should be independently verified.";

/** Per-building compliance disclaimer. Rental rules are never guaranteed. */
export const COMPLIANCE_DISCLAIMER =
  "Rental rules change frequently. This information is a starting point only and must be verified with the HOA, condo association, municipality, county, MLS remarks, condo docs, and current association rules before advising a client or submitting an offer.";

/** Agent-tier shape of a building row as returned by the Vault proxy.
 *  Fields the agent tier does not receive simply arrive undefined; the UI
 *  renders defensively and never depends on broker-only fields. */
export interface Building {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  city: string;
  state?: string;
  rental_restriction?: string | null;
  category: string;
  hoa_verification: string;
  last_verified_at?: string | null;
  is_featured?: boolean;
}

/** Rental-policy category → display metadata (dark-theme friendly). */
export const CATEGORY_META: Record<
  string,
  { label: string; tint: string; border: string }
> = {
  daily: { label: "Daily STR-Friendly", tint: "#4ade80", border: "rgba(74,222,128,0.30)" },
  weekly: { label: "Weekly Minimum", tint: "#60a5fa", border: "rgba(96,165,250,0.30)" },
  monthly_seasonal: { label: "Monthly / Seasonal", tint: "#fbbf24", border: "rgba(251,191,36,0.30)" },
  no_restrictions: { label: "Flexible Policy", tint: "#34d399", border: "rgba(52,211,153,0.30)" },
  hotel_program: { label: "Hotel Program", tint: "#c084fc", border: "rgba(192,132,252,0.30)" },
  verify: { label: "Needs Verification", tint: "#fb923c", border: "rgba(251,146,60,0.30)" },
};

/** HOA verification state → display metadata. */
export const VERIFICATION_META: Record<string, { label: string; emoji: string }> = {
  unverified: { label: "Unverified", emoji: "⏳" },
  verified: { label: "Verified", emoji: "✅" },
  disputed: { label: "Disputed", emoji: "⚠️" },
  outdated: { label: "Outdated — Recheck", emoji: "🔄" },
};

export function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? CATEGORY_META.verify;
}

export function verificationMeta(state: string) {
  return VERIFICATION_META[state] ?? VERIFICATION_META.unverified;
}

export interface BuildingsQuery {
  search?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export interface BuildingsResult {
  buildings: Building[];
  total: number;
  totalPages: number;
}

/** Thin, presentation-only fetch wrapper over the unchanged Vault proxy.
 *  No auth logic here — the browser's Supabase session cookie rides along,
 *  and Vault resolves identity/role/tenant server-side. */
export async function fetchAirbnbFriendlyBuildings(
  query: BuildingsQuery = {}
): Promise<BuildingsResult> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(query.limit ?? 25),
  });
  if (query.search) params.set("search", query.search);
  // NOTE: no `category` param — see module header.

  const res = await fetch(`${BUILDINGS_ENDPOINT}?${params.toString()}`, {
    signal: query.signal,
  });
  if (!res.ok) {
    throw new Error(`buildings_request_failed_${res.status}`);
  }
  const data = await res.json();
  return {
    buildings: Array.isArray(data?.buildings) ? (data.buildings as Building[]) : [],
    total: data?.pagination?.total ?? 0,
    totalPages: data?.pagination?.totalPages ?? 1,
  };
}
