// ============================================================================
// TRANSACTION ASSISTANT 4.0D — assistant-view (pure) tests
// ============================================================================

import {
  ASSISTANT_PROMPT_CHIPS,
  DRAFT_MENU,
  confidenceLabel,
  confidenceTone,
  displayAudience,
  draftTypeAudience,
  draftTypeLabel,
  friendlySource,
  inferAudienceFromMessage,
  isNavigableTab,
  mapAssistantError,
  shouldFlagUncertainty,
  tabHref,
} from "../assistant-view";

describe("draft menu + audience helpers (4.0E.2)", () => {
  it("DRAFT_MENU groups all 10 types under Client/Brokerage/Internal", () => {
    expect(DRAFT_MENU.map((g) => g.group)).toEqual(["Client", "Brokerage", "Internal"]);
    expect(DRAFT_MENU.reduce((n, g) => n + g.items.length, 0)).toBe(10);
    expect(draftTypeLabel("statutory_disclosure_reminder")).toBe("Statutory reminder");
  });
  it("draftTypeAudience maps types to their expected audience", () => {
    expect(draftTypeAudience("buyer_follow_up")).toBe("buyer");
    expect(draftTypeAudience("broker_update")).toBe("broker");
    expect(draftTypeAudience("statutory_disclosure_reminder")).toBe("seller");
    expect(draftTypeAudience("internal_note")).toBe("internal");
  });
  it("inferAudienceFromMessage only infers when clearly stated", () => {
    expect(inferAudienceFromMessage("email to the buyer")).toBe("buyer");
    expect(inferAudienceFromMessage("note for the broker")).toBe("broker");
    expect(inferAudienceFromMessage("a quick reminder")).toBe("internal");
  });
  it("displayAudience: internal→inferred, but explicit Vault audience is never overridden", () => {
    expect(displayAudience("internal", "buyer")).toBe("buyer");
    expect(displayAudience("internal", "internal")).toBe("internal");
    expect(displayAudience("seller", "buyer")).toBe("seller"); // explicit wins
    expect(displayAudience("buyer", undefined)).toBe("buyer");
  });
});

describe("confidence", () => {
  it("labels are High/Medium/Low — never percentages", () => {
    expect(confidenceLabel("high")).toBe("High");
    expect(confidenceLabel("medium")).toBe("Medium");
    expect(confidenceLabel("low")).toBe("Low");
    // no digits anywhere
    for (const l of ["high", "medium", "low"] as const) {
      expect(confidenceLabel(l)).not.toMatch(/\d/);
    }
  });
  it("tones map by level", () => {
    expect(confidenceTone("high")).toBe("ok");
    expect(confidenceTone("medium")).toBe("info");
    expect(confidenceTone("low")).toBe("warn");
  });
});

describe("friendlySource — never leaks internal engine names", () => {
  it("maps Coordinator/CollectionReport-style labels to agent language", () => {
    expect(friendlySource("Coordinator")).toBe("Deal status");
    expect(friendlySource("Missing Fields")).toBe("Required fields");
    expect(friendlySource("Package Review")).toBe("Package");
    expect(friendlySource("Coach")).toBe("Guidance");
    // never surfaces the raw internal term
    expect(friendlySource("Coordinator")).not.toContain("Coordinator");
  });
  it("passes through unknown labels", () => {
    expect(friendlySource("Something New")).toBe("Something New");
  });
});

describe("navigation helpers", () => {
  it("recognizes valid workspace tabs only", () => {
    expect(isNavigableTab("package")).toBe(true);
    expect(isNavigableTab("timeline")).toBe(true);
    expect(isNavigableTab("nonsense")).toBe(false);
    expect(isNavigableTab(undefined)).toBe(false);
    expect(isNavigableTab(null)).toBe(false);
  });
  it("builds a workspace tab href", () => {
    expect(tabHref("txn-1", "package")).toBe("/workspace/txn-1?tab=package");
  });
});

describe("prompt chips", () => {
  it("exposes the five approved prompts", () => {
    expect(ASSISTANT_PROMPT_CHIPS).toHaveLength(5);
    const labels = ASSISTANT_PROMPT_CHIPS.map((c) => c.label);
    expect(labels).toContain("What should I do next?");
    expect(labels).toContain("Why can't I send this package?");
    expect(labels).toContain("Who are we waiting on?");
    expect(labels).toContain("Summarize this transaction");
  });
});

describe("mapAssistantError — friendly + leak-safe", () => {
  const cases: Array<[number, string | undefined, string]> = [
    [401, undefined, "sign in"],
    [403, undefined, "access"],
    [404, "not_found", "removed"],
    [429, "assistant_rate_limited", "moment"],
    [503, "assistant_unavailable", "unavailable"],
    [504, "assistant_timeout", "too long"],
    [400, "invalid_message", "rephrasing"],
  ];
  it.each(cases)("status %s → friendly message", (status, code, needle) => {
    const e = mapAssistantError(status, code);
    expect(e.message.toLowerCase()).toContain(needle);
    // never leaks a status code or provider text
    expect(e.message).not.toMatch(/\b(50\d|40\d|HTTP|stack|Error:)\b/);
  });
  it("client conditions map without an HTTP status", () => {
    expect(mapAssistantError(0, "timeout").message.toLowerCase()).toContain("too long");
    expect(mapAssistantError(0, "network").message.toLowerCase()).toContain("couldn't reach");
    expect(mapAssistantError(0, "no_transaction").message.toLowerCase()).toContain("open a transaction");
  });
});

describe("shouldFlagUncertainty", () => {
  it("flags low confidence or any warnings", () => {
    expect(shouldFlagUncertainty("low", [])).toBe(true);
    expect(shouldFlagUncertainty("high", ["x"])).toBe(true);
    expect(shouldFlagUncertainty("high", [])).toBe(false);
  });
});
