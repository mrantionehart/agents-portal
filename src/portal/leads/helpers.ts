// ============================================================================
// AGENT PORTAL 2.1 — R3B — Leads tab helpers
// ============================================================================
// Pure filter / search / sanitize / counts. No DB, no DOM, no fetch.
// ============================================================================

import type {
  IntakeListItem,
  IntakeRow,
  LeadClaimBucket,
  LeadListItem,
  LeadRow,
} from "./types";

/** R3B — leads-tab filter axis. */
export type LeadsFilter = "all" | "unclaimed" | "claimed_by_me" | "intakes";

const NOTES_PREVIEW_LIMIT = 140;

function previewNotes(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > NOTES_PREVIEW_LIMIT
    ? t.slice(0, NOTES_PREVIEW_LIMIT) + "…"
    : t;
}

function formatBudget(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

function formatAddress(
  address: string | null,
  city: string | null,
  state: string | null
): string | null {
  const parts = [address, city, state].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(", ");
}

/** Derive the caller-relative claim bucket for a lead row. Encodes
 *  only the relationship to the caller — never another agent's
 *  user_id. */
export function deriveClaimBucket(
  row: { claimed_by: string | null },
  callerId: string
): LeadClaimBucket {
  if (!row.claimed_by) return "unclaimed";
  return row.claimed_by === callerId ? "claimed_by_me" : "claimed_by_other";
}

/** Sanitize a raw new_leads row into the UI shape. */
export function sanitizeLead(row: LeadRow, callerId: string): LeadListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    status: row.status,
    notes_preview: previewNotes(row.notes),
    property: formatAddress(row.property_address, row.property_city, row.property_state),
    budget: formatBudget(row.budget_min, row.budget_max),
    claimBucket: deriveClaimBucket(row, callerId),
    claimed_by_name: row.claimed_by_name,
    created_at: row.created_at,
  };
}

/** Sanitize a raw client_intakes row into the UI shape. */
export function sanitizeIntake(row: IntakeRow, callerId: string): IntakeListItem {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    property_type: row.property_type,
    motivation: row.motivation,
    budget: row.budget_range,
    timeline: row.timeline,
    notes_preview: previewNotes(row.notes),
    status: row.status,
    isOwnIntake: row.agent_id === callerId,
    created_at: row.created_at,
  };
}

// ── Filter + search ─────────────────────────────────────────────────

export interface LeadFilters {
  filter: LeadsFilter;
  search: string;
}

function leadHaystack(l: LeadListItem): string {
  return [
    l.name ?? "",
    l.email ?? "",
    l.phone ?? "",
    l.property ?? "",
    l.notes_preview ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function intakeHaystack(i: IntakeListItem): string {
  return [
    i.name ?? "",
    i.email ?? "",
    i.phone ?? "",
    i.property_type ?? "",
    i.motivation ?? "",
    i.notes_preview ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Apply the leads-tab filter + search to the lead set. The intakes
 *  filter returns an empty lead array — intakes render in their own
 *  panel below the leads. */
export function applyLeadFilters(
  leads: LeadListItem[],
  filters: LeadFilters
): LeadListItem[] {
  if (filters.filter === "intakes") return [];
  const q = filters.search.trim().toLowerCase();
  return leads.filter((l) => {
    if (filters.filter === "unclaimed" && l.claimBucket !== "unclaimed") return false;
    if (filters.filter === "claimed_by_me" && l.claimBucket !== "claimed_by_me") return false;
    if (q && !leadHaystack(l).includes(q)) return false;
    return true;
  });
}

/** Apply search to intakes when the Intakes filter is active. When
 *  the filter is anything other than "intakes" or "all", returns
 *  empty (intakes only render under the Intakes or All filter). */
export function applyIntakeFilters(
  intakes: IntakeListItem[],
  filters: LeadFilters
): IntakeListItem[] {
  if (filters.filter === "unclaimed" || filters.filter === "claimed_by_me") {
    return [];
  }
  const q = filters.search.trim().toLowerCase();
  return intakes.filter((i) => {
    if (q && !intakeHaystack(i).includes(q)) return false;
    return true;
  });
}

// ── Counts ──────────────────────────────────────────────────────────

export interface LeadsCounts {
  totalLeads: number;
  unclaimed: number;
  claimedByMe: number;
  totalIntakes: number;
}

export function leadsCounts(
  leads: LeadListItem[],
  intakes: IntakeListItem[]
): LeadsCounts {
  let unclaimed = 0;
  let claimedByMe = 0;
  for (const l of leads) {
    if (l.claimBucket === "unclaimed") unclaimed += 1;
    else if (l.claimBucket === "claimed_by_me") claimedByMe += 1;
  }
  return {
    totalLeads: leads.length,
    unclaimed,
    claimedByMe,
    totalIntakes: intakes.length,
  };
}

// ── Display labels ──────────────────────────────────────────────────

export function leadStatusLabel(s: string | null): string {
  if (!s) return "—";
  const v = s.toLowerCase();
  if (v === "available" || v === "new") return "Available";
  if (v === "claimed") return "Claimed";
  if (v === "converted") return "Converted";
  if (v === "archived") return "Archived";
  return s;
}

export function intakeStatusLabel(s: string | null): string {
  if (!s) return "—";
  const v = s.toLowerCase();
  if (v === "new") return "New";
  if (v === "contacted") return "Contacted";
  if (v === "converted") return "Converted";
  if (v === "archived") return "Archived";
  return s;
}

export function claimBucketLabel(b: LeadClaimBucket): string {
  if (b === "claimed_by_me") return "Claimed by you";
  if (b === "unclaimed") return "Unclaimed";
  return "Claimed";
}

export function relativeCreated(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
