/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — Workspace helpers tests
// ============================================================================
// V8 (badge/label translations), V9 (filter composition), V10 (link
// builders) — all pure-helper tests. The React render surface is
// exercised by the live browser smoke.
// ============================================================================

import {
  applyFilters,
  badgeForCard,
  errorMessageFor,
  riskLabel,
  stageLabel,
  typeLabel,
  vaultPaperworkUrl,
  vaultTransactionUrl,
} from "../helpers";
import type { WorkspaceCard } from "../types";

function card(over: Partial<WorkspaceCard> = {}): WorkspaceCard {
  return {
    transaction_id: "t1",
    transaction_type: "listing",
    property_address: "1 Test",
    client_name: "C",
    readiness_score: 87,
    readiness_tier: "ready_for_review",
    stage: "broker_review",
    next_action: "prepare_package",
    suggested_prompt: "ready",
    required_forms_count: 3,
    ready_forms_count: 2,
    signed_forms_count: 1,
    blocked_forms_count: 0,
    pending_envelopes_count: 0,
    portal_status: "none",
    risk_tier: "unknown",
    broker_confirmation_required: true,
    ...over,
  } as WorkspaceCard;
}

describe("badgeForCard (V8 — readiness vocabulary)", () => {
  it("ready_for_signature → 'Ready for Signature Prep' (ok)", () => {
    const b = badgeForCard(card({ readiness_tier: "ready_for_signature", readiness_score: 100 }));
    expect(b.label).toBe("Ready for Signature Prep");
    expect(b.tone).toBe("ok");
  });

  it("ready_for_review → 'Ready for Broker Review' (info)", () => {
    const b = badgeForCard(card({ readiness_tier: "ready_for_review" }));
    expect(b.label).toBe("Ready for Broker Review");
    expect(b.tone).toBe("info");
  });

  it("request_party_attestation → 'Awaiting Party Disclosure' (warn)", () => {
    const b = badgeForCard(card({ readiness_tier: "drafting", next_action: "request_party_attestation" }));
    expect(b.label).toBe("Awaiting Party Disclosure");
    expect(b.tone).toBe("warn");
  });

  it("continue_collection → 'Needs More Info' (warn)", () => {
    const b = badgeForCard(card({ readiness_tier: "drafting", next_action: "continue_collection" }));
    expect(b.label).toBe("Needs More Info");
    expect(b.tone).toBe("warn");
  });
});

describe("applyFilters (V9)", () => {
  const set = [
    card({ transaction_id: "a", transaction_type: "listing", readiness_tier: "ready_for_review", next_action: "prepare_package" }),
    card({ transaction_id: "b", transaction_type: "buyer_rep", readiness_tier: "ready_for_signature", readiness_score: 100, next_action: "ready_for_signature" }),
    card({ transaction_id: "c", transaction_type: "buyer", readiness_tier: "drafting", next_action: "continue_collection", readiness_score: 54 }),
    card({ transaction_id: "d", transaction_type: "lease", readiness_tier: "collecting", next_action: "request_party_attestation", readiness_score: 25 }),
  ];

  it("status=ready_for_review keeps only ready_for_review tier", () => {
    expect(applyFilters(set, { status: "ready_for_review", type: "all" }).map((c) => c.transaction_id)).toEqual(["a"]);
  });

  it("status=ready_for_signature keeps only ready_for_signature tier", () => {
    expect(applyFilters(set, { status: "ready_for_signature", type: "all" }).map((c) => c.transaction_id)).toEqual(["b"]);
  });

  it("status=needs_more_info keeps continue_collection + request_party_attestation", () => {
    const r = applyFilters(set, { status: "needs_more_info", type: "all" });
    expect(r.map((c) => c.transaction_id).sort()).toEqual(["c", "d"]);
  });

  it("type=listing keeps only listings", () => {
    expect(applyFilters(set, { status: "all", type: "listing" }).map((c) => c.transaction_id)).toEqual(["a"]);
  });

  it("type=buyer_rep keeps only buyer_rep", () => {
    expect(applyFilters(set, { status: "all", type: "buyer_rep" }).map((c) => c.transaction_id)).toEqual(["b"]);
  });

  it("type=lease keeps only lease", () => {
    expect(applyFilters(set, { status: "all", type: "lease" }).map((c) => c.transaction_id)).toEqual(["d"]);
  });

  it("status=all + type=all → identity", () => {
    expect(applyFilters(set, { status: "all", type: "all" }).length).toBe(set.length);
  });

  it("combined filters compose with AND", () => {
    expect(
      applyFilters(set, { status: "needs_more_info", type: "lease" }).map((c) => c.transaction_id)
    ).toEqual(["d"]);
  });
});

describe("errorMessageFor", () => {
  it("401 → sign-in copy", () => {
    expect(errorMessageFor(401)).toMatch(/sign in/i);
  });
  it("403 → permission copy", () => {
    expect(errorMessageFor(403)).toMatch(/permission/i);
  });
  it("500 → generic with status code", () => {
    expect(errorMessageFor(500)).toMatch(/500/);
  });
  it("uses fallback for unhandled status codes", () => {
    expect(errorMessageFor(500, "boom")).toBe("boom");
  });
  it("401 + fallback still uses the sign-in copy (takes precedence)", () => {
    expect(errorMessageFor(401, "ignored")).toMatch(/sign in/i);
  });
});

describe("typeLabel / stageLabel / riskLabel", () => {
  it("typeLabel maps internal ids to display labels", () => {
    expect(typeLabel("buyer_rep")).toBe("Buyer Rep");
    expect(typeLabel("lease")).toBe("Lease");
    expect(typeLabel("purchase")).toBe("Purchase");
    expect(typeLabel("listing")).toBe("Listing");
    expect(typeLabel(null)).toBe("—");
  });

  it("stageLabel maps stage ids to display labels", () => {
    expect(stageLabel("broker_review")).toBe("Broker Review");
    expect(stageLabel("ready_for_signature")).toBe("Ready for Signature Prep");
    expect(stageLabel("awaiting_statutory")).toBe("Awaiting Party Disclosure");
    expect(stageLabel("in_signature")).toBe("In Signature");
    expect(stageLabel("complete")).toBe("Complete");
  });

  it("riskLabel returns '—' for unknown (Vault P1A placeholder)", () => {
    expect(riskLabel("unknown")).toBe("—");
    expect(riskLabel("high")).toBe("High Risk");
    expect(riskLabel("critical")).toBe("Critical");
  });
});

describe("Vault deep-link builders (V10)", () => {
  it("vaultTransactionUrl produces the documented path", () => {
    expect(vaultTransactionUrl("abc-123", "https://vault.hartfeltrealestate.com")).toBe(
      "https://vault.hartfeltrealestate.com/transactions/abc-123"
    );
  });
  it("vaultPaperworkUrl produces the documented path", () => {
    expect(vaultPaperworkUrl("abc-123", "https://vault.hartfeltrealestate.com")).toBe(
      "https://vault.hartfeltrealestate.com/paperwork/transactions/abc-123"
    );
  });
});

describe("V11 / V12 boundary lint — no send/POST surface", () => {
  it("source contains no send / envelope / POST verbs", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      "src/portal/workspace/helpers.ts",
      "src/portal/workspace/types.ts",
      "src/portal/workspace/api.ts",
      "src/portal/workspace/WorkspaceCard.tsx",
      "src/portal/workspace/WorkspaceClient.tsx",
      "app/(portal)/workspace/page.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      // The only allowed POST in the Portal codebase is to /api/ai/chat
      // (Vault Copilot). This file set is the Workspace surface — no
      // chat lives here yet, so it must contain ZERO POST verbs.
      expect(src).not.toMatch(/method:\s*['"]POST['"]/);
      // Anti-pattern: a "Send envelope" / "Approve" affordance.
      expect(src.toLowerCase()).not.toMatch(/<button[^>]*>\s*send envelope/);
      expect(src.toLowerCase()).not.toMatch(/<button[^>]*>\s*approve/);
    }
  });
});
