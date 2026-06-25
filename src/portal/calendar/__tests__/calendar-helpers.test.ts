/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Calendar helpers tests
// ============================================================================

import {
  bucketForCard,
  groupCardsByBucket,
  isCalendarEmpty,
} from "../calendar-helpers";
import type { WorkspaceCard } from "../../workspace/types";

function card(over: Partial<WorkspaceCard> = {}): WorkspaceCard {
  return {
    transaction_id: "t1",
    transaction_type: "listing",
    property_address: "1 Test",
    client_name: "C",
    readiness_score: 50,
    readiness_tier: "drafting",
    stage: "drafting",
    next_action: "collect_field",
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
  } as WorkspaceCard;
}

describe("bucketForCard — no date data yet", () => {
  it("always returns reason='no_date_data' until WorkspaceCard carries dates", () => {
    const item = bucketForCard(card());
    expect(item.reason).toBe("no_date_data");
    expect(item.bucket).toBe("none");
    expect(item.date_iso).toBeNull();
  });
});

describe("groupCardsByBucket", () => {
  it("places every card in no_date_data while dates are absent", () => {
    const cards = [card({ transaction_id: "a" }), card({ transaction_id: "b" })];
    const r = groupCardsByBucket(cards);
    expect(r.today).toEqual([]);
    expect(r.this_week).toEqual([]);
    expect(r.upcoming).toEqual([]);
    expect(r.no_date_data.map((x) => x.card.transaction_id).sort()).toEqual(["a", "b"]);
    expect(r.counts).toEqual({ today: 0, this_week: 0, upcoming: 0, no_date_data: 2 });
  });
  it("empty input → all-zero counts", () => {
    const r = groupCardsByBucket([]);
    expect(r.counts).toEqual({ today: 0, this_week: 0, upcoming: 0, no_date_data: 0 });
  });
});

describe("isCalendarEmpty", () => {
  it("true when all counts are zero", () => {
    expect(isCalendarEmpty({ today: 0, this_week: 0, upcoming: 0, no_date_data: 0 })).toBe(true);
  });
  it("false when any bucket has items", () => {
    expect(isCalendarEmpty({ today: 0, this_week: 0, upcoming: 0, no_date_data: 1 })).toBe(false);
    expect(isCalendarEmpty({ today: 1, this_week: 0, upcoming: 0, no_date_data: 0 })).toBe(false);
  });
});

describe("AP2.1G calendar boundary lint", () => {
  it("helper has no realtime / no Google Calendar / no writes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/calendar/calendar-helpers.ts"),
      "utf-8"
    );
    expect(src).not.toMatch(/google|gcal|calendar.api|calendars\.events/i);
    expect(src.includes(".insert(")).toBe(false);
    expect(src.includes(".update(")).toBe(false);
    expect(src.includes(".upsert(")).toBe(false);
    expect(src.includes(".delete(")).toBe(false);
    expect(src.includes(".rpc(")).toBe(false);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
    expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
  });
  it("page has no Google Calendar integration / no writes / no cron / no realtime", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/calendar/page.tsx"),
      "utf-8"
    );
    // Disallow Google Calendar imports / API calls.
    expect(src).not.toMatch(/from\s+['"][^'"]*googleapis[^'"]*['"]/);
    expect(src).not.toMatch(/google\.calendar\(/);
    expect(src).not.toMatch(/calendar\.events\.(insert|update|delete)/);
    // Disallow cron scheduling APIs / reminder dispatch.
    expect(src).not.toMatch(/setInterval\(|setTimeout\(/);
    expect(src).not.toMatch(/scheduleReminder|sendReminder/);
    expect(src).not.toMatch(/from\s+['"]node-cron['"]/);
    // Disallow realtime.
    expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
    expect(src.includes(".insert(")).toBe(false);
    expect(src.includes(".update(")).toBe(false);
    expect(src.includes(".upsert(")).toBe(false);
    expect(src.includes(".delete(")).toBe(false);
    expect(src.includes(".rpc(")).toBe(false);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
  });
});
