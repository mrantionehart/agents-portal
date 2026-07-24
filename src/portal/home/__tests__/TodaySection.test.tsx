// ============================================================================
// TODAY B.003 · Slice 3 — focused tests for TodaySection (composition only)
// ============================================================================
// Tests grouping/ordering/empty-states/caught-up/composition/a11y. It does NOT
// re-test TodayRow's formatting (Slice 2) or every bucketing edge (Slice 1).
// ============================================================================
import fs from "fs";
import path from "path";
import { render, screen, within } from "@testing-library/react";
import TodaySection from "../TodaySection";
import type { DeadlineSummary, WorkspaceCard } from "../../workspace/types";

function ds(days: number | null, overdueCount = 0): DeadlineSummary {
  return {
    next_deadline_label: "Closing",
    due_date: "2026-08-15",
    days_remaining: days,
    priority: "high",
    overdue_count: overdueCount,
    at_risk_count: 0,
    breached_count: 0,
  } as unknown as DeadlineSummary;
}
function card(id: string, days: number | null, property = `Prop ${id}`, overdueCount = 0): WorkspaceCard {
  return {
    transaction_id: id,
    property_address: property,
    deadline_summary: days === null && overdueCount === 0 ? null : ds(days as number, overdueCount),
  } as unknown as WorkspaceCard;
}

const groupHeadings = () =>
  screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("TodaySection — group rendering + order", () => {
  it("renders each group when populated and preserves the approved order", () => {
    render(
      <TodaySection cards={[card("o", -2), card("t", 0), card("w", 3), card("u", 20)]} />,
    );
    expect(groupHeadings()).toEqual(["Overdue", "Due Today", "Due This Week", "Coming Up"]);
  });

  it("renders Coming Up items when populated", () => {
    render(<TodaySection cards={[card("u1", 12), card("u2", 30)]} />);
    const comingUp = screen.getByRole("region", { name: "Coming Up" });
    expect(within(comingUp).getAllByRole("link")).toHaveLength(2);
  });
});

describe("TodaySection — empty urgency groups", () => {
  it("omits empty Overdue / Due Today / Due This Week headings", () => {
    render(<TodaySection cards={[card("t", 0)]} />); // only Due Today populated
    expect(groupHeadings()).toEqual(["Due Today", "Coming Up"]);
    expect(screen.queryByRole("heading", { name: "Overdue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Due This Week" })).not.toBeInTheDocument();
  });

  it("always renders Coming Up with a neutral empty message when empty", () => {
    render(<TodaySection cards={[card("o", -1)]} />); // nothing upcoming
    expect(screen.getByRole("heading", { name: "Coming Up" })).toBeInTheDocument();
    expect(screen.getByText("No upcoming deadlines.")).toBeInTheDocument();
  });
});

describe("TodaySection — caught-up state", () => {
  it("appears (with the approved three-line meaning) when all urgency groups are empty", () => {
    render(<TodaySection cards={[card("u", 20)]} />); // only upcoming
    expect(screen.getByText(/You're caught up\./)).toBeInTheDocument();
    expect(screen.getByText("No overdue work.")).toBeInTheDocument();
    expect(screen.getByText("No deadlines today.")).toBeInTheDocument();
    // Coming Up still renders alongside it
    expect(screen.getByRole("heading", { name: "Coming Up" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Coming Up" })).getByRole("link")).toBeInTheDocument();
  });

  it("appears for an empty cards array and still renders Coming Up (empty message)", () => {
    render(<TodaySection cards={[]} />);
    expect(screen.getByText(/You're caught up\./)).toBeInTheDocument();
    expect(screen.getByText("No upcoming deadlines.")).toBeInTheDocument();
  });

  it("does NOT appear when any urgency group has an item", () => {
    render(<TodaySection cards={[card("o", -1), card("u", 20)]} />);
    expect(screen.queryByText(/You're caught up\./)).not.toBeInTheDocument();
  });
});

describe("TodaySection — composition", () => {
  it("renders exactly one TodayRow (link) per bucketed card and excludes non-projectable cards", () => {
    render(
      <TodaySection
        cards={[
          card("o", -1),
          card("t", 0),
          card("w", 5),
          card("u", 20),
          card("nosum", null), // null summary → excluded by bucketing
        ]}
      />,
    );
    // 4 projectable → 4 rows/links; the null-summary card is excluded
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByText("Prop nosum")).not.toBeInTheDocument();
  });

  it("does not duplicate a card across groups (each transaction id appears once)", () => {
    render(<TodaySection cards={[card("a", -1), card("b", 0), card("c", 3), card("d", 20)]} />);
    for (const id of ["a", "b", "c", "d"]) {
      expect(screen.getAllByText(`Prop ${id}`)).toHaveLength(1);
    }
  });

  it("respects the ordering produced by bucketToday within a group (most-overdue first)", () => {
    render(<TodaySection cards={[card("less", -1), card("most", -30)]} />);
    const overdue = screen.getByRole("region", { name: "Overdue" });
    const props = within(overdue).getAllByText(/^Prop /).map((n) => n.textContent);
    expect(props).toEqual(["Prop most", "Prop less"]);
  });

  it("uses bucketToday as its single grouping source (one call site)", () => {
    // Structural guarantee: exactly one call site of bucketToday in the component.
    const src = fs.readFileSync(path.join(__dirname, "..", "TodaySection.tsx"), "utf8");
    const codeOnly = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect((codeOnly.match(/bucketToday\s*\(/g) ?? []).length).toBe(1);
  });
});

describe("TodaySection — accessibility + server-renderable", () => {
  it("exposes an accessible section heading for the work queue", () => {
    render(<TodaySection cards={[card("t", 0)]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Today" })).toBeInTheDocument();
  });

  it("wraps rows in semantic list / list-item structure", () => {
    render(<TodaySection cards={[card("a", -1), card("b", -2)]} />);
    expect(screen.getAllByRole("list").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  // Strip comments so documentation mentioning "use client" / hooks doesn't false-positive.
  const codeOnly = fs
    .readFileSync(path.join(__dirname, "..", "TodaySection.tsx"), "utf8")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  it("introduces no client directive, hooks, or fetch", () => {
    expect(codeOnly).not.toMatch(/["']use client["']/);
    expect(codeOnly).not.toMatch(/\buse(State|Effect|Ref|Memo|Callback|Reducer|Context)\b/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(|axios/);
  });
});
