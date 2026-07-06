// ============================================================================
// TRANSACTION OS 3.2D — Deadline indicator · pure view helpers
// ============================================================================
// Maps the read-only `deadline_summary` block that Vault's /api/platform/workspace
// stamps on each card (TXN-OS.3.2C) into a small view-model for the "Deadline"
// section. PURE (no React, no fetch) so it is jest-testable without React infra —
// the component is a thin shell over these.
//
// The UI NEVER recalculates deadlines: every value comes straight from Vault's
// projection. This section is DISTINCT from the paperwork-readiness stage badge
// and from the "Transaction Stage" lifecycle indicator (3.1D).
//
// Surfaces only labels / dates / counts / priority. It NEVER surfaces the raw
// `next_deadline` KEY (an internal identifier) — only `next_deadline_label`. And
// Vault already withholds confidence / metadata / tenant / owner ids upstream.
//
// Priority colors are reused from lifecycle-view (priorityTone) so the Deadline
// priority is visually identical to the Transaction Stage priority.
// ============================================================================

import type { DeadlineSummary, LifecycleTone } from "./types";
import { priorityTone } from "./lifecycle-view";

/** The section label — distinct from "Transaction Stage" and the paperwork stage. */
export const DEADLINE_LABEL = "Deadline";

/** True when the card has a deadline block worth showing. Hides when null, and
 *  when there is genuinely nothing to surface (no next deadline AND every count
 *  is 0) — keeps the card uncluttered for deals with no tracked deadlines. */
export function hasDeadlineSummary(ds: DeadlineSummary | null | undefined): ds is DeadlineSummary {
  if (!ds) return false;
  const hasNext = typeof ds.next_deadline_label === "string" && ds.next_deadline_label.length > 0;
  const hasSignal =
    (ds.overdue_count ?? 0) > 0 ||
    (ds.at_risk_count ?? 0) > 0 ||
    (ds.breached_count ?? 0) > 0 ||
    (ds.blocker_count ?? 0) > 0;
  return hasNext || hasSignal;
}

/** "Due today" | "N days left" | "N days overdue" | null (when unknown). */
export function daysRemainingLabel(days: number | null | undefined): string | null {
  if (typeof days !== "number" || !Number.isFinite(days)) return null;
  if (days === 0) return "Due today";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} left`;
  const overdue = Math.abs(days);
  return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a due date as "Mon D" from a YYYY-MM-DD (or full-ISO) string. Parses
 *  the date parts directly (no Date/tz drift). null on missing/invalid input. */
export function dueDateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${MONTHS[mo - 1]} ${d}`;
}

export interface DeadlineChipVM {
  section_label: string;
  next_deadline_label: string | null;
  due_date_label: string | null;
  days_label: string | null;
  days_tone: LifecycleTone; // warn when due today / overdue, else muted
  priority: "critical" | "high" | "medium" | "low";
  priority_tone: LifecycleTone;
  overdue_count: number;
  at_risk_count: number;
}

export function deadlineChipVM(ds: DeadlineSummary): DeadlineChipVM {
  const days = typeof ds.days_remaining === "number" && Number.isFinite(ds.days_remaining) ? ds.days_remaining : null;
  const priority = (ds.priority ?? "low") as DeadlineChipVM["priority"];
  const nextLabel = ds.next_deadline_label && ds.next_deadline_label.length > 0 ? ds.next_deadline_label : null;
  return {
    section_label: DEADLINE_LABEL,
    next_deadline_label: nextLabel,
    due_date_label: dueDateLabel(ds.due_date),
    days_label: daysRemainingLabel(days),
    days_tone: days !== null && days <= 0 ? "warn" : "muted",
    priority,
    priority_tone: priorityTone(priority),
    overdue_count: ds.overdue_count ?? 0,
    at_risk_count: ds.at_risk_count ?? 0,
  };
}
