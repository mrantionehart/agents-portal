// ============================================================================
// AGENT PORTAL 2.1 — R6 — Home Intelligence pure helpers
// ============================================================================
// Production + Pipeline snapshot derivations are pure functions over
// the existing WorkspaceCard[] — no new business logic, just slicing
// the buckets the rule engine already exposes.
// ============================================================================

import type { WorkspaceCard } from "../workspace/types";
import type {
  HotLeadItem,
  NewsArticle,
  PipelineSnapshot,
  ProductionSnapshot,
  RadarDevelopment,
} from "./intelligence-types";

// ── Production Snapshot ─────────────────────────────────────────────
// "Active" = every transaction the agent has open right now
// (stage !== completed). "Signed" = transactions where every required
// form is signed (signed_forms_count >= required_forms_count and
// required > 0).
//
// We bucket each card into exactly the canonical categories the brief
// names — derived from the same WorkspaceCard fields the rule engine
// already populated. No new business logic.

export function productionSnapshot(cards: WorkspaceCard[]): ProductionSnapshot {
  let active = 0;
  let ready_for_review = 0;
  let ready_for_signature = 0;
  let blocked = 0;
  let signed = 0;

  for (const c of cards) {
    const stage = (c.stage || "").toLowerCase();
    if (stage !== "completed") active += 1;

    if (c.readiness_tier === "ready_for_review") ready_for_review += 1;
    if (c.readiness_tier === "ready_for_signature") ready_for_signature += 1;
    if ((c.blocked_forms_count ?? 0) > 0) blocked += 1;

    // A transaction is fully "signed" when at least one form was
    // required AND every required form is signed.
    if (
      (c.required_forms_count ?? 0) > 0 &&
      (c.signed_forms_count ?? 0) >= (c.required_forms_count ?? 0)
    ) {
      signed += 1;
    }
  }

  return { active, ready_for_review, ready_for_signature, blocked, signed };
}

// ── Pipeline Snapshot ──────────────────────────────────────────────
// Counts cards by their stage. Stage vocabulary is set by Vault's rule
// engine; here we map to the 5 buckets the brief lists. Anything we
// don't recognize counts as "drafting" so the totals always add up.

const STAGE_TO_BUCKET: Record<string, keyof PipelineSnapshot> = {
  drafting: "drafting",
  collecting: "collecting",
  broker_review: "broker_review",
  brokerreview: "broker_review",
  in_review: "broker_review",
  ready_for_review: "broker_review",
  ready_for_signature: "signature",
  signature: "signature",
  envelope_sent: "signature",
  completed: "completed",
  closed: "completed",
};

export function pipelineSnapshot(cards: WorkspaceCard[]): PipelineSnapshot {
  const out: PipelineSnapshot = {
    drafting: 0,
    collecting: 0,
    broker_review: 0,
    signature: 0,
    completed: 0,
  };
  for (const c of cards) {
    const key = (c.stage || "").toLowerCase().replace(/[-\s]/g, "_");
    const bucket = STAGE_TO_BUCKET[key];
    if (bucket) {
      out[bucket] += 1;
    } else {
      out.drafting += 1;
    }
  }
  return out;
}

// ── News ──────────────────────────────────────────────────────────

/** Take at most N most-recent articles. Source RSS feeds emit
 *  pubDate; we sort defensively in case the upstream order ever
 *  changes. */
export function topNews(articles: NewsArticle[], max: number): NewsArticle[] {
  return [...articles]
    .sort((a, b) => {
      const ta = new Date(a.pubDate).getTime();
      const tb = new Date(b.pubDate).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    })
    .slice(0, max);
}

// ── Radar ─────────────────────────────────────────────────────────

/** Cap radar items at N — the underlying API supports limit, this is
 *  defense in depth in case a callsite forgets. */
export function topRadar(items: RadarDevelopment[], max: number): RadarDevelopment[] {
  return items.slice(0, max);
}

// ── Hot Leads ──────────────────────────────────────────────────────

/** Build the unified Hot Leads list. "Assigned" means a client_profile
 *  whose `assigned_agent_id` is the caller (R3A semantic). "Claimed"
 *  means a new_leads row the caller claimed (R3B semantic). "Intake"
 *  is the caller's own client_intakes. All three are caller-relative
 *  and never carry another agent's user_id. */
export function buildHotLeads(input: {
  assignedClients: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    updated_at: string | null;
  }>;
  claimedLeads: Array<{
    id: string;
    name: string | null;
    email: string | null;
    source: string | null;
    created_at: string;
  }>;
  intakes: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    created_at: string;
  }>;
  maxPerKind: number;
}): HotLeadItem[] {
  const { assignedClients, claimedLeads, intakes, maxPerKind } = input;
  const ts = (s: string | null | undefined) =>
    s ? new Date(s).getTime() : 0;

  const assigned: HotLeadItem[] = [...assignedClients]
    .sort((a, b) => ts(b.updated_at) - ts(a.updated_at))
    .slice(0, maxPerKind)
    .map((c) => ({
      id: c.id,
      kind: "assigned",
      name: c.full_name,
      email: c.email,
      source: null,
      created_at: c.updated_at ?? "",
      open_url: `/clients/${c.id}`,
    }));

  const claimed: HotLeadItem[] = [...claimedLeads]
    .sort((a, b) => ts(b.created_at) - ts(a.created_at))
    .slice(0, maxPerKind)
    .map((l) => ({
      id: l.id,
      kind: "claimed",
      name: l.name,
      email: l.email,
      source: l.source,
      created_at: l.created_at,
      open_url: null,
    }));

  const intake: HotLeadItem[] = [...intakes]
    .sort((a, b) => ts(b.created_at) - ts(a.created_at))
    .slice(0, maxPerKind)
    .map((i) => ({
      id: i.id,
      kind: "intake",
      name: i.full_name,
      email: i.email,
      source: null,
      created_at: i.created_at,
      open_url: null,
    }));

  return [...assigned, ...claimed, ...intake];
}

// ── Display ─────────────────────────────────────────────────────────

export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatPrice(price: number | null | undefined): string | null {
  if (price == null) return null;
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${Math.round(price / 1_000)}K`;
  return `$${price.toLocaleString()}`;
}

export function leadKindLabel(k: HotLeadItem["kind"]): string {
  if (k === "assigned") return "Newly assigned";
  if (k === "claimed") return "You claimed";
  return "Recent intake";
}
