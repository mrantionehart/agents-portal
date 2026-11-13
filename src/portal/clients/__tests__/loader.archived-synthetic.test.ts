/**
 * @jest-environment node
 */
// ============================================================================
// Archived synthetic leads are never surfaced in any client view
// ============================================================================
// Test/UAT lead rows are marked with a reversible server-set flag
// (source_context.archived_synthetic = true). canAccess must DENY them for
// every caller — agents AND broker-tier (incl. a broker in Preview Agent View)
// — so disposable test data cannot appear in the Agent Portal Clients view even
// if the row is mis-set to dispo_feed or assigned. Deny wins over every branch.
// ============================================================================

import { _canAccess } from "@/src/portal/clients/loader";

const AGENT = "agent-1";

function profile(over: Record<string, unknown> = {}): any {
  return {
    id: "c1",
    full_name: "x",
    assigned_agent_id: null,
    claimed_by: null,
    visibility: "broker_only",
    status: "new",
    source_context: null,
    ...over,
  };
}

describe("canAccess — archived synthetic leads are hidden everywhere", () => {
  const archived = { source_context: { archived_synthetic: true } };

  it("DENIES an archived synthetic row to a broker (overrides broker-tier all-access)", () => {
    expect(_canAccess(profile(archived), "broker-x", "broker")).toBe(false);
    expect(_canAccess(profile(archived), "admin-x", "admin")).toBe(false);
    expect(_canAccess(profile(archived), "om-x", "office_manager")).toBe(false);
  });

  it("DENIES an archived synthetic row to its assigned agent", () => {
    expect(
      _canAccess(profile({ ...archived, assigned_agent_id: AGENT }), AGENT, "agent"),
    ).toBe(false);
  });

  it("DENIES an archived synthetic row even when it is in the dispo feed", () => {
    expect(
      _canAccess(profile({ ...archived, visibility: "dispo_feed", status: "dispo" }), AGENT, "agent"),
    ).toBe(false);
  });

  it("still ALLOWS a normal (non-archived) row per the usual rules", () => {
    // broker sees everything
    expect(_canAccess(profile(), "broker-x", "broker")).toBe(true);
    // assigned agent sees their own
    expect(_canAccess(profile({ assigned_agent_id: AGENT }), AGENT, "agent")).toBe(true);
    // dispo feed is visible to agents
    expect(
      _canAccess(profile({ visibility: "dispo_feed", status: "dispo" }), AGENT, "agent"),
    ).toBe(true);
    // unrelated agent still denied
    expect(_canAccess(profile({ assigned_agent_id: "other" }), AGENT, "agent")).toBe(false);
  });
});
