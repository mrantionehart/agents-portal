// ============================================================================
// TODAY B.002 · Slice 2 — focused tests for TodayRow (presentation only)
// ============================================================================
// Bucketing is NOT tested here (that contract lives in B.001). These tests cover
// the row's presentation contract, routing, accessibility, additional-overdue
// message, and fail-safe behavior — all driven by the Vault deadline_summary.
// ============================================================================
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import TodayRow from "../TodayRow";
import type { DeadlineSummary, WorkspaceCard } from "../../workspace/types";

function ds(over: Partial<DeadlineSummary> = {}): DeadlineSummary {
  return {
    next_deadline_label: "Closing",
    due_date: "2026-08-15",
    days_remaining: 0,
    priority: "high",
    overdue_count: 0,
    at_risk_count: 0,
    breached_count: 0,
    ...over,
  } as unknown as DeadlineSummary;
}
function card(over: { id?: string; property?: string | null; summary?: DeadlineSummary | null }): WorkspaceCard {
  return {
    transaction_id: over.id ?? "tx-1",
    property_address: over.property ?? "123 Ocean Dr",
    deadline_summary: over.summary === undefined ? ds() : over.summary,
  } as unknown as WorkspaceCard;
}

describe("TodayRow — presentation contract", () => {
  it("renders the property as the primary identifier", () => {
    render(<TodayRow card={card({ property: "742 Evergreen Terrace" })} />);
    expect(screen.getByText("742 Evergreen Terrace")).toBeInTheDocument();
  });

  it("renders the most-urgent deadline label", () => {
    render(<TodayRow card={card({ summary: ds({ next_deadline_label: "Inspection Deadline" }) })} />);
    expect(screen.getByText(/Inspection Deadline/)).toBeInTheDocument();
  });

  it("renders the due date via the approved helper (dueDateLabel)", () => {
    render(<TodayRow card={card({ summary: ds({ due_date: "2026-08-15" }) })} />);
    expect(screen.getByText(/Aug 15/)).toBeInTheDocument();
  });

  it("renders urgency text from the deadline helper (Due today)", () => {
    render(<TodayRow card={card({ summary: ds({ days_remaining: 0 }) })} />);
    expect(screen.getByText("Due today")).toBeInTheDocument();
  });

  it("renders urgency text for overdue (N days overdue)", () => {
    render(<TodayRow card={card({ summary: ds({ days_remaining: -3, overdue_count: 1 }) })} />);
    expect(screen.getByText("3 days overdue")).toBeInTheDocument();
  });
});

describe("TodayRow — Open Transaction routing + a11y", () => {
  it("links to /workspace/${transaction_id}", () => {
    render(<TodayRow card={card({ id: "abc-123" })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/workspace/abc-123");
  });

  it("the link has a descriptive accessible name identifying the property", () => {
    render(<TodayRow card={card({ id: "abc-123", property: "9 Palm Ct" })} />);
    const link = screen.getByRole("link", { name: /open transaction — 9 palm ct/i });
    expect(link).toBeInTheDocument();
  });

  it("the decorative arrow is hidden from assistive tech", () => {
    render(<TodayRow card={card({})} />);
    expect(screen.getByText("→")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("TodayRow — additional overdue message", () => {
  it("overdue_count = 2 renders '+1 more overdue'", () => {
    render(<TodayRow card={card({ summary: ds({ days_remaining: -2, overdue_count: 2 }) })} />);
    expect(screen.getByText("+1 more overdue")).toBeInTheDocument();
  });

  it("larger overdue counts render the correct remaining count (5 → +4)", () => {
    render(<TodayRow card={card({ summary: ds({ days_remaining: -2, overdue_count: 5 }) })} />);
    expect(screen.getByText("+4 more overdue")).toBeInTheDocument();
  });

  it("overdue_count = 1 does NOT render the additional message", () => {
    render(<TodayRow card={card({ summary: ds({ days_remaining: -1, overdue_count: 1 }) })} />);
    expect(screen.queryByText(/more overdue/)).not.toBeInTheDocument();
  });

  it("overdue_count = 0 does NOT render the additional message", () => {
    render(<TodayRow card={card({ summary: ds({ days_remaining: 3, overdue_count: 0 }) })} />);
    expect(screen.queryByText(/more overdue/)).not.toBeInTheDocument();
  });
});

describe("TodayRow — fail-safe + responsive a11y", () => {
  it("renders nothing when deadline_summary is absent (null)", () => {
    const { container } = render(<TodayRow card={card({ summary: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the summary has no renderable signal (helper rejects it)", () => {
    // no next label AND all counts zero → hasDeadlineSummary is false
    const { container } = render(
      <TodayRow card={card({ summary: ds({ next_deadline_label: null, days_remaining: null as unknown as number, overdue_count: 0, at_risk_count: 0, breached_count: 0 }) })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("falls back to a stable, non-misleading label when the property is empty (no fabricated deadline)", () => {
    render(<TodayRow card={card({ property: "   " })} />);
    expect(screen.getByText("Untitled transaction")).toBeInTheDocument();
  });

  it("keeps the full address available via title for truncated (long) property text", () => {
    const long = "12345 Extraordinarily Long Boulevard Of Broken Dreams, Apartment 9001, Some City";
    render(<TodayRow card={card({ property: long })} />);
    expect(screen.getByText(long)).toHaveAttribute("title", long);
    expect(screen.getByText(long)).toHaveClass("truncate");
  });
});

describe("TodayRow — server-renderable (no client hooks / fetch)", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "TodayRow.tsx"), "utf8");
  it('is not a client component ("use client" absent)', () => {
    expect(source).not.toMatch(/["']use client["']/);
  });
  it("uses no client hooks", () => {
    expect(source).not.toMatch(/\buse(State|Effect|Ref|Memo|Callback|Reducer|Context)\b/);
  });
  it("performs no fetch", () => {
    expect(source).not.toMatch(/\bfetch\s*\(|axios/);
  });
});
