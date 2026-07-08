// ============================================================================
// TRANSACTION OS 3.4D — Transaction Coordinator strip · pure view helpers
// ============================================================================
// Maps the `TransactionDirective` + `CollectionReport` that Vault's 3.4C
// endpoint returns (GET /api/platform/transactions/[id]/coordinator) into a
// small view-model for the "Transaction Coordinator" strip. PURE (no React, no
// fetch) so it is jest-testable without any React infra — the component is a
// thin shell over these.
//
// PRESENTATION ONLY. This module NEVER recommends, ranks, or re-derives — every
// value is consumed verbatim from the directive. It carries only labels /
// counts / tones / a navigation href — never a token, email, amount, statutory
// key, or a raw collection error message. The degraded notice is derived from
// COUNTS only; collection.errors[].message never enters the view-model.
// ============================================================================

import type { LifecycleTone } from "./types";
import { priorityTone } from "./lifecycle-view";
import { tabHref, type TabId } from "./tabs/tab-config";

export const COORDINATOR_LABEL = "Transaction Coordinator";

// The number of canonical intelligence sources the coordinator draws on (3.4A
// CANONICAL_INPUTS). Used only to render "N of 12 signals" — never to compute.
export const TOTAL_COORDINATOR_SOURCES = 12;

// ── mirrored (leak-safe) subset of the Vault 3.4C response ──────────────────
// Local mirrors, exactly as 3.1D/3.2D mirror Vault projections. We deliberately
// keep the string fields loose so an added enum value never breaks the render.

export type CoordinatorPriority = "critical" | "high" | "medium" | "low";

export interface CoordinatorNextAction {
  key: string;
  label: string;
  owner: string;
  cta_label: string;
  tab: string;
  is_blocked: boolean;
}

export interface CoordinatorReadiness {
  tier: string | null;
  score: number | null;
  can_prepare_package: boolean;
  can_send_for_signature: boolean;
}

export interface CoordinatorBlocker {
  category: string;
  owner: string;
  severity: CoordinatorPriority;
  reason: string;
  resolution: string;
  count?: number;
}

export interface CoordinatorRisk {
  category: string;
  severity: CoordinatorPriority;
  reason: string;
}

export interface CoordinatorConfidence {
  level: "high" | "medium" | "low";
  score: number;
  reasons: string[];
}

export interface TransactionDirective {
  transaction_id: string;
  workflow_state: string;
  next_action: CoordinatorNextAction;
  priority: CoordinatorPriority;
  readiness: CoordinatorReadiness;
  blockers: CoordinatorBlocker[];
  risks: CoordinatorRisk[];
  recommended_tab: string;
  recommended_cta: string;
  confidence: CoordinatorConfidence;
  meta?: {
    inputs_present?: string[];
    source_keys?: string[];
    coordinator_version?: string;
  };
}

export interface CollectionReport {
  inputs_present: string[];
  inputs_missing: string[];
  errors: Array<{ source: string; message?: string }>;
  loaded_at_ms?: number;
  collector_version?: string;
}

export interface CoordinatorResponse {
  directive: TransactionDirective;
  collection: CollectionReport;
}

// ── labels / tones ──────────────────────────────────────────────────────────

const WORKFLOW_STATE_LABEL: Record<string, string> = {
  closed: "Closed",
  blocked: "Blocked",
  collecting_information: "Collecting information",
  awaiting_party_attestation: "Awaiting party attestation",
  ready_to_generate: "Ready to generate",
  ready_to_send: "Ready to send",
  awaiting_signature: "Awaiting signature",
  submit_for_broker_review: "Submit for broker review",
  awaiting_broker: "Awaiting broker",
  awaiting_third_party: "Awaiting third party",
  ready_to_close: "Ready to close",
  all_caught_up: "All caught up",
};

function humanize(s: string): string {
  const t = (s ?? "").replace(/_/g, " ").trim();
  return t.length ? t.charAt(0).toUpperCase() + t.slice(1) : "—";
}

export function workflowStateLabel(state: string): string {
  return WORKFLOW_STATE_LABEL[state] ?? humanize(state);
}

const CONFIDENCE_TONE: Record<string, LifecycleTone> = {
  high: "ok",
  medium: "info",
  low: "warn",
};

export function confidenceTone(level: string): LifecycleTone {
  return CONFIDENCE_TONE[level] ?? "muted";
}

/** Confidence as a subtle "82% · high" style string. */
export function confidenceLabel(c: CoordinatorConfidence): string {
  const pct = Math.round((Number.isFinite(c.score) ? c.score : 0) * 100);
  return `${pct}% · ${c.level}`;
}

/** Readiness as "In progress · 60%" — prefers the tier, appends percent. */
export function readinessLabel(r: CoordinatorReadiness): string {
  const tier = r.tier ? humanize(r.tier) : null;
  const pct = typeof r.score === "number" && Number.isFinite(r.score) ? `${Math.round(r.score * 100)}%` : null;
  if (tier && pct) return `${tier} · ${pct}`;
  return tier ?? pct ?? "—";
}

// ── recommended-tab → in-portal navigation ──────────────────────────────────
// WorkspaceTab (overview|package|documents|compliance|commission|timeline) is a
// subset of TabId. Any unexpected value falls back to overview (never throws).

const COORDINATOR_TAB_SET: ReadonlySet<string> = new Set([
  "overview",
  "package",
  "documents",
  "compliance",
  "commission",
  "timeline",
]);

export function mapCoordinatorTab(tab: string): TabId {
  return (COORDINATOR_TAB_SET.has(tab) ? tab : "overview") as TabId;
}

/** The CTA target — an in-portal /workspace/[id]?tab=… href. Navigation only. */
export function ctaHref(transactionId: string, tab: string): string {
  return tabHref(transactionId, mapCoordinatorTab(tab));
}

// ── degraded state (COUNT-derived; no raw messages) ─────────────────────────
// Degraded ⇢ the directive was synthesized under a genuine shortfall: low
// confidence OR a recorded collector error. inputs_missing alone is NOT a
// trigger — several sources are legitimately null on a healthy young deal, so
// gating on it would flag nearly everything. It is surfaced only as the
// "N of 12 signals" count.

export function isDegraded(res: CoordinatorResponse): boolean {
  const lowConfidence = res.directive.confidence.level === "low";
  const hadErrors = (res.collection?.errors?.length ?? 0) > 0;
  return lowConfidence || hadErrors;
}

/** A subtle, generic degraded notice — counts only, never a raw error message. */
export function degradedNotice(res: CoordinatorResponse): string | null {
  if (!isDegraded(res)) return null;
  const present = res.collection?.inputs_present?.length ?? 0;
  return `Limited data — ${present} of ${TOTAL_COORDINATOR_SOURCES} signals available.`;
}

// ── the panel view-model ─────────────────────────────────────────────────────

export interface CoordinatorCtaVM {
  label: string;
  href: string;
  tab: TabId;
  is_blocked: boolean;
}

export interface CoordinatorBlockerVM {
  reason: string;
  resolution: string;
  tone: LifecycleTone;
  count: number | null;
}

export interface CoordinatorRiskVM {
  reason: string;
  tone: LifecycleTone;
}

export interface CoordinatorPanelVM {
  section_label: string;
  primary_directive: string;
  workflow_state_label: string;
  priority: CoordinatorPriority;
  priority_tone: LifecycleTone;
  readiness_label: string;
  can_prepare_package: boolean;
  can_send_for_signature: boolean;
  confidence_label: string;
  confidence_tone: LifecycleTone;
  cta: CoordinatorCtaVM;
  recommended_tab: TabId;
  blockers: CoordinatorBlockerVM[];
  risks: CoordinatorRiskVM[];
  has_blockers_section: boolean;
  degraded: boolean;
  degraded_notice: string | null;
}

const MAX_BLOCKERS = 3;
const MAX_RISKS = 2;

export function coordinatorPanelVM(
  res: CoordinatorResponse,
  transactionId: string
): CoordinatorPanelVM {
  const d = res.directive;
  const recommendedTab = d.recommended_tab || d.next_action.tab;

  const blockers: CoordinatorBlockerVM[] = (d.blockers ?? []).slice(0, MAX_BLOCKERS).map((b) => ({
    reason: b.reason,
    resolution: b.resolution,
    tone: priorityTone(b.severity),
    count: typeof b.count === "number" ? b.count : null,
  }));

  const risks: CoordinatorRiskVM[] = (d.risks ?? []).slice(0, MAX_RISKS).map((r) => ({
    reason: r.reason,
    tone: priorityTone(r.severity),
  }));

  return {
    section_label: COORDINATOR_LABEL,
    primary_directive: d.next_action.label,
    workflow_state_label: workflowStateLabel(d.workflow_state),
    priority: d.priority,
    priority_tone: priorityTone(d.priority),
    readiness_label: readinessLabel(d.readiness),
    can_prepare_package: !!d.readiness.can_prepare_package,
    can_send_for_signature: !!d.readiness.can_send_for_signature,
    confidence_label: confidenceLabel(d.confidence),
    confidence_tone: confidenceTone(d.confidence.level),
    cta: {
      label: d.recommended_cta || d.next_action.cta_label,
      href: ctaHref(transactionId, recommendedTab),
      tab: mapCoordinatorTab(recommendedTab),
      is_blocked: !!d.next_action.is_blocked,
    },
    recommended_tab: mapCoordinatorTab(recommendedTab),
    blockers,
    risks,
    has_blockers_section: blockers.length > 0 || risks.length > 0,
    degraded: isDegraded(res),
    degraded_notice: degradedNotice(res),
  };
}
