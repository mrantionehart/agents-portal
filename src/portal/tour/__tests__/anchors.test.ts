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
  it("contains all pilot-required anchors", () => {
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
