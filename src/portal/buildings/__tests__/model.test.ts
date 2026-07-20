/**
 * @jest-environment node
 */
// ============================================================================
// HOTFIX.AP.STR.001 — Buildings model (shared, pure) tests
// ============================================================================
// Locks: the endpoint stays /api/broker/str-directory (no new backend), the
// approved user-facing copy, and the compliance guardrails (no
// rental-permission / "all buildings" claims).
// ============================================================================

import {
  BUILDINGS_ENDPOINT,
  BUILDINGS_PAGE_TITLE,
  BUILDINGS_CATEGORY_LABEL,
  BUILDINGS_INTRO_COPY,
  COMPLIANCE_DISCLAIMER,
  fetchAirbnbFriendlyBuildings,
} from "../model";

describe("Buildings model — endpoint + copy contract", () => {
  it("reuses the existing Vault-backed proxy endpoint unchanged", () => {
    expect(BUILDINGS_ENDPOINT).toBe("/api/broker/str-directory");
  });

  it("uses the approved user-facing naming", () => {
    expect(BUILDINGS_PAGE_TITLE).toBe("Buildings");
    expect(BUILDINGS_CATEGORY_LABEL).toBe("Airbnb Friendly");
    expect(BUILDINGS_INTRO_COPY).toBe(
      "Explore buildings currently identified as Airbnb-friendly. Rental policies can change and should be independently verified."
    );
  });

  it("ships a non-empty compliance disclaimer", () => {
    expect(typeof COMPLIANCE_DISCLAIMER).toBe("string");
    expect(COMPLIANCE_DISCLAIMER.length).toBeGreaterThan(20);
  });

  it("makes no forbidden dataset-breadth or permission claim in any copy constant", () => {
    const FORBIDDEN = [
      "all buildings",
      "every building",
      "approved for airbnb",
      "airbnb permitted",
      "guaranteed eligibility",
    ];
    const copy = [
      BUILDINGS_PAGE_TITLE,
      BUILDINGS_CATEGORY_LABEL,
      BUILDINGS_INTRO_COPY,
      COMPLIANCE_DISCLAIMER,
    ]
      .join(" ")
      .toLowerCase();
    for (const phrase of FORBIDDEN) {
      expect(copy.includes(phrase)).toBe(false);
    }
  });
});

describe("fetchAirbnbFriendlyBuildings — wiring", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("calls the proxy endpoint with search + paging and NO category param (dataset not broadened)", async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: any) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({
          buildings: [{ id: "1", name: "Setai" }],
          pagination: { total: 1, totalPages: 1 },
        }),
      } as any;
    }) as any;

    const res = await fetchAirbnbFriendlyBuildings({ search: "setai", page: 1, limit: 25 });

    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("/api/broker/str-directory");
    expect(calls[0]).toContain("search=setai");
    // Must NOT pin a specific category — the agent-tier response IS the
    // Airbnb-friendly set; a category param would imply other categories exist.
    expect(calls[0]).not.toContain("category=");
    expect(res.buildings).toHaveLength(1);
    expect(res.total).toBe(1);
    expect(res.totalPages).toBe(1);
  });

  it("throws on a non-ok response so the UI can show an error state", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    await expect(fetchAirbnbFriendlyBuildings({})).rejects.toBeTruthy();
  });
});
