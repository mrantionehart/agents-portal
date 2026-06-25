/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.1 — R2B — Detail-helpers + boundary lint
// ============================================================================

import {
  buildActivityTimeline,
  lastViewedAt,
  maskEmail,
  sortViewsNewestFirst,
  summarizeFeedback,
} from "../detail-helpers";
import type {
  PortalFeedbackPayload,
  PortalViewRow,
} from "../detail-types";

function fb(over: Partial<PortalFeedbackPayload> = {}): PortalFeedbackPayload {
  return {
    portal_id: "p1",
    portal_title: "Test Portal",
    total_responses: 2,
    respondents: ["a@x.com", "b@x.com"],
    properties: [
      {
        title: "1155 S Biscayne",
        favorites: 3,
        comments: [
          { name: "Alice", email: "a@x.com", comment: "Love it!", date: "2026-06-25T10:00:00Z" },
        ],
        respondents: ["a@x.com"],
      },
      {
        title: "456 Pine Ave",
        favorites: 1,
        comments: [
          { name: "Bob", email: "b@x.com", comment: "Wrong area.", date: "2026-06-25T11:00:00Z" },
          { name: "Bob", email: "b@x.com", comment: "Re-listing?", date: "2026-06-25T11:30:00Z" },
        ],
        respondents: ["b@x.com"],
      },
    ],
    ...over,
  };
}

function v(over: Partial<PortalViewRow> = {}): PortalViewRow {
  return {
    id: "v1",
    viewed_at: "2026-06-25T12:00:00Z",
    viewer_ip: null,
    viewer_user_agent: null,
    ...over,
  };
}

describe("summarizeFeedback", () => {
  it("sums favorites + comments across properties", () => {
    const s = summarizeFeedback(fb());
    expect(s).toEqual({
      totalFavorites: 4, // 3 + 1
      totalComments: 3,  // 1 + 2
      totalRespondents: 2,
      propertyCount: 2,
      hasFeedback: true,
    });
  });
  it("empty feedback → all zeros + hasFeedback=false", () => {
    expect(summarizeFeedback(null)).toEqual({
      totalFavorites: 0,
      totalComments: 0,
      totalRespondents: 0,
      propertyCount: 0,
      hasFeedback: false,
    });
  });
  it("payload with empty properties → hasFeedback=false", () => {
    const s = summarizeFeedback(fb({ properties: [], total_responses: 0, respondents: [] }));
    expect(s.hasFeedback).toBe(false);
    expect(s.totalFavorites).toBe(0);
    expect(s.totalComments).toBe(0);
  });
});

describe("sortViewsNewestFirst", () => {
  it("sorts descending by viewed_at", () => {
    const sorted = sortViewsNewestFirst([
      v({ id: "older", viewed_at: "2026-06-20T10:00:00Z" }),
      v({ id: "newest", viewed_at: "2026-06-25T10:00:00Z" }),
      v({ id: "middle", viewed_at: "2026-06-23T10:00:00Z" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["newest", "middle", "older"]);
  });
  it("does NOT mutate input", () => {
    const original = [
      v({ id: "older", viewed_at: "2026-06-20T10:00:00Z" }),
      v({ id: "newest", viewed_at: "2026-06-25T10:00:00Z" }),
    ];
    const before = original.map((x) => x.id).join(",");
    sortViewsNewestFirst(original);
    expect(original.map((x) => x.id).join(",")).toBe(before);
  });
});

describe("lastViewedAt", () => {
  it("returns the most recent viewed_at", () => {
    expect(
      lastViewedAt(
        [
          v({ viewed_at: "2026-06-20T10:00:00Z" }),
          v({ viewed_at: "2026-06-25T10:00:00Z" }),
        ],
        null
      )
    ).toBe("2026-06-25T10:00:00Z");
  });
  it("falls back when no views", () => {
    expect(lastViewedAt([], "2026-01-01T00:00:00Z")).toBe("2026-01-01T00:00:00Z");
    expect(lastViewedAt([], null)).toBeNull();
  });
});

describe("maskEmail", () => {
  it.each([
    ["audit@example.com", "a***t@example.com"],
    ["a@b.c", "a@b.c"],
    ["ab@x.com", "a*@x.com"],
    ["alice@hartfelt.com", "a***e@hartfelt.com"],
    [null, "Anonymous"],
    [undefined, "Anonymous"],
    ["", "Anonymous"],
  ])("email=%s → %s", (email, expected) => {
    expect(maskEmail(email as string)).toBe(expected);
  });
});

describe("buildActivityTimeline", () => {
  it("merges views + comments newest-first", () => {
    const timeline = buildActivityTimeline(
      [
        v({ id: "v_late", viewed_at: "2026-06-25T13:00:00Z" }),
        v({ id: "v_early", viewed_at: "2026-06-25T09:00:00Z" }),
      ],
      fb()
    );
    // Expected order by ts desc:
    //  13:00 view, 11:30 comment, 11:00 comment, 10:00 comment, 09:00 view
    expect(timeline.length).toBe(5);
    expect(timeline[0].kind).toBe("view");
    expect(timeline[0].ts).toBe("2026-06-25T13:00:00Z");
    expect(timeline[4].kind).toBe("view");
    expect(timeline[4].ts).toBe("2026-06-25T09:00:00Z");
  });
  it("handles null feedback gracefully", () => {
    const t = buildActivityTimeline([v()], null);
    expect(t.length).toBe(1);
    expect(t[0].kind).toBe("view");
  });
  it("empty views + null feedback → empty timeline", () => {
    expect(buildActivityTimeline([], null)).toEqual([]);
  });
});

describe("R2B boundary lint — read-only, no email/SMS, no mutations", () => {
  it("detail-api.ts only hits the two allowed endpoints", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/portals/detail-api.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
    const fetches = [...src.matchAll(/fetch\(\s*`([^`]+)`/g)].map((m) => m[1]);
    expect(fetches.length).toBe(2);
    // (1) Vault advisor detail
    expect(fetches[0].includes("/deal-portals/advisor/")).toBe(true);
    // (2) agents-portal feedback proxy
    expect(fetches[1].includes("/api/broker/deal-portals/")).toBe(true);
    expect(fetches[1].includes("/feedback")).toBe(true);
    // GETs only — no POST/PUT/PATCH/DELETE/SEND
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it("feedback proxy route is read-only + uses adminClient with explicit reason", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/api/broker/deal-portals/[id]/feedback/route.ts"
      ),
      "utf-8"
    );
    // GET only — no other HTTP verbs exported.
    expect(src).toMatch(/export async function GET/);
    expect(src).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    // No DB writes.
    expect(src.includes(".insert(")).toBe(false);
    expect(src.includes(".update(")).toBe(false);
    expect(src.includes(".upsert(")).toBe(false);
    expect(src.includes(".delete(")).toBe(false);
    expect(src.includes(".rpc(")).toBe(false);
    // No external fetches.
    expect(src).not.toMatch(/fetch\(/);
    // adminClient call carries an explicit, documented intent.
    expect(src).toMatch(/adminClient\(["']r2b-deal-portal-feedback-read["']/);
  });

  it("detail page + client are read-only", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "app/(portal)/workspace/portals/[portalId]/page.tsx",
      "src/portal/portals/PortalDetailClient.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src.includes(".insert(")).toBe(false);
      expect(src.includes(".update(")).toBe(false);
      expect(src.includes(".upsert(")).toBe(false);
      expect(src.includes(".delete(")).toBe(false);
      expect(src.includes(".rpc(")).toBe(false);
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
      // No archive / revoke / regenerate / edit / delete affordances.
      expect(src).not.toMatch(/\bRevoke\b|\bRegenerate\b|\bArchive\b|\bEdit\b/);
    }
  });

  it("no email / SMS / recipient logging anywhere in R2B surfaces", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "app/api/broker/deal-portals/[id]/feedback/route.ts",
      "app/(portal)/workspace/portals/[portalId]/page.tsx",
      "src/portal/portals/detail-api.ts",
      "src/portal/portals/detail-helpers.ts",
      "src/portal/portals/PortalDetailClient.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(
        /sendgrid|twilio|onesignal|firebase\/messaging|resend|mailgun/i
      );
      expect(src).not.toMatch(/deal_portal_recipients/i);
      expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
    }
  });
});
