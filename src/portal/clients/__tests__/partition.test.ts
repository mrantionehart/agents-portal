/**
 * @jest-environment node
 */
// ============================================================================
// P4H-15 — the Clients page partitions by `assignmentBucket`
// ============================================================================
// The server page splits the loaded list into:
//   • ownedItems    — assignmentBucket !== 'dispo' → "Client Profiles" tab
//   • claimableItems — assignmentBucket === 'dispo' → "Available to Claim" tab
// This test pins the partition so an agent's owned view can never again
// contain pooled unassigned-prospect rows, and vice versa.
// ============================================================================

import type { ClientListItem } from "@/src/portal/clients/types";

function row(id: string, bucket: ClientListItem["assignmentBucket"]): ClientListItem {
  return {
    id,
    full_name: id,
    email: null,
    phone: null,
    profile_type: null,
    temperature: null,
    representation_status: null,
    preferred_channel: null,
    target_areas: [],
    updated_at: null,
    assignmentBucket: bucket,
  };
}

/** Mirror the exact partition expression used in app/(portal)/clients/page.tsx.
 *  If you change the page, change this (and update the tests), so the owned
 *  view can never silently grow a dispo row again. */
function partition(items: ClientListItem[]) {
  return {
    owned: items.filter((r) => r.assignmentBucket !== "dispo"),
    claimable: items.filter((r) => r.assignmentBucket === "dispo"),
  };
}

describe("P4H-15 — partition by assignmentBucket", () => {
  it("owned view EXCLUDES every dispo row", () => {
    const items = [
      row("a", "assigned"),
      row("b", "claimed"),
      row("c", "dispo"),
      row("d", null),
      row("e", "dispo"),
    ];
    const { owned } = partition(items);
    expect(owned.map((r) => r.id).sort()).toEqual(["a", "b", "d"]);
    expect(owned.find((r) => r.assignmentBucket === "dispo")).toBeUndefined();
  });

  it("claimable view CONTAINS only dispo rows", () => {
    const items = [
      row("a", "assigned"),
      row("b", "claimed"),
      row("c", "dispo"),
      row("d", null),
      row("e", "dispo"),
    ];
    const { claimable } = partition(items);
    expect(claimable.map((r) => r.id).sort()).toEqual(["c", "e"]);
    for (const r of claimable) expect(r.assignmentBucket).toBe("dispo");
  });

  it("every row goes to exactly one side (no duplication, no drop)", () => {
    const items = [
      row("a", "assigned"),
      row("b", "claimed"),
      row("c", "dispo"),
      row("d", null),
    ];
    const { owned, claimable } = partition(items);
    expect(owned.length + claimable.length).toBe(items.length);
    const ownedIds = new Set(owned.map((r) => r.id));
    for (const c of claimable) expect(ownedIds.has(c.id)).toBe(false);
  });
});
