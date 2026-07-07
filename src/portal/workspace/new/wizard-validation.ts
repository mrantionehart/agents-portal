// ============================================================================
// TRANSACTION OS 3.3B.3C — Wizard validation (structured, pure)
// ============================================================================
// Real per-step validation. Pure functions only — they read a WizardSession
// and answer "can the user proceed?" with a STRUCTURED error object (field-level
// errors) plus a flattened message list for the banner. NO API, NO server
// validation, NO transaction creation.
//
// Rules (per the 3.3B.3C contract):
//   type     — transaction_type required
//   property — address required (city/state/zip/year/HOA optional)
//   parties  — required role(s) by type (or ≥1 party for commercial/wholesale/
//              referral); each party needs a role + (name OR company); email
//              must be valid IF present
//   dates    — optional; closing ≥ contract and lease_end ≥ lease_start only
//              when both dates in a pair are present
//   review   — always valid
// ============================================================================

import type { StepId } from "./wizard-steps";
import type { WizardSession } from "./wizard-session";
import {
  requiredPartyRules,
  requiresAtLeastOneParty,
} from "./party-requirements";

// ── Structured error model ───────────────────────────────────────────────────

export interface PartyRowErrors {
  role?: string;
  name?: string;
  email?: string;
}

export interface WizardFieldErrors {
  transaction_type?: string;
  property?: { address?: string };
  parties?: { form?: string; rows?: PartyRowErrors[] };
  dates?: {
    contract_date?: string;
    closing_date?: string;
    lease_start?: string;
    lease_end?: string;
  };
}

export interface StepValidation {
  valid: boolean;
  fieldErrors: WizardFieldErrors;
  messages: string[];
}

export type StepValidator = (session: WizardSession) => StepValidation;

const OK: StepValidation = { valid: true, fieldErrors: {}, messages: [] };

// ── Small pure helpers ───────────────────────────────────────────────────────

/** Minimal, dependency-free email check (no portal helper exists). */
export function isValidEmail(raw: string): boolean {
  const v = raw.trim();
  if (!v) return false;
  // one @, non-empty local part, a dot in the domain, no spaces
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function trimmed(v: string | null | undefined): string {
  return (v ?? "").trim();
}

// ── Per-step validators ──────────────────────────────────────────────────────

function validateType(session: WizardSession): StepValidation {
  if (!session.transaction_type) {
    return {
      valid: false,
      fieldErrors: { transaction_type: "Select a transaction type." },
      messages: ["Select a transaction type."],
    };
  }
  return OK;
}

function validateProperty(session: WizardSession): StepValidation {
  if (!trimmed(session.property.address)) {
    return {
      valid: false,
      fieldErrors: { property: { address: "Property address is required." } },
      messages: ["Property address is required."],
    };
  }
  return OK;
}

function validateParties(session: WizardSession): StepValidation {
  const parties = session.parties ?? [];
  const type = session.transaction_type;
  const messages: string[] = [];
  const rows: PartyRowErrors[] = parties.map(() => ({}));
  let formError: string | undefined;

  // Per-party field rules.
  parties.forEach((p, i) => {
    if (!trimmed(p.role)) {
      rows[i].role = "Role is required.";
    }
    if (!trimmed(p.name) && !trimmed(p.company)) {
      rows[i].name = "Name or company is required.";
    }
    const email = trimmed(p.email);
    if (email && !isValidEmail(email)) {
      rows[i].email = "Enter a valid email.";
    }
  });

  // Required-party-by-type rules.
  const required = requiredPartyRules(type);
  const missingRoles = required.filter(
    (rule) => !parties.some((p) => p.role === rule.role)
  );
  if (missingRoles.length > 0) {
    formError = `Add a ${missingRoles.map((r) => r.label).join(" and ")}.`;
  } else if (requiresAtLeastOneParty(type) && parties.length === 0) {
    formError = "Add at least one party.";
  }

  const hasRowErrors = rows.some(
    (r) => r.role || r.name || r.email
  );
  const valid = !formError && !hasRowErrors;
  if (valid) return OK;

  if (formError) messages.push(formError);
  if (hasRowErrors) messages.push("Fix the highlighted party details.");

  return {
    valid: false,
    fieldErrors: { parties: { form: formError, rows } },
    messages,
  };
}

function validateDates(session: WizardSession): StepValidation {
  const { contract_date, closing_date, lease_start, lease_end } = session.dates;
  const dateErrors: NonNullable<WizardFieldErrors["dates"]> = {};
  const messages: string[] = [];

  if (contract_date && closing_date && closing_date < contract_date) {
    dateErrors.closing_date = "Closing date must be on or after the contract date.";
    messages.push(dateErrors.closing_date);
  }
  if (lease_start && lease_end && lease_end < lease_start) {
    dateErrors.lease_end = "Lease end must be on or after the lease start.";
    messages.push(dateErrors.lease_end);
  }

  if (messages.length === 0) return OK;
  return { valid: false, fieldErrors: { dates: dateErrors }, messages };
}

/** Real per-step validators. Steps without data rules are always valid. */
export const stepValidators: Record<StepId, StepValidator> = {
  type: validateType,
  property: validateProperty,
  parties: validateParties,
  dates: validateDates,
  review: () => OK,
  create: () => OK,
  package: () => OK,
};

export function validateStep(
  step: StepId,
  session: WizardSession,
  validators: Record<StepId, StepValidator> = stepValidators
): StepValidation {
  const fn = validators[step];
  return fn ? fn(session) : OK;
}

/** True when the step currently passes validation (drives stepper completion). */
export function isStepComplete(
  step: StepId,
  session: WizardSession,
  validators: Record<StepId, StepValidator> = stepValidators
): boolean {
  return validateStep(step, session, validators).valid;
}
