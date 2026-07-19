/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3B.3A — WizardSession tests (pure updaters + localStorage)
// ============================================================================

import {
  WIZARD_SESSION_KEY,
  WIZARD_SESSION_VERSION,
  addCompletedStep,
  addCreatedPartyId,
  deriveCompletedFromState,
  emptySession,
  loadSession,
  mergeDates,
  mergeProperty,
  saveSession,
  clearSession,
  setDraftTransactionId,
  setParties,
  setStep,
  setTransactionType,
} from "../wizard-session";

beforeEach(() => {
  window.localStorage.clear();
});

describe("emptySession", () => {
  it("starts empty at the first step with the current version", () => {
    const s = emptySession();
    expect(s).toEqual({
      version: WIZARD_SESSION_VERSION,
      transaction_type: null,
      property: {},
      parties: [],
      dates: {},
      current_step: "type",
      // PILOT-D-008: completed_steps starts empty and is populated
      // only by validated forward navigation.
      completed_steps: [],
      draft_transaction_id: null,
      created_party_ids: [],
    });
  });
});

describe("pure updaters (immutable)", () => {
  it("setTransactionType does not mutate the input", () => {
    const a = emptySession();
    const b = setTransactionType(a, "purchase");
    expect(b.transaction_type).toBe("purchase");
    expect(a.transaction_type).toBeNull();
    expect(b).not.toBe(a);
  });
  it("mergeProperty / mergeDates merge patches", () => {
    const s = mergeDates(
      mergeProperty(emptySession(), { address: "123 Main" }),
      { closing_date: "2026-08-01" }
    );
    expect(s.property.address).toBe("123 Main");
    expect(s.dates.closing_date).toBe("2026-08-01");
  });
  it("setParties replaces the array", () => {
    const s = setParties(emptySession(), [{ role: "buyer", name: "Jane" }]);
    expect(s.parties).toEqual([{ role: "buyer", name: "Jane" }]);
  });
  it("setStep / setDraftTransactionId set anchors", () => {
    const s = setDraftTransactionId(setStep(emptySession(), "review"), "txn-1");
    expect(s.current_step).toBe("review");
    expect(s.draft_transaction_id).toBe("txn-1");
  });
  it("addCreatedPartyId dedups and ignores empty", () => {
    let s = addCreatedPartyId(emptySession(), "p1");
    s = addCreatedPartyId(s, "p1"); // dup ignored
    s = addCreatedPartyId(s, ""); // empty ignored
    s = addCreatedPartyId(s, "p2");
    expect(s.created_party_ids).toEqual(["p1", "p2"]);
  });
});

describe("localStorage persistence", () => {
  it("save → load round-trips", () => {
    const s = setStep(mergeProperty(emptySession(), { city: "Miami" }), "dates");
    saveSession(s);
    expect(window.localStorage.getItem(WIZARD_SESSION_KEY)).toBeTruthy();
    const back = loadSession();
    expect(back.current_step).toBe("dates");
    expect(back.property.city).toBe("Miami");
  });
  it("clear removes the blob → load yields empty", () => {
    saveSession(setStep(emptySession(), "review"));
    clearSession();
    expect(window.localStorage.getItem(WIZARD_SESSION_KEY)).toBeNull();
    expect(loadSession().current_step).toBe("type");
  });
  it("missing blob → empty session", () => {
    expect(loadSession()).toEqual(emptySession());
  });
  it("corrupt JSON → empty session (never throws)", () => {
    window.localStorage.setItem(WIZARD_SESSION_KEY, "{not json");
    expect(loadSession()).toEqual(emptySession());
  });
  it("version mismatch → empty session (old blob dropped)", () => {
    window.localStorage.setItem(
      WIZARD_SESSION_KEY,
      JSON.stringify({ ...emptySession(), version: 999, current_step: "review" })
    );
    expect(loadSession()).toEqual(emptySession());
  });
  it("backfills missing fields over an empty base", () => {
    window.localStorage.setItem(
      WIZARD_SESSION_KEY,
      JSON.stringify({ version: WIZARD_SESSION_VERSION, current_step: "parties" })
    );
    const back = loadSession();
    expect(back.current_step).toBe("parties");
    expect(back.property).toEqual({});
    expect(back.parties).toEqual([]);
    expect(back.created_party_ids).toEqual([]);
    // PILOT-D-008: legacy blobs without completed_steps backfill to [].
    expect(back.completed_steps).toEqual([]);
  });

  it("loadSession filters non-string entries from a corrupt completed_steps blob", () => {
    window.localStorage.setItem(
      WIZARD_SESSION_KEY,
      JSON.stringify({
        version: WIZARD_SESSION_VERSION,
        current_step: "type",
        completed_steps: ["type", 42, null, "property", { bad: true }],
      })
    );
    expect(loadSession().completed_steps).toEqual(["type", "property"]);
  });
});

// ─── PILOT-D-008: completed_steps ────────────────────────────────────────────

describe("addCompletedStep", () => {
  it("appends a canonical StepId when not already present", () => {
    const s = addCompletedStep(emptySession(), "type");
    expect(s.completed_steps).toEqual(["type"]);
  });

  it("is idempotent — a duplicate insert returns the same reference", () => {
    const a = addCompletedStep(emptySession(), "type");
    const b = addCompletedStep(a, "type");
    expect(b).toBe(a);
    expect(b.completed_steps).toEqual(["type"]);
  });

  it("appends in insertion order, preserving prior entries", () => {
    let s = emptySession();
    s = addCompletedStep(s, "type");
    s = addCompletedStep(s, "property");
    s = addCompletedStep(s, "parties");
    expect(s.completed_steps).toEqual(["type", "property", "parties"]);
  });

  it("does not mutate the input session", () => {
    const a = emptySession();
    const b = addCompletedStep(a, "type");
    expect(a.completed_steps).toEqual([]);
    expect(b).not.toBe(a);
  });
});

describe("deriveCompletedFromState (PILOT-D-008 recovery)", () => {
  it("derives no steps from a fresh empty session", () => {
    expect(deriveCompletedFromState(emptySession())).toEqual([]);
  });

  it("derives 'type' when transaction_type is a non-empty string", () => {
    const s = setTransactionType(emptySession(), "purchase");
    expect(deriveCompletedFromState(s)).toEqual(["type"]);
  });

  it("does NOT derive 'type' when transaction_type is null or empty", () => {
    expect(deriveCompletedFromState(emptySession())).not.toContain("type");
    // Empty string is not a canonical value.
    const s = setTransactionType(emptySession(), "");
    expect(deriveCompletedFromState(s)).not.toContain("type");
  });

  it("derives 'property' when property.address is a non-empty string", () => {
    const s = mergeProperty(emptySession(), { address: "123 Main St" });
    expect(deriveCompletedFromState(s)).toEqual(["property"]);
  });

  it("does NOT derive 'property' when address is whitespace-only", () => {
    const s = mergeProperty(emptySession(), { address: "   " });
    expect(deriveCompletedFromState(s)).not.toContain("property");
  });

  it("derives 'parties' only when a party has both role and name populated", () => {
    // Neither → no
    expect(
      deriveCompletedFromState(
        setParties(emptySession(), [{ role: "buyer" }])
      )
    ).not.toContain("parties");
    expect(
      deriveCompletedFromState(
        setParties(emptySession(), [{ name: "Alice" }])
      )
    ).not.toContain("parties");
    // Both → yes
    expect(
      deriveCompletedFromState(
        setParties(emptySession(), [{ role: "buyer", name: "Alice" }])
      )
    ).toContain("parties");
  });

  it("derives 'dates' from contract_date OR lease_start", () => {
    expect(
      deriveCompletedFromState(
        mergeDates(emptySession(), { contract_date: "2026-07-19" })
      )
    ).toContain("dates");
    expect(
      deriveCompletedFromState(
        mergeDates(emptySession(), { lease_start: "2026-07-19" })
      )
    ).toContain("dates");
  });

  it("derives 'review' ONLY when the wizard has advanced to create or package", () => {
    // Mid-flow (property) → no
    expect(
      deriveCompletedFromState(setStep(emptySession(), "property"))
    ).not.toContain("review");
    // On review itself → NOT yet — review is only "completed" once the
    // learner has clicked Next PAST review.
    expect(
      deriveCompletedFromState(setStep(emptySession(), "review"))
    ).not.toContain("review");
    // On create → yes.
    expect(
      deriveCompletedFromState(setStep(emptySession(), "create"))
    ).toContain("review");
    // Terminal package → yes.
    expect(
      deriveCompletedFromState(setStep(emptySession(), "package"))
    ).toContain("review");
  });

  it("derives ALL FIVE canonical steps for a session that looks completely filled in (learner #1 shape)", () => {
    // Mirrors the shape observed on the stuck production session
    // 704fb65b: type=purchase, property.address set, both dates set, two
    // parties (buyer+seller), current_step=create.
    let s = emptySession();
    s = setTransactionType(s, "purchase");
    s = mergeProperty(s, { address: "123 test" });
    s = setParties(s, [
      { role: "buyer", name: "test" },
      { role: "seller", name: "sell test" },
    ]);
    s = mergeDates(s, {
      contract_date: "2026-07-19",
      closing_date: "2026-07-30",
    });
    s = setStep(s, "create");
    expect(deriveCompletedFromState(s)).toEqual([
      "type",
      "property",
      "parties",
      "dates",
      "review",
    ]);
  });
});
