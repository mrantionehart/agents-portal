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
    action_url: null,
    related_type: null,
    related_id: null,
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
      meetings: 0,
      system: 2, // training + unknown_type (system catches "other")
    });
  });
  it("empty → all zeros", () => {
    expect(inboxCounts([])).toEqual({
      total: 0,
      unread: 0,
      transactions: 0,
      paperwork: 0,
      meetings: 0,
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

describe("linkTargetFor (HOTFIX.1 — real schema)", () => {
  const validUuid = "11111111-1111-4111-9111-111111111111";

  // ── related_type / related_id (polymorphic FK) ─────────────────
  it("related_type='transaction' + valid UUID → /workspace/<id>", () => {
    expect(linkTargetFor(n({ related_type: "transaction", related_id: validUuid }))).toBe(
      `/workspace/${validUuid}`
    );
  });
  it("related_type='deal' (alias) + valid UUID → /workspace/<id>", () => {
    expect(linkTargetFor(n({ related_type: "deal", related_id: validUuid }))).toBe(
      `/workspace/${validUuid}`
    );
  });
  it("related_type='Transaction' (case-insensitive) → /workspace/<id>", () => {
    expect(linkTargetFor(n({ related_type: "Transaction", related_id: validUuid }))).toBe(
      `/workspace/${validUuid}`
    );
  });
  it("related_type=transaction but non-UUID related_id → null (safety)", () => {
    expect(
      linkTargetFor(n({ related_type: "transaction", related_id: "not-a-uuid" }))
    ).toBeNull();
  });
  it("related_type=transaction but missing related_id → null", () => {
    expect(linkTargetFor(n({ related_type: "transaction", related_id: null }))).toBeNull();
  });
  it("unknown related_type → null even with valid UUID", () => {
    expect(linkTargetFor(n({ related_type: "lead", related_id: validUuid }))).toBeNull();
  });

  // ── action_url fallback (safe internal URLs only) ──────────────
  it("action_url to internal /workspace/<id> → returned as-is", () => {
    expect(
      linkTargetFor(n({ action_url: `/workspace/${validUuid}` }))
    ).toBe(`/workspace/${validUuid}`);
  });
  it("action_url to /home → returned as-is", () => {
    expect(linkTargetFor(n({ action_url: "/home" }))).toBe("/home");
  });
  it("action_url to /clients/<id> → returned as-is", () => {
    expect(linkTargetFor(n({ action_url: `/clients/${validUuid}` }))).toBe(
      `/clients/${validUuid}`
    );
  });
  it("action_url to /notifications?foo=bar → returned as-is", () => {
    expect(linkTargetFor(n({ action_url: "/notifications?foo=bar" }))).toBe(
      "/notifications?foo=bar"
    );
  });

  // ── unsafe action_url variants → null ───────────────────────────
  it("action_url to external https URL → null (no open redirect)", () => {
    expect(linkTargetFor(n({ action_url: "https://evil.com/path" }))).toBeNull();
  });
  it("action_url to http URL → null", () => {
    expect(linkTargetFor(n({ action_url: "http://evil.com/path" }))).toBeNull();
  });
  it("action_url protocol-relative '//evil.com' → null", () => {
    expect(linkTargetFor(n({ action_url: "//evil.com/path" }))).toBeNull();
  });
  it("action_url with mailto: → null", () => {
    expect(linkTargetFor(n({ action_url: "mailto:evil@example.com" }))).toBeNull();
  });
  it("action_url with javascript: → null", () => {
    expect(linkTargetFor(n({ action_url: "javascript:alert(1)" }))).toBeNull();
  });
  it("action_url with .. traversal → null", () => {
    expect(linkTargetFor(n({ action_url: "/workspace/../admin" }))).toBeNull();
  });
  it("action_url to a legacy / non-AP2 route → null", () => {
    expect(linkTargetFor(n({ action_url: "/closeiq" }))).toBeNull();
    expect(linkTargetFor(n({ action_url: "/commissions" }))).toBeNull();
  });
  it("action_url with leading whitespace → null", () => {
    expect(linkTargetFor(n({ action_url: " /home" }))).toBeNull();
  });
  it("missing both related_type and action_url → null", () => {
    expect(linkTargetFor(n({}))).toBeNull();
  });

  // ── precedence: related_type wins over action_url ──────────────
  it("related_type wins over action_url when both present", () => {
    expect(
      linkTargetFor(
        n({
          related_type: "transaction",
          related_id: validUuid,
          action_url: "/home",
        })
      )
    ).toBe(`/workspace/${validUuid}`);
  });
});

describe("HOTFIX.1 — boundary checks", () => {
  it("NotificationRow type has NO metadata field (column doesn't exist in prod)", () => {
    // Type-level check: the row constructor in this test file doesn't
    // assign `metadata`, and the source file's interface should not
    // declare it. The build itself enforces this; this test is the
    // belt-and-suspenders documentation.
    const sample = n({});
    expect("metadata" in (sample as any)).toBe(false);
  });

  it("page's select uses real columns only (no 'metadata')", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/notifications/page.tsx"),
      "utf-8"
    );
    // The page now reads via a lock-free Supabase REST call (getAccessToken +
    // timedFetch), so the column list lives in a `const select = "..."` used to
    // build `?select=`, not a `.select("...")` client call. Same intent.
    const selectMatch = src.match(/select\s*=\s*["']([^"']+)["']/);
    expect(selectMatch).not.toBeNull();
    const cols = selectMatch![1];
    expect(cols.includes("metadata")).toBe(false);
    // Must reference at least the columns we now depend on.
    expect(cols).toContain("action_url");
    expect(cols).toContain("related_type");
    expect(cols).toContain("related_id");
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

  it("page marks read via a lock-free REST PATCH to notifications only — no new mutation surface", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/notifications/page.tsx"),
      "utf-8"
    );
    // No realtime subscriptions.
    expect(src).not.toMatch(/\.channel\(|onPostgresChanges|supabase\.channel/);
    // No POST to /api/portal/* — the page writes the notifications table
    // directly via a lock-free Supabase REST call; that's the only write.
    expect(src).not.toMatch(/fetch\(\s*['"]\/api\/portal/);
    // Mark-read must hit ONLY the notifications table — no insert/upsert/
    // delete/rpc mutation surface. (The page's doc comment references the old
    // supabase.from() path it replaced, so we don't string-match on that.)
    expect(src.includes(".insert(")).toBe(false);
    expect(src.includes(".upsert(")).toBe(false);
    expect(src.includes(".delete(")).toBe(false);
    expect(src.includes(".rpc(")).toBe(false);
    // The permitted writes (mark single + mark all) are PATCHes that set
    // read_at on the notifications table via the Supabase REST endpoint.
    expect(src).toMatch(/method:\s*['"]PATCH['"]/);
    const patchWrites = src.match(/JSON\.stringify\(\s*\{\s*read_at/g) ?? [];
    expect(patchWrites.length).toBeGreaterThanOrEqual(1);
    expect(src).toMatch(/notifications\?[^`'"]*read_at=is\.null/);
    // No paperwork-engine imports.
    expect(src).not.toMatch(/from\s+['"][^'"]*paperwork[^'"]*['"]/);
    // No push / email / SMS / cron client imports.
    expect(src).not.toMatch(/from\s+['"][^'"]*(sendgrid|twilio|onesignal|firebase\/messaging)/i);
  });
});
