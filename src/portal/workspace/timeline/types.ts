// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.3.1 — Timeline tab types
// ============================================================================
// All shapes are presentation-only. Agent Portal owns every string the
// composer writes — Vault's `notes`, `old_value`, `new_value`, and raw
// per-event labels are NEVER rendered. Broker-only data is filtered at
// the api.ts boundary (broker fetcher never runs for agent role).
// ============================================================================

export type TimelineTone = "ok" | "info" | "warn" | "muted";

export type TimelineKind =
  | "audit"
  | "review"
  | "envelope"
  | "compliance"
  | "milestone"
  | "task"
  | "commission";

export interface TimelineCard {
  /** Stable key for React + tests. */
  id: string;
  /** ISO 8601. Composer groups by day in the caller's timezone (server). */
  occurred_at: string;
  kind: TimelineKind;
  tone: TimelineTone;
  /** Lucide icon name (resolved in TimelineTab). */
  iconName:
    | "file-text"
    | "pencil"
    | "user-circle-2"
    | "mail"
    | "shield"
    | "check-circle-2"
    | "alert-triangle"
    | "alert-circle"
    | "hourglass"
    | "clock"
    | "milestone"
    | "list-checks";
  /** Agent-Portal-owned label. NEVER raw Vault text. */
  label: string;
  /** Optional short safe detail line (e.g. form code, severity). */
  detail?: string;
  /** Actor display. May be `null` for system events. */
  actor?: string | null;
  /** Audit log source for filter chips (broker only). */
  source?: string;
  /** Deep-link to Documents drawer when form-scoped, else paperwork package. */
  drillHref?: string;
}

export interface TimelineDayGroup {
  /** Day label: "Today", "Yesterday", "Mon, Jun 23". */
  label: string;
  /** YYYY-MM-DD for ordering. */
  dateKey: string;
  cards: TimelineCard[];
}

/** Whether the timeline is a full-depth broker view or the degraded agent
 *  view composed from snapshot signals. */
export type TimelineRoleClass = "broker" | "agent";

export interface TimelineTabState {
  callerRoleClass: TimelineRoleClass;
  /** Degraded = agent view from snapshot signals only (no audit log). */
  isDegraded: boolean;
  groups: TimelineDayGroup[];
  /** True if the Vault `/history` fetch failed for a broker. Agent never
   *  triggers this. */
  historyFetchError: string | null;
  paperworkPackageUrl: string;
  /** Filter chip ids the UI can render. Empty for agent (degraded). */
  filterChips: ReadonlyArray<{ key: string; label: string }>;
  /** Total card count across groups (for the header pill). */
  totalCount: number;
}

// ── Vault response shape — used only inside the broker fetcher ──────

/** Loose mirror of vault/src/app/api/paperwork/transactions/[id]/history
 *  response items. Treated as untrusted input by `safe-history-event.ts`. */
export interface RawHistoryEvent {
  kind?: "audit" | "review";
  id?: string;
  created_at?: string;
  actor_id?: string;
  // audit-shape
  field_path?: string;
  old_value?: string | null;
  new_value?: string | null;
  source?: string;
  form_instance_id?: string | null;
  // review-shape
  action?: string;
  notes?: string | null;
  status_before?: string | null;
  status_after?: string | null;
}
