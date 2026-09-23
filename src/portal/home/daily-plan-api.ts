// ============================================================================
// EASE-2.0-PLAN-SURFACE-AP-1 — Daily Game Plan fetcher (server-only)
// ============================================================================
// Presentation-only, like the rest of the Portal. Vault owns the data, the
// predicates and the ranking; this file asks and shapes. No bucketing, no
// scoring, no re-sorting — the order Vault returns is the order we render, or
// the ranking would exist in two places and drift.
//
// The request carries NO identity. Vault derives tenant and user from the
// Bearer token and refuses every query parameter, so there is nothing this
// file could send that would widen its own scope even if it tried.
// ============================================================================

import "server-only";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

/** Signals the Portal can currently act on. STR matches have no AP destination yet. */
export const SUPPORTED_SIGNALS = ["meeting_soon", "task_overdue"] as const;
export type SupportedSignal = (typeof SUPPORTED_SIGNALS)[number];

export const MAX_PLAN_ITEMS = 5;

/** The subset of Vault's PlanCandidate the Portal renders. */
export interface PlanItem {
  readonly signal: SupportedSignal;
  readonly subjectKind: "meeting" | "task";
  readonly subjectId: string;
  readonly label: string;
  /** The action-relevant instant, ISO. Humanized at render, never shown raw. */
  readonly at: string;
  readonly actionLabel: string;
}

export interface DailyPlanResult {
  readonly items: PlanItem[];
  readonly error: string | null;
}

export const EMPTY_PLAN: DailyPlanResult = { items: [], error: null };

function isSupported(signal: unknown): signal is SupportedSignal {
  return typeof signal === "string" && (SUPPORTED_SIGNALS as readonly string[]).includes(signal);
}

/**
 * Keep only what the Portal can act on, preserving Vault's order.
 *
 * Exported for test: the filter is the one place a signal Vault adds later
 * could silently appear in the UI without a destination, so it is pinned.
 */
export function toPlanItems(candidates: unknown): PlanItem[] {
  if (!Array.isArray(candidates)) return [];
  const out: PlanItem[] = [];
  for (const raw of candidates) {
    const c = raw as Record<string, unknown>;
    if (!isSupported(c?.signal_type)) continue;

    const subject = c.subject_ref as Record<string, unknown> | undefined;
    const action = c.action as Record<string, unknown> | undefined;
    const kind = subject?.kind;
    const id = subject?.id;
    if ((kind !== "meeting" && kind !== "task") || typeof id !== "string" || id === "") continue;
    if (typeof c.occurred_at !== "string") continue;

    out.push({
      signal: c.signal_type,
      subjectKind: kind,
      subjectId: id,
      label: typeof subject?.label === "string" && subject.label !== "" ? subject.label : "Untitled",
      at: c.occurred_at,
      actionLabel: typeof action?.label === "string" && action.label !== "" ? action.label : "Open",
    });
    if (out.length >= MAX_PLAN_ITEMS) break;
  }
  return out;
}

/**
 * Fetch the caller's plan from Vault.
 *
 * Never throws: a failure here degrades to an empty plan plus an error string,
 * matching how every other Home stream behaves. One upstream blip must not
 * blank the dashboard.
 */
export async function loadDailyPlan(accessToken: string): Promise<DailyPlanResult> {
  try {
    const res = await fetch(`${VAULT_API_URL}/ease/daily-plan`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };
    const body = await res.json();
    return { items: toPlanItems(body?.candidates), error: null };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : "request failed" };
  }
}
