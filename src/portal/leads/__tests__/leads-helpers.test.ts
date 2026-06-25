/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.1 — R3B — Leads helpers + boundary lint
// ============================================================================

import {
  applyIntakeFilters,
  applyLeadFilters,
  claimBucketLabel,
  deriveClaimBucket,
  intakeStatusLabel,
  leadStatusLabel,
  leadsCounts,
  relativeCreated,
  sanitizeIntake,
  sanitizeLead,
} from "../helpers";
import type { IntakeListItem, IntakeRow, LeadListItem, LeadRow } from "../types";

function rawLead(over: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "L1",
    name: "Alex",
    email: "alex@example.com",
    phone: "+13055551111",
    source: "facebook",
    status: "available",
    notes: "Looking near Brickell, 2bd",
    property_address: "100 Brickell",
    property_city: "Miami",
    property_state: "FL",
    budget_min: 500_000,
    budget_max: 750_000,
    claimed_by: null,
    claimed_by_name: null,
    claimed_at: null,
    created_at: "2026-06-25T08:00:00Z",
    posted_by: "POSTER_UUID",
    ...over,
  };
}

function rawIntake(over: Partial<IntakeRow> = {}): IntakeRow {
  return {
    id: "I1",
    full_name: "Bea",
    email: "bea@example.com",
    phone: "+13055552222",
    property_type: "condo",
    motivation: "Relocating for work",
    budget_range: "$500K – $750K",
    timeline: "3 months",
    notes: "Wants city view, parking",
    status: "new",
    agent_id: "AGENT_ME",
    created_at: "2026-06-25T07:00:00Z",
    ...over,
  };
}

describe("deriveClaimBucket", () => {
  it.each([
    [null, "ME", "unclaimed"],
    ["ME", "ME", "claimed_by_me"],
    ["OTHER", "ME", "claimed_by_other"],
  ])("claimed_by=%s caller=%s → %s", (claimed_by, caller, expected) => {
    expect(deriveClaimBucket({ claimed_by: claimed_by as string | null }, caller)).toBe(expected);
  });
  it("does NOT leak other-user UUIDs in output", () => {
    const VALID = new Set(["claimed_by_me", "claimed_by_other", "unclaimed"]);
    const out = deriveClaimBucket({ claimed_by: "OTHER_AGENT_UUID" }, "ME");
    expect(VALID.has(out)).toBe(true);
    expect(out).not.toContain("OTHER_AGENT_UUID");
  });
});

describe("sanitizeLead", () => {
  it("formats budget, address, notes preview", () => {
    const out = sanitizeLead(rawLead(), "ME");
    expect(out.id).toBe("L1");
    expect(out.budget).toBe("$500K – $750K");
    expect(out.property).toBe("100 Brickell, Miami, FL");
    expect(out.notes_preview).toBe("Looking near Brickell, 2bd");
    expect(out.claimBucket).toBe("unclaimed");
  });
  it("trims long notes to a preview", () => {
    const long = "x".repeat(500);
    const out = sanitizeLead(rawLead({ notes: long }), "ME");
    expect(out.notes_preview?.length).toBeLessThanOrEqual(141);
    expect(out.notes_preview?.endsWith("…")).toBe(true);
  });
  it("strips posted_by + claimed_by from output", () => {
    const out = sanitizeLead(rawLead({ claimed_by: "OTHER", claimed_by_name: "Other Agent" }), "ME");
    expect("posted_by" in out).toBe(false);
    expect("claimed_by" in out).toBe(false);
    expect(out.claimBucket).toBe("claimed_by_other");
    // claimed_by_name (display label, not a UUID) is allowed.
    expect(out.claimed_by_name).toBe("Other Agent");
  });
  it("partial budget formats correctly", () => {
    expect(sanitizeLead(rawLead({ budget_min: 500_000, budget_max: null }), "ME").budget).toBe("$500K+");
    expect(sanitizeLead(rawLead({ budget_min: null, budget_max: 800_000 }), "ME").budget).toBe("Up to $800K");
    expect(sanitizeLead(rawLead({ budget_min: null, budget_max: null }), "ME").budget).toBeNull();
  });
});

describe("sanitizeIntake", () => {
  it("derives isOwnIntake correctly", () => {
    expect(sanitizeIntake(rawIntake(), "AGENT_ME").isOwnIntake).toBe(true);
    expect(sanitizeIntake(rawIntake({ agent_id: "OTHER" }), "AGENT_ME").isOwnIntake).toBe(false);
    expect(sanitizeIntake(rawIntake({ agent_id: null }), "AGENT_ME").isOwnIntake).toBe(false);
  });
  it("strips agent_id from output", () => {
    const out = sanitizeIntake(rawIntake(), "AGENT_ME");
    expect("agent_id" in out).toBe(false);
  });
});

describe("applyLeadFilters", () => {
  const leads: LeadListItem[] = [
    sanitizeLead(rawLead({ id: "u1", claimed_by: null, name: "Alice" }), "ME"),
    sanitizeLead(rawLead({ id: "u2", claimed_by: null, name: "Adam", email: "adam@x.com" }), "ME"),
    sanitizeLead(rawLead({ id: "m1", claimed_by: "ME", claimed_by_name: "Me", name: "Mona" }), "ME"),
    sanitizeLead(rawLead({ id: "o1", claimed_by: "OTHER", claimed_by_name: "Other", name: "Olive" }), "ME"),
  ];

  it("all → all leads", () => {
    expect(applyLeadFilters(leads, { filter: "all", search: "" }).length).toBe(4);
  });
  it("unclaimed → only unclaimed", () => {
    expect(
      applyLeadFilters(leads, { filter: "unclaimed", search: "" }).map((l) => l.id).sort()
    ).toEqual(["u1", "u2"]);
  });
  it("claimed_by_me → only mine", () => {
    expect(
      applyLeadFilters(leads, { filter: "claimed_by_me", search: "" }).map((l) => l.id)
    ).toEqual(["m1"]);
  });
  it("intakes → empty (leads list never renders under intakes filter)", () => {
    expect(applyLeadFilters(leads, { filter: "intakes", search: "" })).toEqual([]);
  });
  it("search matches name, email, phone, property, notes", () => {
    expect(applyLeadFilters(leads, { filter: "all", search: "adam@x.com" }).map((l) => l.id)).toEqual(["u2"]);
    expect(applyLeadFilters(leads, { filter: "all", search: "olive" }).map((l) => l.id)).toEqual(["o1"]);
    expect(applyLeadFilters(leads, { filter: "all", search: "brickell" }).map((l) => l.id).sort()).toEqual(["m1","o1","u1","u2"]);
  });
  it("search AND-composes with filter", () => {
    expect(
      applyLeadFilters(leads, { filter: "unclaimed", search: "alice" }).map((l) => l.id)
    ).toEqual(["u1"]);
  });
});

describe("applyIntakeFilters", () => {
  const intakes: IntakeListItem[] = [
    sanitizeIntake(rawIntake({ id: "i1", full_name: "Bea" }), "ME"),
    sanitizeIntake(rawIntake({ id: "i2", full_name: "Carl", email: "carl@x.com" }), "ME"),
  ];

  it("all → all intakes (Intakes panel renders alongside leads)", () => {
    expect(applyIntakeFilters(intakes, { filter: "all", search: "" }).length).toBe(2);
  });
  it("intakes → all intakes (panel-only view)", () => {
    expect(applyIntakeFilters(intakes, { filter: "intakes", search: "" }).length).toBe(2);
  });
  it("unclaimed → empty (intakes panel hidden under unclaimed)", () => {
    expect(applyIntakeFilters(intakes, { filter: "unclaimed", search: "" })).toEqual([]);
  });
  it("claimed_by_me → empty (intakes panel hidden under claimed_by_me)", () => {
    expect(applyIntakeFilters(intakes, { filter: "claimed_by_me", search: "" })).toEqual([]);
  });
  it("search across name + email", () => {
    expect(applyIntakeFilters(intakes, { filter: "all", search: "carl@x" }).map((i) => i.id)).toEqual(["i2"]);
    expect(applyIntakeFilters(intakes, { filter: "all", search: "Bea" }).map((i) => i.id)).toEqual(["i1"]);
  });
});

describe("leadsCounts", () => {
  it("counts each bucket + intakes total", () => {
    const leads: LeadListItem[] = [
      sanitizeLead(rawLead({ id: "u1", claimed_by: null }), "ME"),
      sanitizeLead(rawLead({ id: "u2", claimed_by: null }), "ME"),
      sanitizeLead(rawLead({ id: "m1", claimed_by: "ME" }), "ME"),
      sanitizeLead(rawLead({ id: "o1", claimed_by: "OTHER" }), "ME"),
    ];
    const intakes: IntakeListItem[] = [
      sanitizeIntake(rawIntake({ id: "i1" }), "ME"),
      sanitizeIntake(rawIntake({ id: "i2" }), "ME"),
      sanitizeIntake(rawIntake({ id: "i3" }), "ME"),
    ];
    expect(leadsCounts(leads, intakes)).toEqual({
      totalLeads: 4,
      unclaimed: 2,
      claimedByMe: 1,
      totalIntakes: 3,
    });
  });
  it("empty → zero", () => {
    expect(leadsCounts([], [])).toEqual({
      totalLeads: 0,
      unclaimed: 0,
      claimedByMe: 0,
      totalIntakes: 0,
    });
  });
});

describe("labels", () => {
  it("leadStatusLabel known values", () => {
    expect(leadStatusLabel("available")).toBe("Available");
    expect(leadStatusLabel("new")).toBe("Available");
    expect(leadStatusLabel("claimed")).toBe("Claimed");
    expect(leadStatusLabel("converted")).toBe("Converted");
    expect(leadStatusLabel(null)).toBe("—");
  });
  it("intakeStatusLabel known values", () => {
    expect(intakeStatusLabel("new")).toBe("New");
    expect(intakeStatusLabel("contacted")).toBe("Contacted");
    expect(intakeStatusLabel("converted")).toBe("Converted");
    expect(intakeStatusLabel(null)).toBe("—");
  });
  it("claimBucketLabel", () => {
    expect(claimBucketLabel("claimed_by_me")).toBe("Claimed by you");
    expect(claimBucketLabel("claimed_by_other")).toBe("Claimed");
    expect(claimBucketLabel("unclaimed")).toBe("Unclaimed");
  });
});

describe("relativeCreated", () => {
  const now = new Date("2026-06-25T08:00:00Z");
  it("just now / m / h / d / older", () => {
    expect(relativeCreated("2026-06-25T07:59:50Z", now)).toBe("just now");
    expect(relativeCreated("2026-06-25T07:30:00Z", now)).toBe("30m ago");
    expect(relativeCreated("2026-06-25T03:00:00Z", now)).toBe("5h ago");
    expect(relativeCreated("2026-06-23T08:00:00Z", now)).toBe("2d ago");
    expect(relativeCreated("garbage", now)).toBe("—");
    expect(relativeCreated(null, now)).toBe("—");
  });
});

describe("R3B boundary lint — read-only, no email/SMS, no claim/assign/convert", () => {
  it("intakes proxy is GET-only + uses adminClient with explicit reason", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/broker/intakes/route.ts"),
      "utf-8"
    );
    expect(src).toMatch(/export async function GET/);
    expect(src).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(src.includes(".insert(")).toBe(false);
    expect(src.includes(".update(")).toBe(false);
    expect(src.includes(".upsert(")).toBe(false);
    expect(src.includes(".delete(")).toBe(false);
    expect(src.includes(".rpc(")).toBe(false);
    expect(src).not.toMatch(/fetch\(/);
    expect(src).toMatch(/adminClient\(["']r3b-intakes-tenant-scope["']/);
  });

  it("leads loader + client are read-only (no writes, no claim/assign/convert verbs)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/leads/api.ts",
      "src/portal/leads/helpers.ts",
      "src/portal/leads/LeadsClient.tsx",
      "src/portal/clients/ClientsTabs.tsx",
      "app/(portal)/clients/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src.includes(".insert(")).toBe(false);
      expect(src.includes(".update(")).toBe(false);
      expect(src.includes(".upsert(")).toBe(false);
      expect(src.includes(".delete(")).toBe(false);
      expect(src.includes(".rpc(")).toBe(false);
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
      // No mutation action handler names. (Filter state like
      // setFilter("claimed_by_me") is fine; what we're guarding is
      // verbs like handleClaim / handleAssign / claimLead / etc.)
      expect(src).not.toMatch(/\b(handleClaim|onClaim|claimLead|claimAction)\b/i);
      expect(src).not.toMatch(/\b(handleAssign|onAssign|assignLead|assignAction)\b/i);
      expect(src).not.toMatch(/\b(handleConvert|onConvert|convertLead|convertToTransaction)\b/i);
      // No "Convert to Transaction" button copy
      expect(src).not.toMatch(/Convert to Transaction/i);
      // No POST body shape referencing claim/unclaim actions (the
      // legacy /api/new-leads endpoint supports POST, but we must
      // never call it from these surfaces).
      expect(src).not.toMatch(/action:\s*['"](claim|unclaim|assign|convert)['"]/i);
    }
  });

  it("no email / SMS / push send anywhere in R3B surfaces", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "app/api/broker/intakes/route.ts",
      "src/portal/leads/api.ts",
      "src/portal/leads/helpers.ts",
      "src/portal/leads/LeadsClient.tsx",
      "src/portal/clients/ClientsTabs.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(
        /sendgrid|twilio|onesignal|firebase\/messaging|resend|mailgun/i
      );
    }
  });

  it("leads api.ts only hits the two approved same-origin endpoints", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/leads/api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
    const fetches = [...src.matchAll(/fetch\(`([^`]+)`/g)].map((m) => m[1]);
    expect(fetches.length).toBe(2);
    expect(fetches[0].includes("/api/new-leads")).toBe(true);
    expect(fetches[1].includes("/api/broker/intakes")).toBe(true);
  });
});
