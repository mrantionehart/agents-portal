/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — Sidebar nav config tests
// ============================================================================
// V3 + broker-only gating contract.
// ============================================================================

import { NAV_ITEMS, isBrokerTier, visibleNavItems } from "../nav-config";

describe("NAV_ITEMS (R5 — Training Hub absorbs Resources; AGENT.DOCS.1 adds Library; HOTFIX.AP.STR.001 adds Buildings)", () => {
  it("ships the 10 documented items in order (Buildings added immediately after Clients)", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Home",
      "Transactions",
      "Clients",
      "Buildings",
      "AI",
      "Calendar",
      "Notifications",
      "Training",
      "Library",
      "Settings",
    ]);
  });

  it("HOTFIX.AP.STR.001 — Buildings sits immediately after Clients", () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(labels.indexOf("Buildings")).toBe(labels.indexOf("Clients") + 1);
  });

  it("HOTFIX.AP.STR.001 — Buildings routes to /buildings, id 'buildings', icon 'building-2', agent-visible", () => {
    const b = NAV_ITEMS.find((i) => i.id === "buildings")!;
    expect(b).toBeDefined();
    expect(b.href).toBe("/buildings");
    expect(b.icon).toBe("building-2");
    expect(b.brokerOnly).toBeUndefined();
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

  it("HOTFIX.AP.STR.001 — a standard agent sees the Buildings item", () => {
    expect(visibleNavItems("agent").some((i) => i.id === "buildings")).toBe(true);
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
