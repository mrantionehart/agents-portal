// ============================================================================
// AGENT PORTAL 2.1 — R6 — Server-only Home Intelligence fetcher
// ============================================================================
// Calls EXISTING endpoints only — no new APIs:
//   1. agents-portal /api/news?limit=5      (Vault proxy, cached 15min, public)
//   2. Vault /api/development-radar?limit=5 (Bearer)
//   3. agents-portal /api/new-leads?filter=mine + /api/broker/intakes
//      (same R3B SEC.3A-scoped pattern, cookie-forwarded)
//   4. client_profiles direct read (R3A loader semantic)
//
// All four resolve in parallel. Each source's error is captured per
// stream so a single failure never blanks the whole dashboard.
// ============================================================================

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildHotLeads } from "./intelligence-helpers";
import type {
  HomeIntelligence,
  HotLeadItem,
  NewsArticle,
  RadarDevelopment,
} from "./intelligence-types";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

const NEWS_MAX = 5;
const RADAR_MAX = 5;
const LEADS_MAX_PER_KIND = 5;

interface FetchInput {
  baseUrl: string;
  cookieHeader: string;
  accessToken: string;
  supabase: SupabaseClient;
  callerId: string;
}

export async function loadHomeIntelligence(
  input: FetchInput
): Promise<HomeIntelligence> {
  const [newsRes, radarRes, leadsRes] = await Promise.all([
    fetchNews(input),
    fetchRadar(input),
    fetchHotLeads(input),
  ]);

  return {
    news: newsRes.items,
    radar: radarRes.items,
    // R6 brief — Opportunities feed has no real backend yet; the
    // legacy /opportunities page hardcodes empty. We surface a
    // graceful empty array; the widget renders an empty state.
    opportunities: [],
    hotLeads: leadsRes.items,
    errors: {
      news: newsRes.error,
      radar: radarRes.error,
      leads: leadsRes.error,
    },
  };
}

// ── News ────────────────────────────────────────────────────────────

async function fetchNews(input: FetchInput): Promise<{
  items: NewsArticle[];
  error: string | null;
}> {
  try {
    const res = await fetch(`${input.baseUrl}/api/news?limit=${NEWS_MAX}`, {
      headers: { "Content-Type": "application/json" },
      // The proxy itself caches 15 min at edge; we use no-store here
      // so a fresh page load doesn't accidentally pin a stale cache
      // miss.
      cache: "no-store",
    });
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };
    const body = await res.json();
    const articles = Array.isArray(body?.articles)
      ? (body.articles as NewsArticle[])
      : [];
    return { items: articles.slice(0, NEWS_MAX), error: null };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── Development Radar ───────────────────────────────────────────────

async function fetchRadar(input: FetchInput): Promise<{
  items: RadarDevelopment[];
  error: string | null;
}> {
  try {
    const res = await fetch(
      `${VAULT_API_URL}/development-radar?limit=${RADAR_MAX}&sort=created_at&order=desc`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };
    const body = await res.json();
    // Vault paginated response — list lives under `developments` or
    // a top-level `data` array depending on rev.
    const list = Array.isArray(body?.developments)
      ? body.developments
      : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
      ? body
      : [];
    return {
      items: list.slice(0, RADAR_MAX) as RadarDevelopment[],
      error: null,
    };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── Hot Leads ──────────────────────────────────────────────────────

async function fetchHotLeads(input: FetchInput): Promise<{
  items: HotLeadItem[];
  error: string | null;
}> {
  try {
    // Parallel: assigned profiles (R3A) + claimed new_leads (R3B) +
    // intakes (R3B).
    const [profilesRes, leadsRes, intakesRes] = await Promise.all([
      input.supabase
        .from("client_profiles")
        .select("id, full_name, email, updated_at")
        .eq("assigned_agent_id", input.callerId)
        .order("updated_at", { ascending: false })
        .limit(LEADS_MAX_PER_KIND),
      fetch(`${input.baseUrl}/api/new-leads?filter=mine`, {
        headers: {
          cookie: input.cookieHeader,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }),
      fetch(`${input.baseUrl}/api/broker/intakes`, {
        headers: {
          cookie: input.cookieHeader,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }),
    ]);

    const assignedClients = profilesRes.data ?? [];

    let claimedLeads: Array<{
      id: string;
      name: string | null;
      email: string | null;
      source: string | null;
      created_at: string;
    }> = [];
    if (leadsRes.ok) {
      const body = await leadsRes.json();
      const arr = Array.isArray(body?.leads) ? body.leads : [];
      claimedLeads = arr.map((l: Record<string, unknown>) => ({
        id: l.id as string,
        name: (l.name as string | null) ?? null,
        email: (l.email as string | null) ?? null,
        source: (l.source as string | null) ?? null,
        created_at: (l.created_at as string) ?? "",
      }));
    }

    let intakes: Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      created_at: string;
    }> = [];
    if (intakesRes.ok) {
      const body = await intakesRes.json();
      const arr = Array.isArray(body?.intakes) ? body.intakes : [];
      intakes = arr.map((i: Record<string, unknown>) => ({
        id: i.id as string,
        full_name: (i.full_name as string | null) ?? null,
        email: (i.email as string | null) ?? null,
        created_at: (i.created_at as string) ?? "",
      }));
    }

    const items = buildHotLeads({
      assignedClients: assignedClients as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        updated_at: string | null;
      }>,
      claimedLeads,
      intakes,
      maxPerKind: LEADS_MAX_PER_KIND,
    });

    return { items, error: null };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
