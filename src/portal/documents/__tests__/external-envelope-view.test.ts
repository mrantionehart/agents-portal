// ============================================================================
// AGENT PORTAL · an envelope ID the agent typed is a claim, not proof
// ============================================================================
// [XAV-4] is the load-bearing one: nothing unverified may be painted as good,
// so a "Completed" nobody confirmed can never look like a signed agreement.
// ============================================================================

import {
  ENTRY_PROBLEM_COPY,
  RECORD_BLOCKER_COPY,
  SHOWN_STATUSES,
  effectiveTone,
  recordBlocker,
  statusView,
  validateEnvelopeId,
  verificationView,
} from "../external-envelope-view";

const ENV = "37653a88-a887-81f9-8054-a39d821fb0c8";

describe("[XAV] external envelope presentation", () => {
  it("[XAV-1] all six required statuses render with a label", () => {
    expect([...SHOWN_STATUSES]).toEqual([
      "sent", "delivered", "completed", "declined", "voided", "expired",
    ]);
    for (const s of SHOWN_STATUSES) {
      expect(statusView(s).label).not.toBe("Unknown");
    }
  });

  it("[XAV-2] an unrecognised status reads as Unknown, not as something good", () => {
    expect(statusView("correct").label).toBe("Unknown");
    expect(statusView("correct").tone).toBe("neutral");
    expect(statusView("").label).toBe("Unknown");
  });

  it("[XAV-3] verified and unverified say which they are, in words", () => {
    expect(verificationView(true).label).toBe("Verified");
    expect(verificationView(true).detail).toMatch(/DocuSign confirmed/);
    const un = verificationView(false);
    expect(un.label).toBe("UNVERIFIED");
    expect(un.detail).toMatch(/not that it was signed/);
    expect(un.tone).toBe("warn");
  });

  it("[XAV-4] nothing UNVERIFIED is ever painted as good", () => {
    // The rule that stops a completion nobody confirmed from looking signed.
    expect(effectiveTone("completed", true)).toBe("good");
    expect(effectiveTone("completed", false)).toBe("warn");
    // and a status that was never good keeps its own tone either way
    expect(effectiveTone("declined", false)).toBe("bad");
    expect(effectiveTone("sent", false)).toBe("info");
  });

  it("[XAV-5] a malformed envelope ID is caught before a round trip", () => {
    expect(validateEnvelopeId(ENV)).toBeNull();
    expect(validateEnvelopeId(`  ${ENV}  `)).toBeNull();
    expect(validateEnvelopeId("")).toBe("empty");
    expect(validateEnvelopeId("   ")).toBe("empty");
    expect(validateEnvelopeId("37653a88")).toBe("malformed");
    expect(validateEnvelopeId("not-an-envelope-id-at-all")).toBe("malformed");
    expect(ENTRY_PROBLEM_COPY.malformed).toMatch(/copy the ID from its details/);
  });

  it("[XAV-6] only an approved document with a PDF and no envelope may be recorded", () => {
    expect(recordBlocker({ status: "approved", hasPdf: true, existingEnvelopes: 0 })).toBeNull();
    expect(recordBlocker({ status: "pending_approval", hasPdf: true, existingEnvelopes: 0 }))
      .toBe("not_approved");
    expect(recordBlocker({ status: "approved", hasPdf: false, existingEnvelopes: 0 }))
      .toBe("no_pdf");
    // Requirement 9: never a second registration, and the copy says what to
    // do instead.
    expect(recordBlocker({ status: "approved", hasPdf: true, existingEnvelopes: 1 }))
      .toBe("already_recorded");
    expect(RECORD_BLOCKER_COPY.already_recorded).toMatch(/Use Refresh status/);
  });
});
