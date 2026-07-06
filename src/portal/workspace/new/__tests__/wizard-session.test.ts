/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3B.3A — WizardSession tests (pure updaters + localStorage)
// ============================================================================

import {
  WIZARD_SESSION_KEY,
  WIZARD_SESSION_VERSION,
  emptySession,
  setTransactionType,
  mergeProperty,
  setParties,
  mergeDates,
  setStep,
  setDraftTransactionId,
  addCreatedPartyId,
  loadSession,
  saveSession,
  clearSession,
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
  });
});
