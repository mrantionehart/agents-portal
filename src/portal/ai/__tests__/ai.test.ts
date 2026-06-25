/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — AI page boundary lint
// ============================================================================

import { QUICK_PROMPTS, visibleQuickPrompts } from "../quick-prompts";

describe("QUICK_PROMPTS catalog", () => {
  it("each entry has a stable id and non-empty prompt", () => {
    const seen = new Set<string>();
    for (const p of QUICK_PROMPTS) {
      expect(p.id).toBeTruthy();
      expect(seen.has(p.id)).toBe(false);
      seen.add(p.id);
      expect(p.label).toBeTruthy();
      expect(p.prompt.length).toBeGreaterThan(10);
    }
  });
});

describe("visibleQuickPrompts", () => {
  it("hides requiresTxn prompts when no transaction is selected", () => {
    const visible = visibleQuickPrompts(false);
    expect(visible.every((p) => !p.requiresTxn)).toBe(true);
  });
  it("includes all prompts when a transaction is selected", () => {
    const visible = visibleQuickPrompts(true);
    expect(visible.length).toBe(QUICK_PROMPTS.length);
  });
});

describe("AP2.1H AI boundary lint", () => {
  it("AIChatPanel calls only Vault /api/ai/chat (no other endpoints)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/ai/AIChatPanel.tsx"),
      "utf-8"
    );
    // The only fetch URL must contain "/ai/chat"
    const fetches = [...src.matchAll(/fetch\(\s*`([^`]+)`/g)].map((m) => m[1]);
    expect(fetches.length).toBeGreaterThan(0);
    for (const f of fetches) {
      expect(f.endsWith("/ai/chat")).toBe(true);
    }
    // No DB writes / no portal API routes.
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
    expect(src).not.toMatch(/fetch\(\s*['"]\/api\/portal/);
    // No realtime / no push.
    expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
    // Auto-send guard — no setTimeout/setInterval that would auto-fire `send()`.
    // (setInterval/setTimeout aren't allowed at all here to keep the
    // "no auto-send" guarantee airtight.)
    expect(src).not.toMatch(/setInterval\(/);
    expect(src).not.toMatch(/setTimeout\([^)]*\bsend\b/);
  });

  it("/ai page reuses the workspace fetcher; no new endpoints; no writes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/ai/page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/fetchWorkspaceFromVault/);
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
  });

  it("AIShell never makes a chat request directly — only the panel does", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/ai/AIShell.tsx"),
      "utf-8"
    );
    // The shell only renders; the panel handles the actual POST.
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
  });
});
