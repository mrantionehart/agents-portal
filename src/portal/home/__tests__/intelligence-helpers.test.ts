/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.1 — R6 — Home Intelligence helpers + boundary lint
// ============================================================================

import {
  buildHotLeads,
  formatPrice,
  leadKindLabel,
  pipelineSnapshot,
  productionSnapshot,
  relativeTime,
  topNews,
  topRadar,
} from "../intelligence-helpers";
import type { NewsArticle, RadarDevelopment } from "../intelligence-types";
import type { WorkspaceCard } from "../../workspace/types";

function card(over: Partial<WorkspaceCard> = {}): WorkspaceCard {
  return {
    transaction_id: "t1",
    transaction_type: "lease",
    property_address: "100 Brickell",
    client_name: "Test",
    readiness_score: 50,
    readiness_tier: "collecting",
    stage: "drafting",
    next_action: "continue_collection",
    suggested_prompt: "",
    required_forms_count: 3,
    ready_forms_count: 0,
    signed_forms_count: 0,
    blocked_forms_count: 0,
    pending_envelopes_count: 0,
    portal_status: "none",
    risk_tier: "unknown",
    broker_confirmation_required: true,
    ...over,
  };
}

describe("productionSnapshot", () => {
  it("counts active / review / signature / blocked / signed", () => {
    const cards = [
      card({ stage: "drafting" }),                                          // active
      card({ stage: "collecting", readiness_tier: "ready_for_review" }),    // active + review
      card({ stage: "broker_review", readiness_tier: "ready_for_signature" }), // active + signature
      card({ stage: "drafting", blocked_forms_count: 2 }),                  // active + blocked
      card({ stage: "completed", required_forms_count: 2, signed_forms_count: 2 }), // signed, not active
    ];
    const out = productionSnapshot(cards);
    expect(out.active).toBe(4);
    expect(out.ready_for_review).toBe(1);
    expect(out.ready_for_signature).toBe(1);
    expect(out.blocked).toBe(1);
    expect(out.signed).toBe(1);
  });
  it("empty → all zeros", () => {
    expect(productionSnapshot([])).toEqual({
      active: 0,
      ready_for_review: 0,
      ready_for_signature: 0,
      blocked: 0,
      signed: 0,
    });
  });
  it("required_forms_count=0 never counts as signed (no false positives)", () => {
    expect(productionSnapshot([card({ required_forms_count: 0, signed_forms_count: 0 })]).signed).toBe(0);
  });
});

describe("pipelineSnapshot", () => {
  it("maps each stage to its bucket", () => {
    const cards = [
      card({ stage: "drafting" }),
      card({ stage: "drafting" }),
      card({ stage: "collecting" }),
      card({ stage: "broker_review" }),
      card({ stage: "signature" }),
      card({ stage: "completed" }),
    ];
    expect(pipelineSnapshot(cards)).toEqual({
      drafting: 2,
      collecting: 1,
      broker_review: 1,
      signature: 1,
      completed: 1,
    });
  });
  it("aliases broker review variants + signature variants + closed", () => {
    expect(
      pipelineSnapshot([
        card({ stage: "in_review" }),
        card({ stage: "ready_for_review" }),
        card({ stage: "envelope_sent" }),
        card({ stage: "ready_for_signature" }),
        card({ stage: "closed" }),
      ])
    ).toEqual({
      drafting: 0,
      collecting: 0,
      broker_review: 2,
      signature: 2,
      completed: 1,
    });
  });
  it("unknown stages fall through to drafting (totals always add up)", () => {
    const out = pipelineSnapshot([card({ stage: "weird_state" })]);
    expect(out.drafting).toBe(1);
    expect(out.drafting + out.collecting + out.broker_review + out.signature + out.completed).toBe(1);
  });
  it("case-insensitive + space/hyphen tolerant", () => {
    expect(
      pipelineSnapshot([
        card({ stage: "Broker Review" }),
        card({ stage: "broker-review" }),
      ])
    ).toMatchObject({ broker_review: 2 });
  });
});

describe("topNews", () => {
  const A = (pubDate: string, title: string): NewsArticle => ({
    title,
    link: "https://x",
    description: "",
    pubDate,
    source: "s",
  });
  it("sorts newest-first + caps at max", () => {
    const items = [
      A("2026-06-20T00:00:00Z", "older"),
      A("2026-06-25T00:00:00Z", "newer"),
      A("2026-06-22T00:00:00Z", "middle"),
    ];
    expect(topNews(items, 2).map((x) => x.title)).toEqual(["newer", "middle"]);
  });
  it("does not mutate input", () => {
    const items = [A("2026-06-20T00:00:00Z", "A"), A("2026-06-25T00:00:00Z", "B")];
    const before = items.map((x) => x.title).join(",");
    topNews(items, 5);
    expect(items.map((x) => x.title).join(",")).toBe(before);
  });
  it("invalid pubDate sinks to bottom", () => {
    const items = [A("not a date", "bad"), A("2026-06-25T00:00:00Z", "good")];
    expect(topNews(items, 5)[0].title).toBe("good");
  });
});

describe("topRadar", () => {
  it("caps at max", () => {
    const items = Array.from({ length: 10 }, (_, i): RadarDevelopment => ({
      id: String(i),
      project_name: `P${i}`,
      city: null,
      county: null,
      status: null,
      units: null,
      asset_type: null,
      developer: null,
    }));
    expect(topRadar(items, 3).length).toBe(3);
  });
});

describe("buildHotLeads", () => {
  const ts = (s: string) => new Date(s).getTime();

  it("emits one per kind in order (assigned, claimed, intake)", () => {
    const out = buildHotLeads({
      assignedClients: [
        { id: "a1", full_name: "Alice", email: "a@x.com", updated_at: "2026-06-24T08:00:00Z" },
        { id: "a2", full_name: "Ana",   email: "a2@x.com", updated_at: "2026-06-25T08:00:00Z" },
      ],
      claimedLeads: [
        { id: "c1", name: "Carl", email: "c@x.com", source: "fb", created_at: "2026-06-23T08:00:00Z" },
      ],
      intakes: [
        { id: "i1", full_name: "Ian", email: "i@x.com", created_at: "2026-06-22T08:00:00Z" },
      ],
      maxPerKind: 5,
    });
    // Order: all assigned → all claimed → all intakes.
    expect(out.map((x) => x.kind)).toEqual(["assigned", "assigned", "claimed", "intake"]);
    // Within "assigned": newest first.
    expect(out[0].name).toBe("Ana");
    expect(out[1].name).toBe("Alice");
  });
  it("respects maxPerKind", () => {
    const out = buildHotLeads({
      assignedClients: Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        full_name: `A${i}`,
        email: null,
        updated_at: `2026-06-${String(10 + i).padStart(2, "0")}T08:00:00Z`,
      })),
      claimedLeads: [],
      intakes: [],
      maxPerKind: 3,
    });
    expect(out.length).toBe(3);
    expect(out.every((x) => x.kind === "assigned")).toBe(true);
  });
  it("strips foreign agent_ids/posted_by — outputs caller-relative only", () => {
    // The HotLeadItem shape never carries posted_by / claimed_by;
    // kind is a literal ('assigned'|'claimed'|'intake'). This test
    // pins that property at the boundary.
    const out = buildHotLeads({
      assignedClients: [{ id: "a1", full_name: "X", email: null, updated_at: null }],
      claimedLeads: [{ id: "c1", name: "X", email: null, source: null, created_at: "" }],
      intakes: [{ id: "i1", full_name: "X", email: null, created_at: "" }],
      maxPerKind: 5,
    });
    for (const item of out) {
      expect(["assigned", "claimed", "intake"]).toContain(item.kind);
      expect("posted_by" in item).toBe(false);
      expect("claimed_by" in item).toBe(false);
      expect("agent_id" in item).toBe(false);
    }
  });
  it("assigned items deep-link to /clients/<id>", () => {
    const out = buildHotLeads({
      assignedClients: [{ id: "a1", full_name: "X", email: null, updated_at: null }],
      claimedLeads: [],
      intakes: [],
      maxPerKind: 5,
    });
    expect(out[0].open_url).toBe("/clients/a1");
  });
  it("empty input → empty output", () => {
    expect(buildHotLeads({ assignedClients: [], claimedLeads: [], intakes: [], maxPerKind: 5 })).toEqual([]);
  });
});

describe("labels + formatters", () => {
  it("leadKindLabel", () => {
    expect(leadKindLabel("assigned")).toBe("Newly assigned");
    expect(leadKindLabel("claimed")).toBe("You claimed");
    expect(leadKindLabel("intake")).toBe("Recent intake");
  });
  it("formatPrice", () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
    expect(formatPrice(500_000)).toBe("$500K");
    expect(formatPrice(1_250_000)).toBe("$1.3M");
    expect(formatPrice(750)).toBe("$750");
  });
  it("relativeTime", () => {
    const now = new Date("2026-06-25T08:00:00Z");
    expect(relativeTime("2026-06-25T07:59:50Z", now)).toBe("just now");
    expect(relativeTime("2026-06-25T07:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-06-25T03:00:00Z", now)).toBe("5h ago");
    expect(relativeTime("2026-06-23T08:00:00Z", now)).toBe("2d ago");
    expect(relativeTime("garbage", now)).toBe("—");
    expect(relativeTime(null, now)).toBe("—");
  });
});

describe("R6 boundary lint — read-only, no writes, no new APIs", () => {
  it("intelligence-api.ts is server-only + no writes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/home/intelligence-api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.insert\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.update\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.upsert\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.delete\(/);
    expect(src).not.toMatch(/\.rpc\(['"]/);
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it("intelligence-api.ts hits ONLY the existing approved endpoints", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/home/intelligence-api.ts"),
      "utf-8"
    );
    const fetches = [...src.matchAll(/fetch\(\s*`([^`]+)`/g)].map((m) => m[1]);
    expect(fetches.length).toBe(4);
    // 1. /api/news?limit=…  — existing public proxy
    expect(fetches.some((f) => f.includes("/api/news?limit="))).toBe(true);
    // 2. Vault /api/development-radar — existing read endpoint
    expect(fetches.some((f) => f.includes("/development-radar"))).toBe(true);
    // 3. agents-portal /api/new-leads?filter=mine — existing R3B endpoint
    expect(fetches.some((f) => f.includes("/api/new-leads?filter=mine"))).toBe(true);
    // 4. agents-portal /api/broker/intakes — existing R3B proxy
    expect(fetches.some((f) => f.includes("/api/broker/intakes"))).toBe(true);
    // None of these are new — every URL above existed before R6.
    const allowedSubstrings = ["/api/news?limit=", "/development-radar", "/api/new-leads?filter=mine", "/api/broker/intakes"];
    for (const f of fetches) {
      expect(allowedSubstrings.some((s) => f.includes(s))).toBe(true);
    }
  });

  it("IntelligenceWidgets + page have no mutation chains, no buttons-with-onClick", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/home/IntelligenceWidgets.tsx",
      "src/portal/home/intelligence-helpers.ts",
      "src/portal/home/intelligence-types.ts",
      "app/(portal)/home/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.insert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.update\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.upsert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.delete\(/);
      expect(src).not.toMatch(/\.rpc\(['"]/);
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    }
  });

  it("IntelligenceWidgets renders NO claim / assign / convert / send buttons", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/home/IntelligenceWidgets.tsx"),
      "utf-8"
    );
    const codeOnly = src.replace(/^\/\/[\s\S]*?(?=\n[a-zA-Z])/, "");
    expect(codeOnly).not.toMatch(/>\s*Claim Lead\s*</i);
    expect(codeOnly).not.toMatch(/>\s*Assign\s*</i);
    expect(codeOnly).not.toMatch(/>\s*Convert to Transaction\s*</i);
    expect(codeOnly).not.toMatch(/>\s*Send\s*</i);
    expect(codeOnly).not.toMatch(/<button[\s\S]*?onClick=/);
    expect(codeOnly).not.toMatch(/\b(handleClaim|handleAssign|handleConvert|handleSend)\b/i);
    expect(codeOnly).not.toMatch(/action:\s*['"](claim|unclaim|assign|convert)['"]/i);
  });

  it("no email/SMS/push/realtime/cron in R6 surfaces", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/home/IntelligenceWidgets.tsx",
      "src/portal/home/intelligence-api.ts",
      "src/portal/home/intelligence-helpers.ts",
      "src/portal/home/intelligence-types.ts",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/sendgrid|twilio|onesignal|firebase\/messaging|resend|mailgun/i);
      expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
      expect(src).not.toMatch(/cron|CronCreate|setInterval\(|setTimeout\(/);
    }
  });
});
