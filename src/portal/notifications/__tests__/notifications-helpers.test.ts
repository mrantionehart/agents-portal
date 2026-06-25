/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — AP2.1F — Notifications helpers tests
// ============================================================================

import {
  applyFilters,
  categoryFor,
  iconFor,
  inboxCounts,
  linkTargetFor,
  timeAgo,
  type NotificationRow,
} from "../notifications-helpers";

function n(over: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "n1",
    user_id: "u1",
    title: "Hello",
    body: "Body",
    type: "deal",
    read_at: null,
    created_at: "2026-06-25T08:00:00Z",
    metadata: null,
    ...over,
  };
}

describe("categoryFor — type → category mapping", () => {
  it.each([
    ["deal", "transactions"],
    ["lead", "transactions"],
    ["commission", "transactions"],
    ["compliance", "paperwork"],
    ["signature", "paperwork"],
    ["envelope", "paperwork"],
    ["portal", "paperwork"],
    ["paperwork", "paperwork"],
    ["training", "system"],
    ["event", "system"],
    ["chat", "system"],
    ["system", "system"],
    ["unknown_type", "other"],
  ])("type=%s → %s", (type, expected) => {
    expect(categoryFor(type)).toBe(expected);
  });
});

describe("applyFilters", () => {
  const set: NotificationRow[] = [
    n({ id: "a", type: "deal", read_at: null }),
    n({ id: "b", type: "compliance", read_at: "2026-06-25T07:00:00Z" }),
    n({ id: "c", type: "training", read_at: null }),
    n({ id: "d", type: "unknown_type", read_at: null }),
  ];

  it("status=all + category=all → identity", () => {
    expect(applyFilters(set, { status: "all", category: "all" }).length).toBe(4);
  });
  it("status=unread → excludes read_at!=null", () => {
    expect(applyFilters(set, { status: "unread", category: "all" }).map((x) => x.id)).toEqual([
      "a",
      "c",
      "d",
    ]);
  });
  it("category=transactions → only deal/lead/commission", () => {
    expect(applyFilters(set, { status: "all", category: "transactions" }).map((x) => x.id)).toEqual(["a"]);
  });
  it("category=paperwork → only paperwork-flavored", () => {
    expect(applyFilters(set, { status: "all", category: "paperwork" }).map((x) => x.id)).toEqual(["b"]);
  });
  it("category=system → system + other (catch-all)", () => {
    expect(applyFilters(set, { status: "all", category: "system" }).map((x) => x.id).sort()).toEqual([
      "c",
      "d",
    ]);
  });
  it("combined unread + transactions", () => {
    expect(
      applyFilters(set, { status: "unread", category: "transactions" }).map((x) => x.id)
    ).toEqual(["a"]);
  });
});

describe("inboxCounts", () => {
  it("counts by status + category", () => {
    const c = inboxCounts([
      n({ type: "deal", read_at: null }),
      n({ type: "deal", read_at: "2026-06-25T07:00:00Z" }),
      n({ type: "compliance", read_at: null }),
      n({ type: "training", read_at: null }),
      n({ type: "unknown_type", read_at: null }),
    ]);
    expect(c).toEqual({
      total: 5,
      unread: 4,
      transactions: 2,
      paperwork: 1,
      system: 2, // training + unknown_type (system catches "other")
    });
  });
  it("empty → all zeros", () => {
    expect(inboxCounts([])).toEqual({
      total: 0,
      unread: 0,
      transactions: 0,
      paperwork: 0,
      system: 0,
    });
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-06-25T08:00:00Z");
  it("just now", () => {
    expect(timeAgo("2026-06-25T07:59:50Z", now)).toBe("just now");
  });
  it("minutes ago", () => {
    expect(timeAgo("2026-06-25T07:30:00Z", now)).toBe("30m ago");
  });
  it("hours ago", () => {
    expect(timeAgo("2026-06-25T03:00:00Z", now)).toBe("5h ago");
  });
  it("days ago", () => {
    expect(timeAgo("2026-06-23T08:00:00Z", now)).toBe("2d ago");
  });
  it("older → localized date string", () => {
    expect(timeAgo("2026-05-01T00:00:00Z", now)).toMatch(/(May|Apr)/);
  });
  it("invalid input → empty", () => {
    expect(timeAgo("not a date", now)).toBe("");
  });
});

describe("iconFor", () => {
  it("known types map to documented icons", () => {
    expect(iconFor("deal")).toBe("💼");
    expect(iconFor("commission")).toBe("💰");
    expect(iconFor("lead")).toBe("👤");
    expect(iconFor("compliance")).toBe("📋");
    expect(iconFor("training")).toBe("📚");
    expect(iconFor("chat")).toBe("💬");
    expect(iconFor("event")).toBe("📅");
    expect(iconFor("signature")).toBe("✍️");
    expect(iconFor("envelope")).toBe("📨");
    expect(iconFor("portal")).toBe("🪪");
  });
  it("unknown → 🔔 default", () => {
    expect(iconFor("unknown")).toBe("🔔");
  });
});

describe("linkTargetFor", () => {
  const validUuid = "11111111-1111-4111-9111-111111111111";

  it("metadata.transaction_id (UUID) → /workspace/<id>", () => {
    expect(linkTargetFor(n({ metadata: { transaction_id: validUuid } }))).toBe(
      `/workspace/${validUuid}`
    );
  });
  it("metadata.txnId (UUID) → /workspace/<id>", () => {
    expect(linkTargetFor(n({ metadata: { txnId: validUuid } }))).toBe(`/workspace/${validUuid}`);
  });
  it("non-UUID id → null (safety)", () => {
    expect(linkTargetFor(n({ metadata: { transaction_id: "not-a-uuid" } }))).toBeNull();
  });
  it("no metadata → null", () => {
    expect(linkTargetFor(n({ metadata: null }))).toBeNull();
    expect(linkTargetFor(n({ metadata: undefined as any }))).toBeNull();
  });
  it("empty object → null", () => {
    expect(linkTargetFor(n({ metadata: {} }))).toBeNull();
  });
});

describe("AP2.1F boundary lint — no realtime / no new APIs / no migrations / safe mutations only", () => {
  it("helper file has zero side effects (pure functions only)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/notifications/notifications-helpers.ts"),
      "utf-8"
    );
    expect(src.includes(".insert(")).toBe(false);
    expect(src.includes(".update(")).toBe(false);
    expect(src.includes(".upsert(")).toBe(false);
    expect(src.includes(".delete(")).toBe(false);
    expect(src.includes(".rpc(")).toBe(false);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
    expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
  });

  it("page reuses the legacy safe mark-read pattern only — no new mutation surface", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/notifications/page.tsx"),
      "utf-8"
    );
    // No realtime subscriptions.
    expect(src).not.toMatch(/\.channel\(|onPostgresChanges|supabase\.channel/);
    // No POST to /api/portal/* — the page may UPDATE the notifications
    // table directly via Supabase (legacy pattern); that's the only
    // allowed write.
    expect(src).not.toMatch(/fetch\(\s*['"]\/api\/portal/);
    // Mark-read updates must hit ONLY the notifications table — no
    // insert/upsert/delete/rpc anywhere.
    expect(src.includes(".insert(")).toBe(false);
    expect(src.includes(".upsert(")).toBe(false);
    expect(src.includes(".delete(")).toBe(false);
    expect(src.includes(".rpc(")).toBe(false);
    // The two updates that ARE permitted (single + all) both target the
    // `notifications` table.
    const updates = src.match(/\.update\(\s*\{\s*read_at/g) ?? [];
    expect(updates.length).toBeGreaterThanOrEqual(1);
    // No paperwork-engine imports.
    expect(src).not.toMatch(/from\s+['"][^'"]*paperwork[^'"]*['"]/);
    // No push / email / SMS / cron client imports.
    expect(src).not.toMatch(/from\s+['"][^'"]*(sendgrid|twilio|onesignal|firebase\/messaging)/i);
  });
});
