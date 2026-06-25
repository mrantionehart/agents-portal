// ============================================================================
// AGENT PORTAL 2.1 — R4 — Vault FormInstanceStatus mirror
// ============================================================================
// Mirrors Vault's FormInstanceStatus union from src/lib/paperwork/types.ts.
// Kept as a separate file so the lifecycle vocabulary lives in exactly
// one place inside agents-portal and the merge helper can reference it
// without a circular dep through documents/types.
// ============================================================================

export type FormInstanceStatus =
  | "recommended"
  | "required"
  | "blocked"
  | "in_progress"
  | "ready"
  | "sent"
  | "signed"
  | "voided";

export const KNOWN_STATUSES: ReadonlyArray<FormInstanceStatus> = [
  "recommended",
  "required",
  "blocked",
  "in_progress",
  "ready",
  "sent",
  "signed",
  "voided",
];
