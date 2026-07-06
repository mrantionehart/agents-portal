// ============================================================================
// TRANSACTION OS 3.3B.3A — Transaction Wizard step config
// ============================================================================
// Single declarative list of the wizard's journey nodes. Step IDs are stable
// strings used in the `?step=` URL param — mirrors the workspace tab-config
// pattern (parseTab / tabHref). Pure presentation contract: no business logic,
// no API, no field validation (that lands in 3.3B.3B step components).
//
// The journey has 7 display nodes. The first six are NAVIGABLE current-steps
// (the agent can be "on" them); `package` is a terminal hand-off node (3.3C
// Package Review) shown in the stepper but never a wizard current-step.
// ============================================================================

export type StepId =
  | "type" // Transaction Type
  | "property" // Property
  | "parties" // Clients & Parties
  | "dates" // Important Dates
  | "review" // Review
  | "create" // Create
  | "package"; // Package Review (terminal hand-off — 3.3C)

export interface StepSpec {
  id: StepId;
  label: string;
  /** Navigable current-steps the agent can land on. `package` is terminal. */
  navigable: boolean;
}

/** Fixed journey order. Do NOT reorder — the `?step=` param and the stepper
 *  both depend on this sequence. */
export const WIZARD_STEPS: ReadonlyArray<StepSpec> = [
  { id: "type", label: "Transaction Type", navigable: true },
  { id: "property", label: "Property", navigable: true },
  { id: "parties", label: "Clients & Parties", navigable: true },
  { id: "dates", label: "Important Dates", navigable: true },
  { id: "review", label: "Review", navigable: true },
  { id: "create", label: "Create", navigable: true },
  { id: "package", label: "Package Review", navigable: false },
] as const;

export const DEFAULT_STEP: StepId = "type";

/** Navigable current-steps only (excludes the terminal `package` node). */
export const NAVIGABLE_STEPS: ReadonlyArray<StepId> = WIZARD_STEPS.filter(
  (s) => s.navigable
).map((s) => s.id);

const NAVIGABLE_SET: Set<string> = new Set(NAVIGABLE_STEPS);

/** True when `raw` names a navigable current-step. `package` and unknown values
 *  are NOT valid current-steps. */
export function isValidStep(raw: string | null | undefined): raw is StepId {
  return !!raw && NAVIGABLE_SET.has(raw);
}

/** Resolve a raw `?step=` value into a valid current-step. Unknown / null /
 *  terminal values fall back to the first step. Mirrors parseTab. */
export function parseStep(raw: string | null | undefined): StepId {
  return isValidStep(raw) ? raw : DEFAULT_STEP;
}

/** Zero-based index of a navigable step within the journey (excludes package).
 *  Returns -1 for the terminal node or unknown values. */
export function stepIndex(step: StepId): number {
  return NAVIGABLE_STEPS.indexOf(step);
}

/** Next navigable current-step, or null at the last navigable step. */
export function nextStep(step: StepId): StepId | null {
  const i = stepIndex(step);
  if (i < 0 || i >= NAVIGABLE_STEPS.length - 1) return null;
  return NAVIGABLE_STEPS[i + 1];
}

/** Previous navigable current-step, or null at the first step. */
export function prevStep(step: StepId): StepId | null {
  const i = stepIndex(step);
  if (i <= 0) return null;
  return NAVIGABLE_STEPS[i - 1];
}

/** Build a `/workspace/new?step=…` URL. The first step omits the param
 *  (mirrors tabHref's default-omits-param convention). */
export function stepHref(step: StepId): string {
  if (step === DEFAULT_STEP) return "/workspace/new";
  return `/workspace/new?step=${step}`;
}

/** Human "Step X of Y" label (navigable steps only). */
export function stepPositionLabel(step: StepId): string {
  const i = stepIndex(step);
  if (i < 0) return "";
  return `Step ${i + 1} of ${NAVIGABLE_STEPS.length}`;
}
