// ============================================================================
// AGENT PORTAL 2.0 — AP2.1D — Client Intelligence read helper
// ============================================================================
// Server-only. Looks up the existing `client_profiles` row that
// corresponds to this transaction's client (by email, then by name as
// fallback), applies the same access check the existing
// /api/broker/client-intelligence/[id]/agent-view route uses, and
// returns a sanitized summary the per-txn workspace page can render.
//
// Read-only. Never writes. Never creates new Vault endpoints. Never
// adds tables. Pure composition of existing data.
// ============================================================================

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────

export interface ClientIntelligenceSummary {
  /** client_profiles.id — useful for deep-linking into the existing CI
   *  surface at /client-intelligence/{id} when needed. */
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;

  // ── Preferences / context (sanitized — no broker_notes / red_flags) ──
  preferred_channel: string | null;
  preferred_contact_time: string | null;
  motivation: string | null;
  timeline: string | null;
  budget_range: string | null;
  target_areas: string[];
  must_haves: string[];
  profile_type: string | null;
  representation_status: string | null;
  temperature: string | null;
  readiness_score: number | null;
}

export type ClientIntelligenceResult =
  | { kind: "found"; summary: ClientIntelligenceSummary }
  | { kind: "no_match"; reason: "no_email_or_name" | "no_matching_profile" | "access_denied" };

// ── Sanitized columns we pull from client_profiles ──────────────────

const ALLOWED_COLUMNS = [
  "id",
  "full_name",
  "email",
  "email_normalized",
  "phone",
  "preferred_channel",
  "preferred_contact_time",
  "motivation",
  "timeline",
  "qualification_timeline",
  "budget_min",
  "budget_max",
  "target_areas",
  "must_haves",
  "profile_type",
  "representation_status",
  "temperature",
  "readiness_score",
  // Access-check fields:
  "assigned_agent_id",
  "claimed_by",
  "visibility",
  "status",
].join(", ");

interface RawProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  preferred_channel: string | null;
  preferred_contact_time: string | null;
  motivation: string | null;
  timeline: string | null;
  qualification_timeline: string | null;
  budget_min: number | null;
  budget_max: number | null;
  target_areas: unknown;
  must_haves: unknown;
  profile_type: string | null;
  representation_status: string | null;
  temperature: string | null;
  readiness_score: number | null;
  assigned_agent_id: string | null;
  claimed_by: string | null;
  visibility: string | null;
  status: string | null;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Look up a Client Intelligence summary for the given transaction
 * client. Pure read; never writes. Returns a sanitized agent-safe view
 * even for broker-tier callers — this panel exists on the agent surface,
 * so the same shape is shown to everyone.
 *
 * Caller must pass:
 *   - the session-authenticated supabase client (cookie-bound)
 *   - the caller's id + role (for the access check)
 *   - the transaction's client identifiers (email / name)
 */
export async function loadClientIntelligenceForTransaction(input: {
  supabase: SupabaseClient;
  callerId: string;
  callerRole: string;
  clientEmail: string | null;
  clientName: string | null;
}): Promise<ClientIntelligenceResult> {
  const { supabase, callerId, callerRole, clientEmail, clientName } = input;

  if (!clientEmail && !clientName) {
    return { kind: "no_match", reason: "no_email_or_name" };
  }

  // 1. Try the email match first (most reliable).
  let profile: RawProfile | null = null;
  if (clientEmail) {
    const norm = clientEmail.trim().toLowerCase();
    const { data } = await supabase
      .from("client_profiles")
      .select(ALLOWED_COLUMNS)
      .eq("email_normalized", norm)
      .limit(1)
      .maybeSingle<RawProfile>();
    profile = data ?? null;
  }

  // 2. Fall back to a name match if no email or no email-match.
  if (!profile && clientName) {
    const { data } = await supabase
      .from("client_profiles")
      .select(ALLOWED_COLUMNS)
      .ilike("full_name", clientName)
      .limit(1)
      .maybeSingle<RawProfile>();
    profile = data ?? null;
  }

  if (!profile) return { kind: "no_match", reason: "no_matching_profile" };

  // 3. Access check — mirrors the existing agent-view route's gate.
  const isBroker = ["broker", "admin", "office_manager"].includes(callerRole);
  const canAccess =
    isBroker ||
    profile.assigned_agent_id === callerId ||
    profile.claimed_by === callerId ||
    (profile.visibility === "dispo_feed" && profile.status === "dispo");
  if (!canAccess) return { kind: "no_match", reason: "access_denied" };

  return { kind: "found", summary: sanitize(profile) };
}

// ── Sanitization ────────────────────────────────────────────────────

function sanitize(p: RawProfile): ClientIntelligenceSummary {
  const targetAreas = Array.isArray(p.target_areas)
    ? (p.target_areas as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const mustHaves = Array.isArray(p.must_haves)
    ? (p.must_haves as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  return {
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone,
    preferred_channel: p.preferred_channel,
    preferred_contact_time: p.preferred_contact_time,
    motivation: p.motivation,
    timeline: p.qualification_timeline ?? p.timeline,
    budget_range: formatBudgetRange(p.budget_min, p.budget_max),
    target_areas: targetAreas,
    must_haves: mustHaves,
    profile_type: p.profile_type,
    representation_status: p.representation_status,
    temperature: p.temperature,
    readiness_score: p.readiness_score,
  };
}

// ── Pure helpers (exported for unit tests) ───────────────────────────

export function formatBudgetRange(
  min: number | null,
  max: number | null
): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

export function temperatureLabel(t: string | null): string {
  if (t === "hot") return "Hot";
  if (t === "warm") return "Warm";
  if (t === "cold") return "Cold";
  return "—";
}

export function channelLabel(c: string | null): string {
  if (!c) return "—";
  if (c === "phone") return "Phone";
  if (c === "email") return "Email";
  if (c === "text") return "Text";
  if (c === "sms") return "Text (SMS)";
  if (c === "in_person") return "In person";
  return c;
}
