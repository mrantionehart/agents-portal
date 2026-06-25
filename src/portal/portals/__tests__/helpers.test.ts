/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.1 — R2A — Deal Portal helper tests
// ============================================================================

import {
  applyFilters,
  formatPrice,
  listCounts,
  locationLabel,
  relativeTime,
  shareUrl,
  statusLabel,
} from "../helpers";
import type { DealPortalRow } from "../types";

function p(over: Partial<DealPortalRow> = {}): DealPortalRow {
  return {
    id: "id-1",
    title: "1155 S Biscayne",
    status: "active",
    access_token: "deadbeefcafebabe1234567890abcdef",
    client_name: "Bobby Khullar",
    client_email: null,
    address: "1155 S Biscayne",
    city: "Miami",
    state: "FL",
    view_count: 3,
    last_viewed_at: "2026-06-25T06:00:00Z",
    created_at: "2026-06-20T10:00:00Z",
    updated_at: null,
    price: 1_250_000,
    beds: null,
    baths: null,
    sqft: null,
    property_type: null,
    media: null,
    ...over,
  };
}

describe("applyFilters", () => {
  const set: DealPortalRow[] = [
    p({ id: "a", status: "active", title: "A" }),
    p({ id: "b", status: "archived", title: "B" }),
    p({ id: "c", status: "active", title: "Carla place", client_name: "Carla" }),
    p({ id: "d", status: "active", title: "D", address: "Brickell" }),
  ];

  it("identity (all/empty search) keeps everyone", () => {
    expect(applyFilters(set, { status: "all", search: "" }).length).toBe(4);
  });
  it("status=active filter", () => {
    expect(applyFilters(set, { status: "active", search: "" }).map((x) => x.id).sort())
      .toEqual(["a", "c", "d"]);
  });
  it("status=archived filter", () => {
    expect(applyFilters(set, { status: "archived", search: "" }).map((x) => x.id))
      .toEqual(["b"]);
  });
  it("search hits title", () => {
    expect(applyFilters(set, { status: "all", search: "carla" }).map((x) => x.id))
      .toEqual(["c"]);
  });
  it("search hits client_name (case-insensitive)", () => {
    expect(applyFilters(set, { status: "all", search: "CARLA" }).map((x) => x.id))
      .toEqual(["c"]);
  });
  it("search hits address", () => {
    expect(applyFilters(set, { status: "all", search: "brickell" }).map((x) => x.id))
      .toEqual(["d"]);
  });
  it("combined status + search", () => {
    expect(applyFilters(set, { status: "archived", search: "B" }).map((x) => x.id))
      .toEqual(["b"]);
  });
  it("no match → empty", () => {
    expect(applyFilters(set, { status: "all", search: "xyz" })).toEqual([]);
  });
});

describe("listCounts", () => {
  it("counts by status + sums views", () => {
    const c = listCounts([
      p({ status: "active", view_count: 5 }),
      p({ status: "active", view_count: 3 }),
      p({ status: "archived", view_count: 0 }),
      p({ status: null, view_count: 2 }),
    ]);
    expect(c).toEqual({ total: 4, active: 2, archived: 1, totalViews: 10 });
  });
  it("empty → all zeros", () => {
    expect(listCounts([])).toEqual({ total: 0, active: 0, archived: 0, totalViews: 0 });
  });
});

describe("shareUrl", () => {
  it("returns canonical agents.hartfeltrealestate.com/portal/<token>", () => {
    expect(shareUrl({ access_token: "abc123" })).toBe(
      "https://agents.hartfeltrealestate.com/portal/abc123"
    );
  });
  it("matches legacy /deal-portals format exactly", () => {
    // The legacy /deal-portals page at app/deal-portals/page.tsx:79-81
    // emitted exactly this URL. R2A reuses it so existing shared links
    // remain valid.
    const u = shareUrl({ access_token: "deadbeefcafebabe1234567890abcdef" });
    expect(u.startsWith("https://agents.hartfeltrealestate.com/portal/")).toBe(true);
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-06-25T12:00:00Z");
  it.each([
    ["2026-06-25T11:59:50Z", "just now"],
    ["2026-06-25T11:30:00Z", "30m ago"],
    ["2026-06-25T08:00:00Z", "4h ago"],
    ["2026-06-23T12:00:00Z", "2d ago"],
  ])("iso=%s → %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
  it("null → em-dash", () => {
    expect(relativeTime(null)).toBe("—");
  });
  it("invalid → em-dash", () => {
    expect(relativeTime("garbage", now)).toBe("—");
  });
});

describe("formatPrice", () => {
  it("M scale", () => expect(formatPrice(1_250_000)).toBe("$1.3M"));
  it("K scale", () => expect(formatPrice(500_000)).toBe("$500K"));
  it("below K", () => expect(formatPrice(750)).toBe("$750"));
  it("null", () => expect(formatPrice(null)).toBeNull());
});

describe("statusLabel + locationLabel", () => {
  it("statusLabel", () => {
    expect(statusLabel("active")).toBe("Active");
    expect(statusLabel("archived")).toBe("Archived");
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel(null)).toBe("Unknown");
  });
  it("locationLabel composes city + state", () => {
    expect(locationLabel(p({ city: "Miami", state: "FL" }))).toBe("Miami, FL");
    expect(locationLabel(p({ city: "Miami", state: null }))).toBe("Miami");
    expect(locationLabel(p({ city: null, state: "FL" }))).toBe("FL");
    expect(locationLabel(p({ city: null, state: null }))).toBeNull();
  });
});

describe("R2A boundary lint — no writes, no new endpoints, no email/SMS", () => {
  it("api.ts only calls the EXISTING Vault advisor route", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/portals/api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
    // Single fetch — and it must target /deal-portals/advisor.
    const fetches = [...src.matchAll(/fetch\(\s*`([^`]+)`/g)].map((m) => m[1]);
    expect(fetches.length).toBe(1);
    expect(fetches[0].endsWith("/deal-portals/advisor")).toBe(true);
    // Read-only: GET only, no POST/PUT/PATCH/DELETE.
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it("page + client component have no writes / no new portal API routes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      "app/(portal)/workspace/portals/page.tsx",
      "src/portal/portals/PortalsClient.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src.includes(".insert(")).toBe(false);
      expect(src.includes(".update(")).toBe(false);
      expect(src.includes(".upsert(")).toBe(false);
      expect(src.includes(".delete(")).toBe(false);
      expect(src.includes(".rpc(")).toBe(false);
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
      expect(src).not.toMatch(/fetch\(\s*['"]\/api\/portal/);
    }
  });

  it("no email / SMS / recipient logging infrastructure imported", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/portals/api.ts",
      "src/portal/portals/helpers.ts",
      "src/portal/portals/PortalsClient.tsx",
      "app/(portal)/workspace/portals/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/sendgrid|twilio|onesignal|firebase\/messaging|resend|mailgun/i);
      // No recipient logging
      expect(src).not.toMatch(/recipients?\.insert|deal_portal_recipients/i);
      // No realtime
      expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
    }
  });
});
