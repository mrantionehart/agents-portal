// ============================================================================
// AGENT PORTAL · presenting an envelope the agent sent themselves
// ============================================================================
// Vault cannot send an ERL-14 that an agent completed outside it: ERL-14 is
// the only form Vault refuses to send without a signature anchor, and on an
// externally produced document the anchor rule matches nothing. So the
// agreement goes out through the agent's own DocuSign and is RECORDED here.
//
// 🔒 THE ONE RULE THIS FILE EXISTS TO HOLD ON SCREEN: AN ENVELOPE ID THE
// AGENT TYPED IS A CLAIM, NOT PROOF. Vault decides whether it is verified by
// reading the envelope back from the sending DocuSign account; this module
// only makes sure the answer is never shown as something it is not. An
// unverified record says UNVERIFIED, in those words, next to the status —
// never a green tick, never "executed".
//
// Pure. No fetch, no React. The panel renders what these functions return so
// a test can state the rule without mounting anything.
// ============================================================================

export type ExternalEnvelopeStatus =
  | "created" | "sent" | "viewed" | "delivered"
  | "completed" | "declined" | "voided" | "expired";

/** The six the agent-facing surface must show. */
export const SHOWN_STATUSES: ReadonlyArray<ExternalEnvelopeStatus> = [
  "sent", "delivered", "completed", "declined", "voided", "expired",
];

export type Tone = "neutral" | "info" | "good" | "warn" | "bad";

const STATUS_VIEW: Record<ExternalEnvelopeStatus, { label: string; tone: Tone }> = {
  created: { label: "Created", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  viewed: { label: "Opened", tone: "info" },
  delivered: { label: "Delivered", tone: "info" },
  completed: { label: "Completed", tone: "good" },
  declined: { label: "Declined", tone: "bad" },
  voided: { label: "Voided", tone: "warn" },
  expired: { label: "Expired", tone: "warn" },
};

export function statusView(s: string): { label: string; tone: Tone } {
  return (
    STATUS_VIEW[s as ExternalEnvelopeStatus] ?? { label: "Unknown", tone: "neutral" }
  );
}

/**
 * How the verification state reads.
 *
 * 🔒 `completed` + unverified must NEVER read as good. Vault's CHECK makes
 * that row impossible, but a UI that would have rendered it as a green
 * "Completed" is one schema change away from doing so — so the tone is
 * decided here, from the verification flag, and downgraded whatever the
 * status says.
 */
export function verificationView(verified: boolean): {
  label: string;
  tone: Tone;
  detail: string;
} {
  return verified
    ? {
        label: "Verified",
        tone: "good",
        detail:
          "DocuSign confirmed this envelope is in the sending account, and this status came from DocuSign.",
      }
    : {
        label: "UNVERIFIED",
        tone: "warn",
        detail:
          "DocuSign has not confirmed this envelope. It records that the agreement was sent — not that it was signed.",
      };
}

/** The tone to actually paint, once verification is taken into account. */
export function effectiveTone(status: string, verified: boolean): Tone {
  const base = statusView(status).tone;
  if (verified) return base;
  // Nothing unverified is ever "good".
  return base === "good" ? "warn" : base;
}

const ENVELOPE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntryProblem = "empty" | "malformed";

/**
 * Client-side shape check only — so the agent is told about a typo before a
 * round trip. It is NOT the gate: Vault re-validates and, more importantly,
 * verifies ownership, which nothing here can do.
 */
export function validateEnvelopeId(raw: string): EntryProblem | null {
  const v = raw.trim();
  if (v === "") return "empty";
  if (!ENVELOPE_ID_RE.test(v)) return "malformed";
  return null;
}

export const ENTRY_PROBLEM_COPY: Record<EntryProblem, string> = {
  empty: "Paste the envelope ID from DocuSign.",
  malformed:
    "That does not look like a DocuSign envelope ID. Open the envelope in DocuSign and copy the ID from its details — it looks like 37653a88-a887-81f9-8054-a39d821fb0c8.",
};

/**
 * May the agent record an envelope against this document at all?
 *
 * Only an APPROVED document: the record says "the approved agreement went
 * out", and before approval there is nothing to say that about. An existing
 * record means use Refresh — recording twice is what requirement 9 forbids,
 * and Vault's unique index refuses it anyway.
 */
export type RecordBlocker = "not_approved" | "already_recorded" | "no_pdf";

export function recordBlocker(input: {
  readonly status: string;
  readonly hasPdf: boolean;
  readonly existingEnvelopes: number;
}): RecordBlocker | null {
  if (input.status !== "approved") return "not_approved";
  if (!input.hasPdf) return "no_pdf";
  if (input.existingEnvelopes > 0) return "already_recorded";
  return null;
}

export const RECORD_BLOCKER_COPY: Record<RecordBlocker, string> = {
  not_approved:
    "The broker has to approve this document before an envelope can be recorded against it.",
  no_pdf: "There is no stored PDF on this document, so no envelope could carry it.",
  already_recorded:
    "An envelope is already recorded here. Use Refresh status instead of recording it again.",
};
