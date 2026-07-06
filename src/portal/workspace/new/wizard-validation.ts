// ============================================================================
// TRANSACTION OS 3.3B.3A — Wizard per-step validation gate
// ============================================================================
// The gate mechanism only. Next validates the CURRENT step; Back never
// validates. In 3.3B.3A every validator is permissive (steps render
// placeholders — no field inputs exist yet). The real per-step field rules
// land in 3.3B.3B alongside the step components, by replacing these entries.
//
// The registry is injectable (WizardShell accepts a `validators` prop) so the
// gate wiring — "Next validates, Back bypasses" — is testable now without any
// step UI.
// ============================================================================

import type { StepId } from "./wizard-steps";
import type { WizardSession } from "./wizard-session";

export interface StepValidation {
  valid: boolean;
  errors: string[];
}

export type StepValidator = (session: WizardSession) => StepValidation;

export const VALID: StepValidation = { valid: true, errors: [] };

/** 3.3B.3A: permissive placeholders. 3.3B.3B replaces these with real
 *  field-level rules per step. */
export const stepValidators: Record<StepId, StepValidator> = {
  type: () => VALID,
  property: () => VALID,
  parties: () => VALID,
  dates: () => VALID,
  review: () => VALID,
  create: () => VALID,
  package: () => VALID,
};

/** Validate one step. Unknown steps are treated as valid (fail-open for the
 *  gate; real gating comes from the concrete validators in 3.3B.3B). */
export function validateStep(
  step: StepId,
  session: WizardSession,
  validators: Record<StepId, StepValidator> = stepValidators
): StepValidation {
  const fn = validators[step];
  return fn ? fn(session) : VALID;
}
