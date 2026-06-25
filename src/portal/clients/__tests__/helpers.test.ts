/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Clients helpers tests
// ============================================================================

import {
  applyClientFilters,
  bucketBadgeLabel,
  channelLabel,
  clientListCounts,
  deriveBucket,
  formatBudgetRange,
  profileTypeLabel,
  relativeUpdated,
  representationLabel,
  temperatureLabel,
  typeBucket,
} from "../helpers";
import type { ClientListItem } from "../types";

function c(over: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: "c1",
    full_name: "Bobby Khullar",
    email: "bobby@example.com",
    phone: "+13055551234",
    profile_type: "buyer",
    temperature: "warm",
    representation_status: "Unknown",
    preferred_channel: "phone",
    target_areas: ["Miami Beach"],
    updated_at: "2026-06-25T08:00:00Z",
    assignmentBucket: null,
    ...over,
  };
}

describe("typeBucket", () => {
  it.each([
    ["buyer", "buyers"],
    ["seller", "sellers"],
    ["investor", "investors"],
    ["Buyer", "buyers"],
    ["INVESTOR", "investors"],
    [null, "all"],
    ["unknown", "all"],
  ])("profile_type=%s → %s", (input, expected) => {
    expect(typeBucket(input as any)).toBe(expected);
  });
});

describe("applyClientFilters", () => {
  const set: ClientListItem[] = [
    c({ id: "a", profile_type: "buyer", temperature: "hot", full_name: "Alice", email: "alice@x.com" }),
    c({ id: "b", profile_type: "seller", temperature: "warm", full_name: "Bob", target_areas: ["Brickell"] }),
    c({ id: "c", profile_type: "investor", temperature: "hot", full_name: "Carla" }),
    c({ id: "d", profile_type: "buyer", temperature: "cold", full_name: "Dan", phone: "555-9999" }),
  ];

  it("identity (all/all/empty search) keeps everyone", () => {
    expect(applyClientFilters(set, { temperature: "all", type: "all", search: "" }).length).toBe(4);
  });
  it("temperature=hot → only hot", () => {
    expect(
      applyClientFilters(set, { temperature: "hot", type: "all", search: "" }).map((x) => x.id).sort()
    ).toEqual(["a", "c"]);
  });
  it("type=buyers → buyer only", () => {
    expect(
      applyClientFilters(set, { temperature: "all", type: "buyers", search: "" }).map((x) => x.id).sort()
    ).toEqual(["a", "d"]);
  });
  it("type=sellers → seller only", () => {
    expect(
      applyClientFilters(set, { temperature: "all", type: "sellers", search: "" }).map((x) => x.id)
    ).toEqual(["b"]);
  });
  it("type=investors → investor only", () => {
    expect(
      applyClientFilters(set, { temperature: "all", type: "investors", search: "" }).map((x) => x.id)
    ).toEqual(["c"]);
  });
  it("combined hot + buyers", () => {
    expect(
      applyClientFilters(set, { temperature: "hot", type: "buyers", search: "" }).map((x) => x.id)
    ).toEqual(["a"]);
  });
  it("search hits name", () => {
    expect(
      applyClientFilters(set, { temperature: "all", type: "all", search: "carla" }).map((x) => x.id)
    ).toEqual(["c"]);
  });
  it("search hits email", () => {
    expect(
      applyClientFilters(set, { temperature: "all", type: "all", search: "alice@x" }).map((x) => x.id)
    ).toEqual(["a"]);
  });
  it("search hits phone", () => {
    expect(
      applyClientFilters(set, { temperature: "all", type: "all", search: "555-9999" }).map((x) => x.id)
    ).toEqual(["d"]);
  });
  it("search hits target area (case-insensitive)", () => {
    expect(
      applyClientFilters(set, { temperature: "all", type: "all", search: "brickell" }).map((x) => x.id)
    ).toEqual(["b"]);
  });
  it("search no match → empty", () => {
    expect(
      applyClientFilters(set, { temperature: "all", type: "all", search: "zzz" })
    ).toEqual([]);
  });
});

describe("clientListCounts", () => {
  it("counts each axis (incl. R3A assignment buckets)", () => {
    const set: ClientListItem[] = [
      c({ temperature: "hot", profile_type: "buyer", assignmentBucket: "assigned" }),
      c({ temperature: "warm", profile_type: "seller", assignmentBucket: "claimed" }),
      c({ temperature: "cold", profile_type: "investor", assignmentBucket: "dispo" }),
      c({ temperature: "hot", profile_type: "investor", assignmentBucket: null }),
    ];
    expect(clientListCounts(set)).toEqual({
      total: 4,
      hot: 2,
      warm: 1,
      cold: 1,
      buyers: 1,
      sellers: 1,
      investors: 2,
      assigned: 1,
      claimed: 1,
      dispo: 1,
    });
  });
  it("empty → all zeros", () => {
    expect(clientListCounts([])).toEqual({
      total: 0,
      hot: 0,
      warm: 0,
      cold: 0,
      buyers: 0,
      sellers: 0,
      investors: 0,
      assigned: 0,
      claimed: 0,
      dispo: 0,
    });
  });
});

describe("R3A — assignment filter + badge", () => {
  const fleet: ClientListItem[] = [
    c({ id: "ass1", full_name: "Alice", assignmentBucket: "assigned" }),
    c({ id: "ass2", full_name: "Adam",  assignmentBucket: "assigned" }),
    c({ id: "clm1", full_name: "Carla", assignmentBucket: "claimed" }),
    c({ id: "dip1", full_name: "Dan",   assignmentBucket: "dispo" }),
    c({ id: "dip2", full_name: "Dora",  assignmentBucket: "dispo" }),
    c({ id: "brk1", full_name: "Bea",   assignmentBucket: null }), // broker visibility only
  ];

  it("assignment=all keeps everyone", () => {
    expect(
      applyClientFilters(fleet, { temperature: "all", type: "all", assignment: "all", search: "" }).length
    ).toBe(6);
  });
  it("assignment=assigned → only assigned", () => {
    expect(
      applyClientFilters(fleet, { temperature: "all", type: "all", assignment: "assigned", search: "" })
        .map((x) => x.id).sort()
    ).toEqual(["ass1", "ass2"]);
  });
  it("assignment=claimed → only claimed", () => {
    expect(
      applyClientFilters(fleet, { temperature: "all", type: "all", assignment: "claimed", search: "" })
        .map((x) => x.id)
    ).toEqual(["clm1"]);
  });
  it("assignment=dispo → only dispo rows", () => {
    expect(
      applyClientFilters(fleet, { temperature: "all", type: "all", assignment: "dispo", search: "" })
        .map((x) => x.id).sort()
    ).toEqual(["dip1", "dip2"]);
  });
  it("AND-composes with type + search", () => {
    const set = [
      c({ id: "x", full_name: "Xerxes", profile_type: "buyer", assignmentBucket: "assigned" }),
      c({ id: "y", full_name: "Xerxes", profile_type: "seller", assignmentBucket: "assigned" }),
      c({ id: "z", full_name: "Yvonne", profile_type: "buyer", assignmentBucket: "claimed" }),
    ];
    expect(
      applyClientFilters(set, {
        temperature: "all",
        type: "buyers",
        assignment: "assigned",
        search: "xer",
      }).map((x) => x.id)
    ).toEqual(["x"]);
  });
  it("absent assignment field defaults to all (back-compat)", () => {
    // Older call sites that don't pass assignment — they keep working.
    expect(
      (applyClientFilters as any)(fleet, { temperature: "all", type: "all", search: "" }).length
    ).toBe(6);
  });

  describe("bucketBadgeLabel", () => {
    it.each([
      ["assigned", "Assigned"],
      ["claimed", "Claimed"],
      ["dispo", "Dispo Feed"],
      [null, null],
    ])("bucket=%s → %s", (input, expected) => {
      expect(bucketBadgeLabel(input as any)).toBe(expected);
    });
  });
});

describe("R3A — deriveBucket (caller-relative)", () => {
  it("assigned_agent_id === caller → 'assigned'", () => {
    expect(deriveBucket({ assigned_agent_id: "U1", claimed_by: null, visibility: null, status: null }, "U1")).toBe("assigned");
  });
  it("claimed_by === caller → 'claimed'", () => {
    expect(deriveBucket({ assigned_agent_id: "U2", claimed_by: "U1", visibility: null, status: null }, "U1")).toBe("claimed");
  });
  it("dispo_feed + dispo → 'dispo'", () => {
    expect(deriveBucket({ assigned_agent_id: null, claimed_by: null, visibility: "dispo_feed", status: "dispo" }, "U1")).toBe("dispo");
  });
  it("assigned takes precedence over claimed over dispo", () => {
    expect(deriveBucket({ assigned_agent_id: "U1", claimed_by: "U1", visibility: "dispo_feed", status: "dispo" }, "U1")).toBe("assigned");
  });
  it("none → null (broker-only visibility)", () => {
    expect(deriveBucket({ assigned_agent_id: "OTHER", claimed_by: "OTHER", visibility: null, status: null }, "U1")).toBeNull();
  });
  it("does NOT leak another agent's user_id in the output", () => {
    // Output is one of the four category literals or null — never the
    // foreign user_ids themselves, regardless of which input fields
    // hold them.
    const VALID_OUTPUTS = new Set(["assigned", "claimed", "dispo", null]);
    const rows = [
      { assigned_agent_id: "OTHER_AGENT_UUID", claimed_by: "ANOTHER_AGENT_UUID", visibility: null, status: null },
      { assigned_agent_id: "OTHER_AGENT_UUID", claimed_by: "U1", visibility: null, status: null },
      { assigned_agent_id: null, claimed_by: null, visibility: "dispo_feed", status: "dispo" },
    ];
    for (const row of rows) {
      const out = deriveBucket(row, "U1");
      expect(VALID_OUTPUTS.has(out)).toBe(true);
      // The output is one of the four legal values — nothing else.
      const asString = String(out);
      expect(asString).not.toContain("OTHER_AGENT_UUID");
      expect(asString).not.toContain("ANOTHER_AGENT_UUID");
    }
  });
});

describe("R3A — sanitized output never includes broker-only IDs", () => {
  it("ClientListItem shape excludes assigned_agent_id / claimed_by / visibility / status", () => {
    // Boundary check — verify SAFE_COLUMNS selects those fields for
    // the access check but sanitizeListItem strips them.
    const fs = require("fs");
    const path = require("path");
    const loaderSrc = fs.readFileSync(
      path.join(process.cwd(), "src/portal/clients/loader.ts"),
      "utf-8"
    );
    const sanitizeBlock = loaderSrc.match(/function sanitizeListItem[\s\S]*?return\s*\{([\s\S]*?)\};\s*\}/);
    expect(sanitizeBlock).not.toBeNull();
    const body = sanitizeBlock![1];
    expect(body.includes("assigned_agent_id")).toBe(false);
    expect(body.includes("claimed_by")).toBe(false);
    expect(body.includes("visibility")).toBe(false);
    expect(/(^|\s)status:/.test(body)).toBe(false);
  });
});

describe("Label translations", () => {
  it("profileTypeLabel", () => {
    expect(profileTypeLabel("buyer")).toBe("Buyer");
    expect(profileTypeLabel("seller")).toBe("Seller");
    expect(profileTypeLabel("investor")).toBe("Investor");
    expect(profileTypeLabel(null)).toBe("—");
  });
  it("temperatureLabel", () => {
    expect(temperatureLabel("hot")).toBe("Hot");
    expect(temperatureLabel("warm")).toBe("Warm");
    expect(temperatureLabel("cold")).toBe("Cold");
    expect(temperatureLabel(null)).toBe("—");
  });
  it("channelLabel", () => {
    expect(channelLabel("phone")).toBe("Phone");
    expect(channelLabel("email")).toBe("Email");
    expect(channelLabel("text")).toBe("Text");
    expect(channelLabel(null)).toBe("—");
  });
  it("representationLabel collapses 'Unknown' to em-dash", () => {
    expect(representationLabel("Unknown")).toBe("—");
    expect(representationLabel(null)).toBe("—");
    expect(representationLabel("Buyer's Agent")).toBe("Buyer's Agent");
  });
});

describe("relativeUpdated", () => {
  const now = new Date("2026-06-25T08:00:00Z");
  it("just now / m / h / d / older", () => {
    expect(relativeUpdated("2026-06-25T07:59:50Z", now)).toBe("just now");
    expect(relativeUpdated("2026-06-25T07:30:00Z", now)).toBe("30m ago");
    expect(relativeUpdated("2026-06-25T03:00:00Z", now)).toBe("5h ago");
    expect(relativeUpdated("2026-06-23T08:00:00Z", now)).toBe("2d ago");
    expect(relativeUpdated("2026-04-01T00:00:00Z", now)).toMatch(/(Mar|Apr|2026)/);
  });
  it("null / invalid → em-dash", () => {
    expect(relativeUpdated(null)).toBe("—");
    expect(relativeUpdated("garbage", now)).toBe("—");
  });
});

describe("formatBudgetRange", () => {
  it("matches AP2.1D semantics", () => {
    expect(formatBudgetRange(null, null)).toBeNull();
    expect(formatBudgetRange(500_000, null)).toBe("$500K+");
    expect(formatBudgetRange(null, 900_000)).toBe("Up to $900K");
    expect(formatBudgetRange(750_000, 1_250_000)).toBe("$750K – $1.3M");
  });
});

describe("AP2.1G clients boundary lint", () => {
  it("loader is server-only + sanitized + no writes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/clients/loader.ts"),
      "utf-8"
    );
    // server-only marker
    expect(src).toMatch(/import\s+["']server-only["']/);
    // No DB writes
    expect(src.includes(".insert(")).toBe(false);
    expect(src.includes(".update(")).toBe(false);
    expect(src.includes(".upsert(")).toBe(false);
    expect(src.includes(".delete(")).toBe(false);
    expect(src.includes(".rpc(")).toBe(false);
    // No POST verbs
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
    // Broker-only fields must NOT be in the SAFE_COLUMNS list
    const forbidden = ["broker_notes", "red_flags", "profitability", "commission"];
    for (const col of forbidden) {
      // The string may appear in a code comment, but must NOT be in the
      // SAFE_COLUMNS list (the only place columns are selected from).
      const safeColumnsBlock = src.match(/SAFE_COLUMNS\s*=\s*\[([\s\S]*?)\]\.join/);
      expect(safeColumnsBlock).not.toBeNull();
      const inSafeList = safeColumnsBlock?.[1].includes(`"${col}"`) ?? true;
      expect(inSafeList).toBe(false);
    }
  });

  it("client pages have no writes / no new API fetches", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      "app/(portal)/clients/page.tsx",
      "app/(portal)/clients/[clientId]/page.tsx",
      "src/portal/clients/ClientsClient.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src.includes(".insert(")).toBe(false);
      expect(src.includes(".update(")).toBe(false);
      expect(src.includes(".upsert(")).toBe(false);
      expect(src.includes(".delete(")).toBe(false);
      expect(src.includes(".rpc(")).toBe(false);
      expect(src).not.toMatch(/method:\s*['"]POST['"]/);
      expect(src).not.toMatch(/fetch\(\s*['"]\/api\/portal/);
    }
  });
});
