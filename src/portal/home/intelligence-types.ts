// ============================================================================
// AGENT PORTAL 2.1 — R6 — Home Intelligence types
// ============================================================================
// Shared shapes for the six new Home widgets. No new tables, no new
// backend — every shape mirrors something the existing Vault /
// agents-portal endpoints already emit.
// ============================================================================

// ── Market News (Vault /api/news via agents-portal proxy) ───────────

export interface NewsArticle {
  /** Headline. */
  title: string;
  /** Outbound article URL. */
  link: string;
  /** Short summary from the source. */
  description: string;
  /** Publication date in any string format the source supplies. */
  pubDate: string;
  /** Publisher name. */
  source: string;
}

// ── Development Radar (Vault /api/development-radar) ────────────────

export interface RadarDevelopment {
  id: string;
  project_name: string;
  city: string | null;
  county: string | null;
  status: string | null;
  units: number | null;
  asset_type: string | null;
  developer: string | null;
}

// ── Opportunities ───────────────────────────────────────────────────
// The legacy Opportunities page has no real backend yet — it
// hardcodes an empty list. R6 mirrors that: the widget renders a
// graceful empty state until a real feed exists.

export interface OpportunityItem {
  id: string;
  title: string;
  city: string | null;
  type: string | null;
  asking_price: number | null;
}

// ── Hot Leads (R3B sources) ─────────────────────────────────────────

export interface HotLeadItem {
  id: string;
  /** "assigned" | "claimed" | "intake" — encodes WHY this lead is
   *  "hot" today; never a foreign user_id. */
  kind: "assigned" | "claimed" | "intake";
  name: string | null;
  email: string | null;
  source: string | null;
  created_at: string;
  /** Vault deep-link for context (transactions page) or null for
   *  intakes that don't have a transaction yet. */
  open_url: string | null;
}

// ── Production + Pipeline (derived from existing WorkspaceCard[]) ───

export interface ProductionSnapshot {
  active: number;
  ready_for_review: number;
  ready_for_signature: number;
  blocked: number;
  signed: number;
}

export interface PipelineSnapshot {
  drafting: number;
  collecting: number;
  broker_review: number;
  signature: number;
  completed: number;
}

// ── Result envelope ─────────────────────────────────────────────────

export interface HomeIntelligence {
  news: NewsArticle[];
  radar: RadarDevelopment[];
  opportunities: OpportunityItem[];
  hotLeads: HotLeadItem[];
  /** Per-source error strings (best-effort surfacing). */
  errors: {
    news: string | null;
    radar: string | null;
    leads: string | null;
  };
}
