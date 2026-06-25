// ============================================================================
// AGENT PORTAL 2.1 — R3B — Leads + Intakes types
// ============================================================================
// Sanitized read-only mirrors of `new_leads` + `client_intakes` shapes.
// Optional fields stay optional so a future column addition doesn't
// break the type.
// ============================================================================

/** A single row from new_leads (SEC.3A-scoped). The full row carries a
 *  larger surface; this shape captures what the Leads tab actually
 *  renders. */
export interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  budget_min: number | null;
  budget_max: number | null;
  /** Set when an agent has claimed this lead. UI never renders this
   *  value directly — only the boolean "is it me?" derived field. */
  claimed_by: string | null;
  claimed_by_name: string | null;
  claimed_at: string | null;
  created_at: string;
  /** Set by the agent who posted the lead. Hidden from UI; carried
   *  here only for SEC.3A scope checks at the loader. */
  posted_by: string | null;
}

/** A single row from client_intakes (SEC.3A-scoped via agent_id). */
export interface IntakeRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  property_type: string | null;
  motivation: string | null;
  budget_range: string | null;
  timeline: string | null;
  notes: string | null;
  status: string | null;
  agent_id: string | null;
  created_at: string;
}

/** Caller-relative claim status. Same design as R3A's
 *  AssignmentBucket — encodes only the relationship to the caller. */
export type LeadClaimBucket = "claimed_by_me" | "claimed_by_other" | "unclaimed";

/** UI-shaped lead row (loader sanitizes new_leads → this). */
export interface LeadListItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  /** Anonymized notes preview, no PII beyond name. Trimmed to a short
   *  preview length. */
  notes_preview: string | null;
  property: string | null;       // formatted address
  budget: string | null;         // formatted "$Xk – $Yk"
  claimBucket: LeadClaimBucket;
  /** Name of the claimer when claimBucket === "claimed_by_other" or
   *  "claimed_by_me". Never a user_id. */
  claimed_by_name: string | null;
  created_at: string;
}

/** UI-shaped intake row. */
export interface IntakeListItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_type: string | null;
  motivation: string | null;
  budget: string | null;
  timeline: string | null;
  notes_preview: string | null;
  status: string | null;
  /** True when the caller is the intake's owning agent. */
  isOwnIntake: boolean;
  created_at: string;
}

/** Result envelope for the leads + intakes loader. */
export type LeadsResult =
  | { kind: "ok"; leads: LeadListItem[]; intakes: IntakeListItem[] }
  | { kind: "error"; message: string };
