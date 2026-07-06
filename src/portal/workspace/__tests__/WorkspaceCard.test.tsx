/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.2D — WorkspaceCard render test (narrow, mission-specific)
// ============================================================================
// One focused render test proving the Deadline section is ADDITIVE and does not
// disturb the rest of the card. Asserts (per the 3.2D mission):
//   • Paperwork Stage still renders
//   • Transaction Stage still renders
//   • Deadline section renders when deadline_summary exists
//   • Deadline section is hidden when deadline_summary is null
//   • Coach narrative (suggested_prompt) still renders
//   • Existing card content (address / client) still renders
// Not broad component coverage — just these guarantees.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import WorkspaceCard from "../WorkspaceCard";
import type { WorkspaceCard as WorkspaceCardData, CardLifecycle, DeadlineSummary } from "../types";

const lifecycle: CardLifecycle = {
  current_stage: "escrow",
  current_stage_label: "Escrow",
  next_stage: "inspections",
  next_stage_label: "Inspections",
  stage_readiness: { tier: "in_progress", satisfied_count: 1, total_count: 2, percent: 50, can_advance: false },
  blockers: [],
  warnings: [],
  next_action: { class: "task", key: "x", label: "Schedule inspection", priority: "medium" },
  priority: "high",
};

const deadline_summary: DeadlineSummary = {
  next_deadline: "walkthrough",
  next_deadline_label: "Final Walkthrough",
  due_date: "2026-07-12",
  days_remaining: 3,
  priority: "high",
  overdue_count: 0,
  at_risk_count: 1,
  breached_count: 0,
  blocker_count: 0,
  warning_count: 0,
};

function card(over: Partial<WorkspaceCardData> = {}): WorkspaceCardData {
  return {
    transaction_id: "txn-1",
    transaction_type: "purchase",
    property_address: "123 Test Street",
    client_name: "Jane Client",
    readiness_score: 60,
    readiness_tier: "ready_for_review",
    stage: "broker_review", // → Paperwork Stage badge "Broker Review"
    next_action: "prepare_package",
    suggested_prompt: "Package is 60% complete — next step is broker review.",
    required_forms_count: 5,
    ready_forms_count: 2,
    signed_forms_count: 0,
    blocked_forms_count: 0,
    pending_envelopes_count: 0,
    portal_status: "none",
    risk_tier: "low",
    broker_confirmation_required: true,
    lifecycle,
    deadline_summary,
    ...over,
  };
}

describe("WorkspaceCard — 3.2D Deadline section is additive", () => {
  it("renders Paperwork Stage + Transaction Stage + Deadline + Coach narrative + existing content", () => {
    render(<WorkspaceCard card={card()} vaultBase="https://vault.example.com" />);

    // Paperwork Stage (the muted stage badge, distinct from readiness badge)
    expect(screen.getByText("Broker Review")).toBeInTheDocument();
    // Transaction Stage indicator (3.1D)
    expect(screen.getByText("Transaction Stage")).toBeInTheDocument();
    expect(screen.getByText("Escrow")).toBeInTheDocument();
    // Deadline section (3.2D)
    expect(screen.getByText("Deadline")).toBeInTheDocument();
    expect(screen.getByText("Final Walkthrough")).toBeInTheDocument();
    expect(screen.getByText("3 days left")).toBeInTheDocument();
    expect(screen.getByText("1 at risk")).toBeInTheDocument();
    // Coach narrative (the card's AI/coach output)
    expect(screen.getByText(/Package is 60% complete/)).toBeInTheDocument();
    // Existing content
    expect(screen.getByText("123 Test Street")).toBeInTheDocument();
    expect(screen.getByText("Jane Client")).toBeInTheDocument();
  });

  it("hides ONLY the Deadline section when deadline_summary is null", () => {
    render(<WorkspaceCard card={card({ deadline_summary: null })} vaultBase="https://vault.example.com" />);

    // Deadline section gone
    expect(screen.queryByText("Deadline")).not.toBeInTheDocument();
    expect(screen.queryByText("Final Walkthrough")).not.toBeInTheDocument();
    // Everything else still renders
    expect(screen.getByText("Broker Review")).toBeInTheDocument();       // Paperwork Stage
    expect(screen.getByText("Transaction Stage")).toBeInTheDocument();    // Transaction Stage
    expect(screen.getByText("Escrow")).toBeInTheDocument();
    expect(screen.getByText(/Package is 60% complete/)).toBeInTheDocument(); // Coach narrative
    expect(screen.getByText("123 Test Street")).toBeInTheDocument();      // existing content
  });
});
