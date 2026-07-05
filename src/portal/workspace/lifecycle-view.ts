// ============================================================================
// TRANSACTION OS 3.1D — Lifecycle indicator · pure view helpers
// ============================================================================
// Maps the read-only `lifecycle` block that Vault's /api/platform/workspace now
// stamps on each card (TXN-OS.3.1C) into a small view-model for the "Transaction
// Stage" indicator. PURE (no React, no fetch) so it is jest-testable without any
// React test infra — the component is a thin shell over these.
//
// This lifecycle stage is DISTINCT from the existing paperwork-readiness `stage`
// (WorkspaceCard.stage) — it is the canonical DEAL lifecycle and is always
// labeled "Transaction Stage". The UI NEVER recalculates lifecycle: every value
// comes straight from the Vault projection.
//
// Carries only labels / counts / priorities — never an email, token, or payload.
// ============================================================================

import type { CardLifecycle, LifecycleTone } from "./types";

/** The section label — deliberately different from the paperwork-readiness stage. */
export const TRANSACTION_STAGE_LABEL = "Transaction Stage";

/** True when the card has a usable lifecycle projection (else the section hides). */
export function hasLifecycle(lc: CardLifecycle | null | undefined): lc is CardLifecycle {
  return !!lc && typeof lc.current_stage_label === "string" && lc.current_stage_label.length > 0;
}

export interface LifecycleChipVM {
  section_label: string;
  current_stage_label: string;
  next_stage_label: string | null;
  readiness_label: string; // e.g. "60% ready" (falls back to the tier label)
  readiness_tone: LifecycleTone;
  priority: "critical" | "high" | "medium" | "low";
  priority_tone: LifecycleTone;
  next_action_label: string | null;
  blocker_count: number;
}

const READINESS_TONE: Record<string, LifecycleTone> = {
  complete: "ok",
  ready_to_advance: "ok",
  in_progress: "info",
  blocked: "warn",
  not_started: "muted",
};

const READINESS_TIER_LABEL: Record<string, string> = {
  complete: "Complete",
  ready_to_advance: "Ready to advance",
  in_progress: "In progress",
  blocked: "Blocked",
  not_started: "Not started",
};

const PRIORITY_TONE: Record<string, LifecycleTone> = {
  critical: "warn",
  high: "warn",
  medium: "info",
  low: "muted",
};

export function priorityTone(priority: string): LifecycleTone {
  return PRIORITY_TONE[priority] ?? "muted";
}

export function readinessTone(tier: string): LifecycleTone {
  return READINESS_TONE[tier] ?? "muted";
}

/** Prefer the percent; fall back to the tier label when percent is absent. */
export function readinessLabel(lc: CardLifecycle): string {
  const r = lc.stage_readiness;
  if (r && typeof r.percent === "number") return `${r.percent}% ready`;
  const tier = r?.tier ?? "";
  return READINESS_TIER_LABEL[tier] ?? "—";
}

export function lifecycleChipVM(lc: CardLifecycle): LifecycleChipVM {
  const tier = lc.stage_readiness?.tier ?? "not_started";
  const priority = (lc.priority ?? "low") as LifecycleChipVM["priority"];
  const nextLabel = lc.next_action?.label ?? null;
  return {
    section_label: TRANSACTION_STAGE_LABEL,
    current_stage_label: lc.current_stage_label,
    next_stage_label: lc.next_stage_label ?? null,
    readiness_label: readinessLabel(lc),
    readiness_tone: readinessTone(tier),
    priority,
    priority_tone: priorityTone(priority),
    next_action_label: nextLabel && nextLabel.length > 0 ? nextLabel : null,
    blocker_count: Array.isArray(lc.blockers) ? lc.blockers.length : 0,
  };
}
