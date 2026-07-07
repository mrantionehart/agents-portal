/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3E — De-Vault agent workspace links
// ============================================================================
// Agents must never be directed to Vault from the workspace. Every
// paperwork / transaction deep-link is an in-portal /workspace/[id]
// route, and the Coach "Open" control navigates client-side so the
// target tab reliably re-renders.
//
// Two layers:
//   1. Render assertions where a self-contained fixture is cheap
//      (OverviewTab, LeftRail, WorkspaceCard, CoachStrip).
//   2. Source-contract assertions for the composed-state surfaces
//      (ComplianceTab / CommissionTab / TimelineTab / DocumentsPanel /
//      FormDetailDrawer) and the workspace page — mirroring the repo's
//      existing source-scan tests (workspace-tabs boundary lint).
// ============================================================================

import "@testing-library/jest-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";

import OverviewTab from "../tabs/OverviewTab";
import LeftRail from "../tabs/LeftRail";
import WorkspaceCard from "../WorkspaceCard";
import CoachStripComponent from "../components/CoachStrip";
import type {
  WorkspaceCard as WorkspaceCardData,
  CardLifecycle,
  DeadlineSummary,
  CoachRecommendation,
} from "../types";

// ── next/navigation mock for the client CoachStrip ──────────────────
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const VAULT_HOST = "vault.hartfeltrealestate.com";
const TXN = "txn-devault-1";

const lifecycle: CardLifecycle = {
  current_stage: "escrow",
  current_stage_label: "Escrow",
  next_stage: "inspections",
  next_stage_label: "Inspections",
  stage_readiness: {
    tier: "in_progress",
    satisfied_count: 1,
    total_count: 2,
    percent: 50,
    can_advance: false,
  },
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
    transaction_id: TXN,
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
  } as WorkspaceCardData;
}

/** Every rendered anchor/link href in the current DOM. */
function hrefs(): string[] {
  return Array.from(document.querySelectorAll("a[href]")).map(
    (a) => a.getAttribute("href") ?? ""
  );
}

// Absolute path to a source file under src/portal.
function src(rel: string): string {
  return readFileSync(join(process.cwd(), "src/portal", rel), "utf8");
}

// ── 1. OverviewTab ──────────────────────────────────────────────────
describe("OverviewTab — paperwork link is in-portal", () => {
  it("'View paperwork' points to the in-portal Paperwork tab, never Vault", () => {
    render(<OverviewTab card={card()} vaultBase={`https://${VAULT_HOST}`} />);
    const link = screen.getByRole("link", { name: /view paperwork/i });
    expect(link).toHaveAttribute("href", `/workspace/${TXN}?tab=documents`);
    expect(hrefs().some((h) => h.includes(VAULT_HOST))).toBe(false);
  });
});

// ── 2. LeftRail ─────────────────────────────────────────────────────
describe("LeftRail — quick links are in-portal", () => {
  it("Open transaction → /workspace/[id]; Open paperwork → ?tab=documents", () => {
    render(<LeftRail card={card()} vaultBase={`https://${VAULT_HOST}`} />);
    expect(
      screen.getByRole("link", { name: /open transaction/i })
    ).toHaveAttribute("href", `/workspace/${TXN}`);
    expect(
      screen.getByRole("link", { name: /open paperwork/i })
    ).toHaveAttribute("href", `/workspace/${TXN}?tab=documents`);
    expect(hrefs().some((h) => h.includes(VAULT_HOST))).toBe(false);
  });
});

// ── 3. WorkspaceCard (grid) ─────────────────────────────────────────
describe("WorkspaceCard — grid links are in-portal", () => {
  it("Open Transaction / Open Paperwork target portal routes, never Vault", () => {
    render(<WorkspaceCard card={card()} vaultBase={`https://${VAULT_HOST}`} />);
    expect(
      screen.getByRole("link", { name: /open transaction/i })
    ).toHaveAttribute("href", `/workspace/${TXN}`);
    expect(
      screen.getByRole("link", { name: /open paperwork/i })
    ).toHaveAttribute("href", `/workspace/${TXN}?tab=documents`);
    expect(hrefs().some((h) => h.includes(VAULT_HOST))).toBe(false);
  });
});

// ── 4. CoachStrip client navigation ─────────────────────────────────
describe("CoachStrip — Open navigates client-side to the in-portal drill_url", () => {
  const rec: CoachRecommendation = {
    kind: "complete_collection",
    label: "Complete document collection",
    blocker: false,
    reason: "A few required forms are still missing.",
    suggested_prompt: "Finish collecting the required forms.",
    drill_url: `/workspace/${TXN}?tab=documents`,
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
  });

  it("clicking Open calls router.push with the in-portal drill_url + refresh", () => {
    render(<CoachStripComponent recommendation={rec} />);
    fireEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(mockPush).toHaveBeenCalledWith(`/workspace/${TXN}?tab=documents`);
    expect(mockPush.mock.calls[0][0].startsWith("/workspace/")).toBe(true);
    expect(mockPush.mock.calls[0][0]).not.toContain(VAULT_HOST);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("renders no <a> to Vault (Open is a button, not an anchor)", () => {
    render(<CoachStripComponent recommendation={rec} />);
    expect(hrefs().some((h) => h.includes(VAULT_HOST))).toBe(false);
  });
});

// ── 5. Source contract for the composed-state + document surfaces ───
describe("agent-facing workspace surfaces reference no Vault host", () => {
  const files: Array<[string, string]> = [
    ["OverviewTab", "workspace/tabs/OverviewTab.tsx"],
    ["ComplianceTab", "workspace/tabs/ComplianceTab.tsx"],
    ["CommissionTab", "workspace/tabs/CommissionTab.tsx"],
    ["TimelineTab", "workspace/tabs/TimelineTab.tsx"],
    ["LeftRail", "workspace/tabs/LeftRail.tsx"],
    ["WorkspaceCard", "workspace/WorkspaceCard.tsx"],
    ["CoachStrip", "workspace/components/CoachStrip.tsx"],
    ["DocumentsPanel", "documents/DocumentsPanel.tsx"],
    ["FormDetailDrawer", "documents/details/FormDetailDrawer.tsx"],
  ];

  it.each(files)("%s source contains no vault host literal", (_name, rel) => {
    expect(src(rel)).not.toContain(VAULT_HOST);
  });

  it("Compliance/Commission render the page-supplied in-portal paperwork url", () => {
    expect(src("workspace/tabs/ComplianceTab.tsx")).toContain(
      "href={state.paperworkPackageUrl}"
    );
    expect(src("workspace/tabs/CommissionTab.tsx")).toContain(
      "href={state.drillLinks.paperworkPackage}"
    );
  });

  it("DocumentsPanel drops the per-form Vault link and CTA points to Package review", () => {
    const s = src("documents/DocumentsPanel.tsx");
    expect(s).not.toContain("open_in_vault_url");
    expect(s).toContain("?tab=package");
  });

  it("FormDetailDrawer no longer renders the per-form Vault link", () => {
    expect(src("documents/details/FormDetailDrawer.tsx")).not.toContain(
      "open_in_vault_url"
    );
  });
});

// ── 6. The workspace page computes the paperwork url in-portal ──────
describe("workspace page — paperworkPackageUrl is in-portal", () => {
  it("computes ?tab=documents and imports no Vault url helpers", () => {
    const page = readFileSync(
      join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf8"
    );
    expect(page).toContain("?tab=documents");
    expect(page).not.toContain("vaultPaperworkUrl(");
    expect(page).not.toContain("vaultTransactionUrl(");
  });
});
