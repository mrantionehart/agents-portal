/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — Sidebar nav config tests
// ============================================================================
// V3 + broker-only gating contract.
// ============================================================================

import { NAV_ITEMS, isBrokerTier, visibleNavItems } from "../nav-config";

describe("NAV_ITEMS (R5 — Training Hub absorbs Resources; AGENT.DOCS.1 adds Library)", () => {
  it("ships the 9 documented items in order (Library added between Training and Settings)", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Home",
      "Transactions",
      "Clients",
      "AI",
      "Calendar",
      "Notifications",
      "Training",
      "Library",
      "Settings",
    ]);
  });

  it("Transactions points to /workspace (AP2.1B's dashboard URL)", () => {
    const t = NAV_ITEMS.find((i) => i.id === "transactions")!;
    expect(t.href).toBe("/workspace");
  });

  it("R5 — Training is now in-shell (not flagged legacy); Resources removed", () => {
    const t = NAV_ITEMS.find((i) => i.id === "training");
    expect(t).toBeDefined();
    expect(t?.href).toBe("/training");
    expect(t?.legacy).toBeUndefined();
    expect(NAV_ITEMS.find((i) => i.id === "resources")).toBeUndefined();
  });

  it("every item has a unique id + href", () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(ids).size).toBe(NAV_ITEMS.length);
    expect(new Set(hrefs).size).toBe(NAV_ITEMS.length);
  });

  it("no AP2.1A nav item is broker-only", () => {
    // All spec'd items are agent-visible; broker-only entries will be
    // added in AP2.1H+ for broker dashboards. The gate is in place but
    // currently filters nothing.
    expect(NAV_ITEMS.every((i) => !i.brokerOnly)).toBe(true);
  });
});

describe("isBrokerTier", () => {
  it("admits broker, admin, office_manager", () => {
    expect(isBrokerTier("broker")).toBe(true);
    expect(isBrokerTier("admin")).toBe(true);
    expect(isBrokerTier("office_manager")).toBe(true);
  });

  it("rejects agent, null, undefined, unknown", () => {
    expect(isBrokerTier("agent")).toBe(false);
    expect(isBrokerTier(null)).toBe(false);
    expect(isBrokerTier(undefined)).toBe(false);
    expect(isBrokerTier("agent_pro")).toBe(false);
  });
});

describe("visibleNavItems (broker-only filter)", () => {
  it("agent sees only non-broker-only items", () => {
    expect(visibleNavItems("agent").length).toBe(NAV_ITEMS.length);
  });

  it("broker sees all items (including any future broker-only)", () => {
    expect(visibleNavItems("broker").length).toBe(NAV_ITEMS.length);
  });

  it("null role (logged-out edge) still receives non-broker items", () => {
    expect(visibleNavItems(null).length).toBe(NAV_ITEMS.length);
  });
});

describe("AP2 contract — no Vault writes from nav", () => {
  it("no nav href points at a known mutation surface", () => {
    const FORBIDDEN = ["docusign", "envelope", "send", "/api/paperwork/portal/send"];
    for (const item of NAV_ITEMS) {
      for (const f of FORBIDDEN) {
        expect(item.href.toLowerCase().includes(f)).toBe(false);
      }
    }
  });
});
