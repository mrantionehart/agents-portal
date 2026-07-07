/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3E — OverviewTab shows Transaction Stage + Deadline
// ============================================================================
// Reuses the grid card's lifecycle-view / deadline-view; asserts the detail
// Overview now surfaces both (and hides them when absent).
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import OverviewTab from "../OverviewTab";
import type { WorkspaceCard, CardLifecycle, DeadlineSummary } from "../../types";

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

function card(over: Partial<WorkspaceCard> = {}): WorkspaceCard {
  return {
    transaction_id: "txn-1",
    transaction_type: "purchase",
    property_address: "123 Test St",
    client_name: "Jane Client",
    readiness_score: 60,
    readiness_tier: "ready_for_review",
    stage: "broker_review",
    next_action: "prepare_package",
    suggested_prompt: "Package is 60% complete.",
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
  } as WorkspaceCard;
}

describe("OverviewTab — Transaction Stage + Deadline (3.3E)", () => {
  it("shows Transaction Stage + Deadline when the card has them", () => {
    render(<OverviewTab card={card()} vaultBase="https://vault.example.com" />);

    expect(screen.getByTestId("overview-transaction-stage")).toBeInTheDocument();
    expect(screen.getByText("Transaction Stage")).toBeInTheDocument();
    expect(screen.getByText("Escrow")).toBeInTheDocument();

    expect(screen.getByTestId("overview-deadline")).toBeInTheDocument();
    expect(screen.getByText("Deadline")).toBeInTheDocument();
    expect(screen.getByText("Final Walkthrough")).toBeInTheDocument();
  });

  it("hides both when the card lacks lifecycle + deadline", () => {
    render(
      <OverviewTab
        card={card({ lifecycle: null, deadline_summary: null })}
        vaultBase="https://vault.example.com"
      />
    );
    expect(screen.queryByTestId("overview-transaction-stage")).not.toBeInTheDocument();
    expect(screen.queryByTestId("overview-deadline")).not.toBeInTheDocument();
    // existing content still renders
    expect(screen.getByText("Next Action")).toBeInTheDocument();
  });
});
