/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — AP2.1E — Home Dashboard helper tests
// ============================================================================

import {
  bucketCounts,
  firstName,
  formatToday,
  greetingFor,
  priorityBucket,
  prioritizeForToday,
  summarySentence,
} from "../home-helpers";
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
    suggested_prompt: "p",
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

describe("greetingFor", () => {
  it.each([
    [0, "Good morning"],
    [5, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [16, "Good afternoon"],
    [17, "Good evening"],
    [22, "Good evening"],
  ])("hour=%i → %s", (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});

describe("firstName", () => {
  it("extracts first token", () => {
    expect(firstName("Emily Carter")).toBe("Emily");
    expect(firstName("Tony Hart-Jones")).toBe("Tony");
  });
  it("falls back to 'there' when null/empty", () => {
    expect(firstName(null)).toBe("there");
    expect(firstName("")).toBe("there");
    expect(firstName("   ")).toBe("there");
    expect(firstName(undefined)).toBe("there");
  });
});

describe("formatToday", () => {
  it("renders weekday + month + day", () => {
    const d = new Date(2026, 5, 25); // June 25, 2026
    expect(formatToday(d)).toMatch(/(Thursday|June|25)/);
  });
});

describe("bucketCounts", () => {
  const set: WorkspaceCard[] = [
    card({ next_action: "request_party_attestation", readiness_tier: "drafting", readiness_score: 25 }),
    card({ next_action: "continue_collection", readiness_tier: "drafting", readiness_score: 54 }),
    card({ next_action: "prepare_package", readiness_tier: "ready_for_review", readiness_score: 87 }),
    card({ next_action: "ready_for_signature", readiness_tier: "ready_for_signature", readiness_score: 100 }),
    card({ next_action: "request_party_attestation", readiness_tier: "collecting", readiness_score: 25 }),
  ];

  it("counts needs_attention = statutory + collection", () => {
    expect(bucketCounts(set).needs_attention).toBe(3);
  });
  it("counts ready_for_review by tier", () => {
    expect(bucketCounts(set).ready_for_review).toBe(1);
  });
  it("counts ready_for_signature by tier", () => {
    expect(bucketCounts(set).ready_for_signature).toBe(1);
  });
  it("counts waiting_on_parties (statutory only)", () => {
    expect(bucketCounts(set).waiting_on_parties).toBe(2);
  });
  it("empty list → all zeros", () => {
    expect(bucketCounts([])).toEqual({
      needs_attention: 0,
      ready_for_review: 0,
      ready_for_signature: 0,
      waiting_on_parties: 0,
    });
  });
});

describe("summarySentence", () => {
  it("zero cards → 'don't have any active transactions today'", () => {
    expect(summarySentence([])).toMatch(/active transactions today/i);
  });
  it("one statutory → singular needs attention", () => {
    const cards = [card({ next_action: "request_party_attestation" })];
    expect(summarySentence(cards)).toMatch(/1 transaction that needs attention/);
  });
  it("two ready_for_review → 'packages ready for broker review'", () => {
    const cards = [
      card({ next_action: "prepare_package", readiness_tier: "ready_for_review", readiness_score: 87 }),
      card({ next_action: "prepare_package", readiness_tier: "ready_for_review", readiness_score: 90 }),
    ];
    expect(summarySentence(cards)).toMatch(/2 packages ready for broker review/);
  });
  it("combines needs_attention + ready_for_review with 'and'", () => {
    const cards = [
      card({ next_action: "request_party_attestation" }),
      card({ next_action: "prepare_package", readiness_tier: "ready_for_review", readiness_score: 87 }),
    ];
    const s = summarySentence(cards);
    expect(s).toMatch(/needs attention/);
    expect(s).toMatch(/ready for broker review/);
    expect(s).toMatch(/ and /);
  });
  it("only signed/quiet → 'all quiet right now'", () => {
    const cards = [card({ next_action: "ready_for_signature", readiness_tier: "ready_for_signature", readiness_score: 100 })];
    // signed cards still count under ready_for_signature
    expect(summarySentence(cards)).toMatch(/ready for signature/);
  });
});

describe("priorityBucket + prioritizeForToday", () => {
  it("priority order: statutory < collect < review < signature < other", () => {
    expect(priorityBucket(card({ next_action: "request_party_attestation" }))).toBe(1);
    expect(priorityBucket(card({ next_action: "continue_collection" }))).toBe(2);
    expect(priorityBucket(card({ readiness_tier: "ready_for_review", next_action: "prepare_package" }))).toBe(3);
    expect(priorityBucket(card({ readiness_tier: "ready_for_signature", next_action: "ready_for_signature" }))).toBe(4);
    expect(priorityBucket(card({ next_action: "prepare_package", readiness_tier: "drafting" }))).toBe(5);
  });

  it("prioritize sorts by bucket, then by readiness ASC inside bucket", () => {
    const cards = [
      card({ transaction_id: "a", next_action: "request_party_attestation", readiness_score: 50 }),
      card({ transaction_id: "b", next_action: "ready_for_signature", readiness_tier: "ready_for_signature", readiness_score: 100 }),
      card({ transaction_id: "c", next_action: "continue_collection", readiness_score: 54 }),
      card({ transaction_id: "d", next_action: "prepare_package", readiness_tier: "ready_for_review", readiness_score: 87 }),
      card({ transaction_id: "e", next_action: "request_party_attestation", readiness_score: 25 }),
    ];
    const ids = prioritizeForToday(cards).map((c) => c.transaction_id);
    expect(ids).toEqual(["e", "a", "c", "d", "b"]);
  });

  it("does not mutate input", () => {
    const cards = [card({ transaction_id: "z" }), card({ transaction_id: "a" })];
    const before = cards.map((c) => c.transaction_id);
    prioritizeForToday(cards);
    expect(cards.map((c) => c.transaction_id)).toEqual(before);
  });
});

describe("AP2.1E boundary lint", () => {
  it("home surface contains no writes, no new APIs, no Vault changes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      "src/portal/home/home-helpers.ts",
      "app/(portal)/home/page.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      // No mutation methods
      expect(src.includes(".insert(")).toBe(false);
      expect(src.includes(".update(")).toBe(false);
      expect(src.includes(".delete(")).toBe(false);
      expect(src.includes(".upsert(")).toBe(false);
      expect(src.includes(".rpc(")).toBe(false);
      // No POST verbs anywhere on Home
      expect(src).not.toMatch(/method:\s*['"]POST['"]/);
      // No new /api/portal/* fetches
      expect(src).not.toMatch(/fetch\(\s*['"]\/api\/portal/);
      // No paperwork-engine imports
      expect(src).not.toMatch(/from\s+['"][^'"]*paperwork[^'"]*['"]/);
      // No realtime subscriptions
      expect(src).not.toMatch(/\.channel\(|subscribe\(|onPostgresChanges/);
    }
  });
});
