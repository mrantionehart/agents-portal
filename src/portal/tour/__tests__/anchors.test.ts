// ============================================================================
// AP2 tour — anchors module
// ============================================================================

import {
  ALLOWED_TRAINING_ANCHOR_IDS,
  TRAINING_ANCHORS,
  isAllowedAnchorId,
  isValidAnchorId,
  resolveAnchor,
} from "../anchors";

describe("anchors — vocabulary", () => {
  it("contains all Track 1 pilot anchors", () => {
    for (const id of [
      "portal.navigation.sidebar",
      "portal.navigation.home",
      "portal.navigation.workspace",
      "portal.navigation.notifications",
      "portal.navigation.settings",
      "portal.home.dashboard",
      "portal.notifications.inbox",
      "portal.settings.profile",
    ]) {
      expect(ALLOWED_TRAINING_ANCHOR_IDS).toContain(id);
    }
  });

  it("contains all Track 2 (Transaction Intelligence) anchors", () => {
    for (const id of [
      "portal.workspace.coordinator",
      "portal.workspace.coordinator.directive",
      "portal.workspace.coordinator.blockers",
      "portal.workspace.coordinator.cta",
      "portal.workspace.coach.strip",
      "portal.workspace.assistant.prompt-chips",
      "portal.workspace.tab.ai",
      "portal.workspace.ai.panel",
      "portal.workspace.ai.draft-picker",
      "portal.workspace.ai.draft-card",
      "portal.workspace.ai.draft-card.confidence",
      "portal.workspace.ai.draft-card.warnings",
      "portal.workspace.ai.draft-card.facts-used",
    ]) {
      expect(ALLOWED_TRAINING_ANCHOR_IDS).toContain(id);
    }
  });

  it("Track 2 anchor IDs are unique in the vocabulary (no duplicate string values)", () => {
    const track2 = [
      "portal.workspace.coordinator",
      "portal.workspace.coordinator.directive",
      "portal.workspace.coordinator.blockers",
      "portal.workspace.coordinator.cta",
      "portal.workspace.coach.strip",
      "portal.workspace.assistant.prompt-chips",
      "portal.workspace.tab.ai",
      "portal.workspace.ai.panel",
      "portal.workspace.ai.draft-picker",
      "portal.workspace.ai.draft-card",
      "portal.workspace.ai.draft-card.confidence",
      "portal.workspace.ai.draft-card.warnings",
      "portal.workspace.ai.draft-card.facts-used",
    ];
    const unique = new Set(track2);
    expect(unique.size).toBe(track2.length);
  });

  it("no anchor value contains transaction IDs, UUIDs, addresses, emails, or PII", () => {
    // Guard against a future contributor baking a runtime value into an
    // anchor string. Anchor IDs are static dotted namespaces only.
    for (const id of Object.values(TRAINING_ANCHORS)) {
      // UUIDs
      expect(id).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      // Email
      expect(id).not.toMatch(/@/);
      // Digits at all in an anchor value are a smell; the vocabulary uses
      // lowercase-hyphenated tokens only.
      expect(id).not.toMatch(/\d/);
      // No slashes (no route paths embedded)
      expect(id).not.toMatch(/\//);
    }
  });

  it("TRAINING_ANCHORS entries all match dotted namespace shape", () => {
    for (const id of Object.values(TRAINING_ANCHORS)) {
      expect(isValidAnchorId(id)).toBe(true);
    }
  });

  it("does not contain CSS metacharacters", () => {
    for (const id of Object.values(TRAINING_ANCHORS)) {
      expect(id).not.toMatch(/[#[\]>+~:\s]/);
    }
  });
});

describe("anchors — validation", () => {
  it("isValidAnchorId accepts dotted lowercase segments", () => {
    expect(isValidAnchorId("portal.navigation.home")).toBe(true);
    expect(isValidAnchorId("portal.sub-namespace.item-a")).toBe(true);
  });

  it("isValidAnchorId rejects CSS-style ids", () => {
    expect(isValidAnchorId("#nav")).toBe(false);
    expect(isValidAnchorId("[data-x]")).toBe(false);
    expect(isValidAnchorId("portal navigation home")).toBe(false);
    expect(isValidAnchorId(".portal.nav")).toBe(false);
    expect(isValidAnchorId("portal")).toBe(false); // needs >= 2 segments
  });

  it("isAllowedAnchorId rejects unknown ids", () => {
    expect(isAllowedAnchorId("portal.mystery.item")).toBe(false);
  });

  it("isAllowedAnchorId accepts the pilot allowlist", () => {
    for (const id of ALLOWED_TRAINING_ANCHOR_IDS) {
      expect(isAllowedAnchorId(id)).toBe(true);
    }
  });
});

describe("anchors — DOM resolver", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns null for an unresolvable id", () => {
    expect(resolveAnchor("portal.navigation.home")).toBeNull();
  });

  it("returns the element carrying data-training-id", () => {
    const el = document.createElement("div");
    el.setAttribute("data-training-id", "portal.navigation.home");
    document.body.appendChild(el);
    const found = resolveAnchor("portal.navigation.home");
    expect(found).toBe(el);
  });

  it("returns null for a malformed id (defensive)", () => {
    const el = document.createElement("div");
    el.setAttribute("data-training-id", "portal navigation home");
    document.body.appendChild(el);
    expect(resolveAnchor("portal navigation home")).toBeNull();
  });
});
