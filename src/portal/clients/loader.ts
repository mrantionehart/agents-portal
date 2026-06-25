// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Server-only client loader
// ============================================================================
// Reads `client_profiles` directly via the existing Supabase client.
// Applies the SAME agent-access gate as AP2.1D + the existing
// /api/broker/client-intelligence routes. Sanitizes broker-only fields
// before returning to UI. Never writes.
// ============================================================================

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClientDetail,
  ClientListItem,
  DetailResult,
  ListResult,
} from "./types";
import { deriveBucket, formatBudgetRange } from "./helpers";

// Sanitized columns. Excludes: broker_notes, red_flags,
// profitability, commission, decision_notes, ai_relationship_summary_broker,
// any broker-internal flags.
const SAFE_COLUMNS = [
  "id",
  "full_name",
  "email",
  "phone",
  "profile_type",
  "temperature",
  "representation_status",
  "preferred_channel",
  "preferred_contact_time",
  "motivation",
  "timeline",
  "qualification_timeline",
  "budget_min",
  "budget_max",
  "target_areas",
  "must_haves",
  "readiness_score",
  "updated_at",
  // Access-check columns:
  "assigned_agent_id",
  "claimed_by",
  "visibility",
  "status",
].join(", ");

interface RawProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  profile_type: string | null;
  temperature: string | null;
  representation_status: string | null;
  preferred_channel: string | null;
  preferred_contact_time: string | null;
  motivation: string | null;
  timeline: string | null;
  qualification_timeline: string | null;
  budget_min: number | null;
  budget_max: number | null;
  target_areas: unknown;
  must_haves: unknown;
  readiness_score: number | null;
  updated_at: string | null;
  assigned_agent_id: string | null;
  claimed_by: string | null;
  visibility: string | null;
  status: string | null;
}

// ── Access checks (mirrors AP2.1D / broker CI agent-view) ───────────

function isBrokerTier(role: string): boolean {
  return role === "broker" || role === "admin" || role === "office_manager";
}

function canAccess(p: RawProfile, callerId: string, callerRole: string): boolean {
  if (isBrokerTier(callerRole)) return true;
  if (p.assigned_agent_id === callerId) return true;
  if (p.claimed_by === callerId) return true;
  if (p.visibility === "dispo_feed" && p.status === "dispo") return true;
  return false;
}

// ── Sanitization ────────────────────────────────────────────────────

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function sanitizeListItem(p: RawProfile, callerId: string): ClientListItem {
  return {
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone,
    profile_type: p.profile_type,
    temperature: p.temperature,
    representation_status: p.representation_status,
    preferred_channel: p.preferred_channel,
    target_areas: toStringArray(p.target_areas),
    updated_at: p.updated_at,
    assignmentBucket: deriveBucket(p, callerId),
  };
}

function sanitizeDetail(p: RawProfile, callerId: string): ClientDetail {
  return {
    ...sanitizeListItem(p, callerId),
    preferred_contact_time: p.preferred_contact_time,
    motivation: p.motivation,
    timeline: p.qualification_timeline ?? p.timeline,
    budget_range: formatBudgetRange(p.budget_min, p.budget_max),
    must_haves: toStringArray(p.must_haves),
    readiness_score: p.readiness_score,
  };
}

// ── List loader ─────────────────────────────────────────────────────

/**
 * Load the client list visible to the caller. Brokers see every row in
 * their tenant; agents see only the rows they're assigned to / have
 * claimed / are in the dispo feed.
 */
export async function loadClientList(input: {
  supabase: SupabaseClient;
  callerId: string;
  callerRole: string;
}): Promise<ListResult> {
  const { supabase, callerId, callerRole } = input;
  let query = supabase
    .from("client_profiles")
    .select(SAFE_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (!isBrokerTier(callerRole)) {
    // Agents — only rows they're assigned, claimed, or in the dispo feed.
    query = query.or(
      [
        `assigned_agent_id.eq.${callerId}`,
        `claimed_by.eq.${callerId}`,
        `and(visibility.eq.dispo_feed,status.eq.dispo)`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) {
    return { kind: "error", status: 500, message: error.message };
  }
  const rows = ((data ?? []) as unknown) as RawProfile[];
  return { kind: "ok", items: rows.map((r) => sanitizeListItem(r, callerId)) };
}

// ── Detail loader ───────────────────────────────────────────────────

/**
 * Load a single client by id. Returns:
 *   - kind: "ok"          → caller can see it
 *   - kind: "not_found"   → row doesn't exist OR caller has no access
 *                            (deliberately conflated so we never leak
 *                            existence of inaccessible rows)
 *   - kind: "error"       → DB error
 */
export async function loadClientDetail(input: {
  supabase: SupabaseClient;
  callerId: string;
  callerRole: string;
  clientId: string;
}): Promise<DetailResult> {
  const { supabase, callerId, callerRole, clientId } = input;
  const { data, error } = await supabase
    .from("client_profiles")
    .select(SAFE_COLUMNS)
    .eq("id", clientId)
    .maybeSingle();
  if (error) return { kind: "error", message: error.message };
  if (!data) return { kind: "not_found" };
  const row = (data as unknown) as RawProfile;
  if (!canAccess(row, callerId, callerRole)) return { kind: "not_found" };
  return { kind: "ok", client: sanitizeDetail(row, callerId) };
}

// Re-exports for test convenience.
export {
  canAccess as _canAccess,
  sanitizeListItem as _sanitizeListItem,
  sanitizeDetail as _sanitizeDetail,
};
