// ============================================================================
// TRANSACTION OS 3.3C — Package Review pure view helpers
// ============================================================================
// View-model helpers for the Package Review UI. Pure functions only — status
// labels/tones, client-side selection recompute (the blueprint AS DISPLAYED),
// and searchable filtering. NO rule/lifecycle/deadline calc — Package Review is
// a renderer and never rebuilds the package.
// ============================================================================

import type {
  FormStatusMap,
  PackageForm,
  PackageGates,
  SearchableForm,
} from "./types";

export type StatusTone = "ok" | "info" | "warn" | "danger" | "muted";

/** Human status label for a form_id — "Not added" when no instance exists. */
export function formStatusLabel(formId: string, status: FormStatusMap): string {
  return status[formId]?.status_label ?? "Not added";
}

/** Terminal / complete statuses — a form here needs no field completion. */
const COMPLETE_FORM_STATUSES: ReadonlySet<string> = new Set([
  "ready",
  "signed",
  "sent",
  "voided",
]);

/** True when a required form still needs agent-fillable fields before it can
 *  be prepared — drives the "Complete required fields" CTA. A form with no
 *  instance yet ("Not added") also needs completion. */
export function formNeedsCompletion(formId: string, status: FormStatusMap): boolean {
  const s = status[formId]?.status;
  if (!s) return true;
  return !COMPLETE_FORM_STATUSES.has(s);
}

/** Badge tone for a form's live status (falls back to muted). */
export function formStatusTone(formId: string, status: FormStatusMap): StatusTone {
  const s = status[formId]?.status;
  switch (s) {
    case "ready":
      return "ok";
    case "signed":
      return "ok";
    case "sent":
      return "info";
    case "blocked":
      return "danger";
    case "in_progress":
    case "required":
      return "warn";
    default:
      return "muted"; // recommended / voided / not-added
  }
}

/** The blueprint AS CURRENTLY SELECTED (client-side; matches the pure engine:
 *  required ∪ selected optional ∪ selected riders). */
export interface DisplayBlueprint {
  required: string[];
  optional_selected: string[];
  rider_selected: string[];
  all_selected: string[];
  total_in_package: number;
}

export function computeDisplayBlueprint(
  required: ReadonlyArray<PackageForm>,
  optionalSelected: ReadonlySet<string>,
  riderSelected: ReadonlySet<string>
): DisplayBlueprint {
  const req = required.map((f) => f.form_id).sort();
  const opt = [...optionalSelected].sort();
  const rid = [...riderSelected].sort();
  const all = Array.from(new Set([...req, ...opt, ...rid])).sort();
  return {
    required: req,
    optional_selected: opt,
    rider_selected: rid,
    all_selected: all,
    total_in_package: all.length,
  };
}

/** Filter the searchable pool by a case-insensitive query over id/label/category. */
export function filterSearchable(
  searchable: ReadonlyArray<SearchableForm>,
  query: string
): SearchableForm[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...searchable];
  return searchable.filter(
    (f) =>
      f.form_id.toLowerCase().includes(q) ||
      f.label.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
  );
}

/** View-model for the package-gates strip. */
export interface GatesView {
  can_prepare_package: boolean;
  can_send_for_signature: boolean;
  prepare_label: string;
  recommended_actions: string[];
  ready_count: number;
  blocked_count: number;
  plan_available: boolean;
}

export function gatesView(gates: PackageGates): GatesView {
  return {
    can_prepare_package: gates.can_prepare_package,
    can_send_for_signature: gates.can_send_for_signature,
    prepare_label: gates.can_prepare_package
      ? "Ready to prepare package"
      : "Not ready to prepare",
    recommended_actions: gates.recommended_actions ?? [],
    ready_count: gates.ready_forms?.length ?? 0,
    blocked_count: gates.blocked_forms?.length ?? 0,
    plan_available: gates.plan_available,
  };
}

/** Turn a recommended_action key into a human phrase. */
export function actionLabel(action: string): string {
  switch (action) {
    case "continue_collection":
      return "Continue collecting required information";
    case "prepare_for_broker_review":
      return "Prepare the package for broker review";
    case "ready_for_signature_preparation":
      return "Prepare the package for signature";
    default:
      return action.replace(/_/g, " ");
  }
}
