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
  // P4H — the three approval states this mirror had DRIFTED from. Vault has
  // had them since CONTRACT-APPROVAL-1, and without them the Portal could not
  // represent an approved document at all: `d.status === "approved"` was a
  // type error, so no agent-facing surface could key on approval.
  | "pending_approval"
  | "changes_requested"
  | "approved"
  | "sent"
  | "signed"
  | "voided";

export const KNOWN_STATUSES: ReadonlyArray<FormInstanceStatus> = [
  "recommended",
  "required",
  "blocked",
  "in_progress",
  "ready",
  "pending_approval",
  "changes_requested",
  "approved",
  "sent",
  "signed",
  "voided",
];
