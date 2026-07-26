// Tests for the dedicated Meetings notification category + safe /meetings deep
// links. Reuses the existing inbox helpers — no new pipeline.
import {
  categoryFor,
  inboxCounts,
  applyFilters,
  iconFor,
  linkTargetFor,
  type NotificationRow,
} from "@/src/portal/notifications/notifications-helpers";

const MEETING_TYPES = ["meeting_request", "meeting_decision", "meeting_status", "meeting_reminder"];

function row(over: Partial<NotificationRow> = {}): NotificationRow {
  return { id: "n1", user_id: "u1", title: "t", body: null, type: "meeting_request", read_at: null, created_at: "2026-08-10T00:00:00Z", ...over };
}

describe("categoryFor — Meetings", () => {
  it("maps every meeting_* type to 'meetings'", () => {
    for (const t of MEETING_TYPES) expect(categoryFor(t)).toBe("meetings");
  });
  it("does not disturb existing categories", () => {
    expect(categoryFor("deal")).toBe("transactions");
    expect(categoryFor("paperwork")).toBe("paperwork");
    expect(categoryFor("training")).toBe("system");
    expect(categoryFor("weird")).toBe("other");
  });
});

describe("inboxCounts / applyFilters — Meetings", () => {
  const rows = [
    row({ id: "a", type: "meeting_request" }),
    row({ id: "b", type: "meeting_reminder", read_at: "2026-08-10T01:00:00Z" }),
    row({ id: "c", type: "deal" }),
    row({ id: "d", type: "training" }),
  ];
  it("counts meetings separately (not folded into system)", () => {
    const c = inboxCounts(rows);
    expect(c.meetings).toBe(2);
    expect(c.transactions).toBe(1);
    expect(c.system).toBe(1);
  });
  it("Meetings filter returns only meeting rows", () => {
    const out = applyFilters(rows, { status: "all", category: "meetings" });
    expect(out.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
  it("System filter excludes meetings", () => {
    const out = applyFilters(rows, { status: "all", category: "system" });
    expect(out.map((r) => r.id)).toEqual(["d"]);
  });
});

describe("iconFor — Meetings glyph", () => {
  it("uses the handshake for meeting types", () => {
    for (const t of MEETING_TYPES) expect(iconFor(t)).toBe("🤝");
  });
});

describe("linkTargetFor — safe /meetings deep-links", () => {
  const uuid = "11111111-2222-3333-4444-555555555555";
  it("accepts related_type=meeting + uuid → /meetings/<uuid>", () => {
    expect(linkTargetFor(row({ related_type: "meeting", related_id: uuid }))).toBe(`/meetings/${uuid}`);
  });
  it("accepts a producer action_url under /meetings", () => {
    expect(linkTargetFor(row({ action_url: `/meetings/${uuid}` }))).toBe(`/meetings/${uuid}`);
  });
  it("rejects unsafe action_urls (external, protocol-relative, traversal)", () => {
    expect(linkTargetFor(row({ action_url: "https://evil.com/meetings/x" }))).toBeNull();
    expect(linkTargetFor(row({ action_url: "//evil.com" }))).toBeNull();
    expect(linkTargetFor(row({ action_url: "/meetings/../secret" }))).toBeNull();
    expect(linkTargetFor(row({ action_url: "/admin" }))).toBeNull();
  });
});
