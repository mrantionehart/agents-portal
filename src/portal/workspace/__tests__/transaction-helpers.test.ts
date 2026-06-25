/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — AP2.1C — Per-transaction helpers tests
// ============================================================================

import {
  findCardById,
  nextActionLabel,
  readinessLanguage,
  riskLabel,
  stageLabel,
  statusExplanation,
  transactionTypeLabel,
  vaultPaperworkUrl,
  vaultTransactionUrl,
} from "../transaction-helpers";
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

describe("findCardById (V3)", () => {
  const a = card({ transaction_id: "a" });
  const b = card({ transaction_id: "b" });

  it("returns the matching card", () => {
    expect(findCardById([a, b], "b")?.transaction_id).toBe("b");
  });

  it("returns undefined when no match (V4 not-found path)", () => {
    expect(findCardById([a, b], "missing")).toBeUndefined();
  });
});

describe("nextActionLabel", () => {
  it.each([
    ["request_party_attestation", "Send a portal invite"],
    ["collect_field", "Answer the next question"],
    ["prepare_package", "Prepare for broker review"],
    ["ready_for_signature", "Ready for signature preparation"],
  ])("%s → %s", (input, expected) => {
    expect(nextActionLabel(input)).toBe(expected);
  });
});

describe("stageLabel", () => {
  it("maps the documented stage ids", () => {
    expect(stageLabel("intake")).toBe("Intake");
    expect(stageLabel("drafting")).toBe("Drafting");
    expect(stageLabel("awaiting_statutory")).toBe("Awaiting Party Disclosure");
    expect(stageLabel("broker_review")).toBe("Broker Review");
    expect(stageLabel("ready_for_signature")).toBe("Ready for Signature Prep");
    expect(stageLabel("complete")).toBe("Complete");
  });
});

describe("statusExplanation", () => {
  it("100% → signature preparation copy", () => {
    expect(statusExplanation(card({ readiness_tier: "ready_for_signature", readiness_score: 100 })))
      .toMatch(/Broker confirmation/i);
  });
  it("86-99% → broker review copy", () => {
    expect(statusExplanation(card({ readiness_tier: "ready_for_review" })))
      .toMatch(/broker review/i);
  });
  it("statutory blocker → portal-invite copy", () => {
    expect(
      statusExplanation(card({ readiness_tier: "drafting", next_action: "request_party_attestation" }))
    ).toMatch(/portal invite/i);
  });
  it("continue_collection → field-by-field copy", () => {
    expect(
      statusExplanation(card({ readiness_tier: "drafting", next_action: "continue_collection" }))
    ).toMatch(/next question|missing/i);
  });
});

describe("readinessLanguage", () => {
  it("100% → signature copy", () => {
    expect(readinessLanguage(card({ readiness_score: 100 }))).toMatch(/100%.*signature/i);
  });
  it("87% → broker review copy", () => {
    expect(readinessLanguage(card({ readiness_score: 87 }))).toMatch(/87%.*broker review/i);
  });
  it("54% → 'You're 54% complete'", () => {
    expect(readinessLanguage(card({ readiness_score: 54 }))).toMatch(/You're 54% complete/);
  });
});

describe("transactionTypeLabel", () => {
  it.each([
    ["buyer_rep", "Buyer Rep"],
    ["lease", "Lease"],
    ["purchase", "Purchase"],
    ["listing", "Listing"],
    ["buyer", "Buyer"],
    ["seller", "Seller"],
  ])("%s → %s", (input, expected) => {
    expect(transactionTypeLabel(input)).toBe(expected);
  });
  it("null → em-dash", () => {
    expect(transactionTypeLabel(null)).toBe("—");
  });
});

describe("riskLabel (Vault P1A placeholder = 'unknown')", () => {
  it("unknown → em-dash", () => {
    expect(riskLabel("unknown")).toBe("—");
  });
  it("maps the 4 documented tiers", () => {
    expect(riskLabel("low")).toBe("Low Risk");
    expect(riskLabel("medium")).toBe("Medium Risk");
    expect(riskLabel("high")).toBe("High Risk");
    expect(riskLabel("critical")).toBe("Critical");
  });
});

describe("Vault deep-link builders (V11)", () => {
  const base = "https://vault.hartfeltrealestate.com";
  it("transaction url", () => {
    expect(vaultTransactionUrl("abc-123", base)).toBe(`${base}/transactions/abc-123`);
  });
  it("paperwork url", () => {
    expect(vaultPaperworkUrl("abc-123", base)).toBe(`${base}/paperwork/transactions/abc-123`);
  });
});

describe("V9 / V12 / V13 boundary lint", () => {
  it("AI panel + page source contain no new business logic / no non-AI POSTs", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      "src/portal/workspace/AIAssistantPanel.tsx",
      "src/portal/workspace/transaction-helpers.ts",
      "app/(portal)/workspace/[transactionId]/page.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");

      // No paperwork-engine imports — Vault is the only source.
      expect(src).not.toMatch(/from\s+['"][^'"]*paperwork[^'"]*['"]/);
      // No new tool definitions — Vault owns the tools.
      expect(src).not.toMatch(/REQUEST_PARTY_ATTESTATION_TOOL|UPDATE_TRANSACTION_FIELD_TOOL|GET_TRANSACTION_PAPERWORK_STATE_TOOL/);
      // No envelope-send / DocuSign imports.
      expect(src).not.toMatch(/from\s+['"][^'"]*docusign[^'"]*['"]/i);
      expect(src).not.toMatch(/sendEnvelopeFor|issuePortalToken/);
      // No "Send envelope" / "Approve" buttons.
      expect(src.toLowerCase()).not.toMatch(/<button[^>]*>\s*send envelope/);
      expect(src.toLowerCase()).not.toMatch(/<button[^>]*>\s*approve/);
    }

    // The AI panel posts to /ai/chat. Confirm that's the ONLY POST verb
    // in the per-transaction surface.
    const aiSrc = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/AIAssistantPanel.tsx"),
      "utf-8"
    );
    const posts = aiSrc.match(/method:\s*['"]POST['"]/g) ?? [];
    expect(posts.length).toBe(1);
    expect(aiSrc).toMatch(/\/ai\/chat/);

    // Page source has zero POSTs.
    const pageSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    expect(pageSrc).not.toMatch(/method:\s*['"]POST['"]/);
  });
});
