/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Transaction Workspace tab tests
// ============================================================================

import {
  DEFAULT_TAB,
  WORKSPACE_TABS,
  parseTab,
  tabHref,
  type TabId,
} from "../tab-config";

describe("WORKSPACE_TABS config", () => {
  it("ships exactly 8 tabs", () => {
    expect(WORKSPACE_TABS.length).toBe(8);
  });
  it("has the 8 documented tab ids in order", () => {
    expect(WORKSPACE_TABS.map((t) => t.id)).toEqual([
      "overview",
      "documents",
      "timeline",
      "client",
      "offers",
      "compliance",
      "commission",
      "ai",
    ]);
  });
  it("default tab is overview", () => {
    expect(DEFAULT_TAB).toBe("overview");
  });
  it("every tab has a unique id + label + icon", () => {
    const ids = new Set(WORKSPACE_TABS.map((t) => t.id));
    const labels = new Set(WORKSPACE_TABS.map((t) => t.label));
    const icons = new Set(WORKSPACE_TABS.map((t) => t.icon));
    expect(ids.size).toBe(WORKSPACE_TABS.length);
    expect(labels.size).toBe(WORKSPACE_TABS.length);
    expect(icons.size).toBe(WORKSPACE_TABS.length);
  });
});

describe("parseTab", () => {
  it.each<[string, TabId]>([
    ["overview", "overview"],
    ["documents", "documents"],
    ["timeline", "timeline"],
    ["client", "client"],
    ["offers", "offers"],
    ["compliance", "compliance"],
    ["commission", "commission"],
    ["ai", "ai"],
  ])("recognized tab %s → %s", (input, expected) => {
    expect(parseTab(input)).toBe(expected);
  });

  it.each<string | undefined | null>([undefined, null, "", "garbage", "OVERVIEW", "Documents", "../foo", "ai;DROP", "ai overview"])(
    "unknown tab %p falls back to default",
    (input) => {
      expect(parseTab(input)).toBe(DEFAULT_TAB);
    }
  );
});

describe("tabHref", () => {
  it("default tab → bare /workspace/<id>", () => {
    expect(tabHref("abc-123", "overview")).toBe("/workspace/abc-123");
  });
  it("non-default tabs → /workspace/<id>?tab=<id>", () => {
    expect(tabHref("abc-123", "documents")).toBe("/workspace/abc-123?tab=documents");
    expect(tabHref("abc-123", "compliance")).toBe("/workspace/abc-123?tab=compliance");
    expect(tabHref("abc-123", "commission")).toBe("/workspace/abc-123?tab=commission");
  });
});

describe("Workflow 3.1 boundary lint — read-only structure", () => {
  it("page + shell + tab files have no Supabase mutation chains", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "app/(portal)/workspace/[transactionId]/page.tsx",
      "src/portal/workspace/tabs/WorkspaceShell.tsx",
      "src/portal/workspace/tabs/LeftRail.tsx",
      "src/portal/workspace/tabs/ComplianceBanner.tsx",
      "src/portal/workspace/tabs/TabStrip.tsx",
      "src/portal/workspace/tabs/OverviewTab.tsx",
      "src/portal/workspace/tabs/DocumentsTab.tsx",
      "src/portal/workspace/tabs/TimelineTab.tsx",
      "src/portal/workspace/tabs/ClientTab.tsx",
      "src/portal/workspace/tabs/OffersTab.tsx",
      "src/portal/workspace/tabs/ComplianceTab.tsx",
      "src/portal/workspace/tabs/CommissionTab.tsx",
      "src/portal/workspace/tabs/AITab.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.insert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.update\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.upsert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]{0,500}?\.delete\(/);
      expect(src).not.toMatch(/\.rpc\(['"]/);
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    }
  });

  it("tab components contain no forbidden action labels", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const FORBIDDEN_LABELS = [
      ">Generate PDF<",
      ">Send Envelope<",
      ">Send envelope<",
      ">Approve<",
      ">Release Commission<",
      ">Pay Commission<",
      ">Close Transaction<",
    ];
    for (const f of [
      "src/portal/workspace/tabs/OverviewTab.tsx",
      "src/portal/workspace/tabs/DocumentsTab.tsx",
      "src/portal/workspace/tabs/TimelineTab.tsx",
      "src/portal/workspace/tabs/ClientTab.tsx",
      "src/portal/workspace/tabs/OffersTab.tsx",
      "src/portal/workspace/tabs/ComplianceTab.tsx",
      "src/portal/workspace/tabs/CommissionTab.tsx",
      "src/portal/workspace/tabs/AITab.tsx",
      "src/portal/workspace/tabs/ComplianceBanner.tsx",
      "src/portal/workspace/tabs/LeftRail.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      for (const label of FORBIDDEN_LABELS) {
        expect(src.includes(label)).toBe(false);
      }
    }
  });

  it("tab components have no <button onClick=…> handlers", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/workspace/tabs/OverviewTab.tsx",
      "src/portal/workspace/tabs/DocumentsTab.tsx",
      "src/portal/workspace/tabs/TimelineTab.tsx",
      "src/portal/workspace/tabs/ClientTab.tsx",
      "src/portal/workspace/tabs/OffersTab.tsx",
      "src/portal/workspace/tabs/ComplianceTab.tsx",
      "src/portal/workspace/tabs/CommissionTab.tsx",
      "src/portal/workspace/tabs/ComplianceBanner.tsx",
      "src/portal/workspace/tabs/LeftRail.tsx",
      "src/portal/workspace/tabs/TabStrip.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/<button[\s\S]*?onClick=/);
    }
  });

  it("tab components do not introduce new fetch URLs (reuse existing data)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/workspace/tabs/OverviewTab.tsx",
      "src/portal/workspace/tabs/DocumentsTab.tsx",
      "src/portal/workspace/tabs/TimelineTab.tsx",
      "src/portal/workspace/tabs/ClientTab.tsx",
      "src/portal/workspace/tabs/OffersTab.tsx",
      "src/portal/workspace/tabs/ComplianceTab.tsx",
      "src/portal/workspace/tabs/CommissionTab.tsx",
      "src/portal/workspace/tabs/AITab.tsx",
      "src/portal/workspace/tabs/WorkspaceShell.tsx",
      "src/portal/workspace/tabs/ComplianceBanner.tsx",
      "src/portal/workspace/tabs/LeftRail.tsx",
      "src/portal/workspace/tabs/TabStrip.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\bfetch\(/);
    }
  });

  it("Documents tab passes through to R4 DocumentsPanel (no new fill UI)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/DocumentsTab.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+DocumentsPanel/);
    expect(src).toMatch(/<DocumentsPanel\b/);
    // No drawer / sheet / inline editor in 3.1.
    // Strip the top-of-file comment block (forward references to 3.2 are
    // allowed in comments) before grepping for the actual implementations.
    const codeOnly = src.replace(/^\/\/[\s\S]*?(?=\n[a-zA-Z])/, "");
    expect(codeOnly).not.toMatch(/<Drawer\b|<Sheet\b|FormFieldEditor/);
  });

  it("Client tab passes through to existing ClientIntelligencePanel", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/ClientTab.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+ClientIntelligencePanel/);
    expect(src).toMatch(/<ClientIntelligencePanel\b/);
  });

  it("AI tab passes through to existing AIAssistantPanel", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/tabs/AITab.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+AIAssistantPanel/);
    expect(src).toMatch(/<AIAssistantPanel\b/);
  });

  it("page preserves cross-tenant notFound() behavior", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    // Both fallback paths still call notFound() before rendering
    expect(src).toMatch(/notFound\(\)/);
    // Office-scope fallback for broker-tier callers still present
    expect(src).toMatch(/scope:\s*['"]office['"]/);
  });

  it("page reads ?tab= and falls back via parseTab", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/parseTab/);
    expect(src).toMatch(/searchParams/);
  });
});
