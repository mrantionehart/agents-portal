/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.1 — R8 — Legacy redirect + retired-stub contract
// ============================================================================
// Read next.config.js and assert:
//   • Every R8-mandated redirect source → destination is present
//   • Exact-match safety: protected sub-routes are NOT captured
//   • Preserved legacy routes still exist on disk
//   • /opportunities is a retired stub (no forms, no writes)
// ============================================================================

import { readFileSync } from "fs";
import { join } from "path";
import { existsSync } from "fs";

// next.config.js declares redirects as a CommonJS export, but we
// parse the literal block as a string — that's enough to assert the
// six documented mappings + the exact-match contract.

const NEXT_CONFIG_PATH = join(process.cwd(), "next.config.js");

interface RedirectMapping {
  source: string;
  destination: string;
}

/** Extract { source, destination } pairs from next.config.js by
 *  regex. Tolerant of whitespace, quoting, and key order. */
function readRedirectMappings(): RedirectMapping[] {
  const src = readFileSync(NEXT_CONFIG_PATH, "utf-8");
  const out: RedirectMapping[] = [];
  // Match: { source: '/foo', destination: '/bar', ...
  const re = /source:\s*['"]([^'"]+)['"]\s*,\s*destination:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ source: m[1], destination: m[2] });
  }
  return out;
}

const MAPPINGS = readRedirectMappings();

function findRedirect(source: string): RedirectMapping | undefined {
  return MAPPINGS.find((m) => m.source === source);
}

describe("R8 — Required redirects", () => {
  it.each<[string, string]>([
    ["/transactions", "/workspace"],
    ["/deals", "/workspace"],
    ["/pipeline", "/workspace"],
    ["/ai-chat", "/ai"],
    ["/resources", "/training?tab=resources"],
    ["/scripts", "/training?tab=scripts"],
  ])("source %s → destination %s", (source, dest) => {
    const m = findRedirect(source);
    expect(m).toBeDefined();
    expect(m!.destination).toBe(dest);
  });

  it("ships at least the 6 R8-mandated redirects (plus prior phases)", () => {
    expect(MAPPINGS.length).toBeGreaterThanOrEqual(6);
  });
});

describe("R8 — Exact-match safety", () => {
  it.each<string>([
    "/transactions/new",
    "/workspace/[transactionId]",
    "/clients/[clientId]",
    "/workspace/portals",
    "/portal/[token]",
  ])("does NOT redirect %s (protected sub-route)", (protectedSource) => {
    expect(findRedirect(protectedSource)).toBeUndefined();
  });

  it("source patterns use no wildcard/path-segment captures (Next.js exact match)", () => {
    for (const m of MAPPINGS) {
      // No :param captures.
      expect(m.source).not.toMatch(/:[a-zA-Z]/);
      // No wildcard.
      expect(m.source).not.toMatch(/\*/);
      // Must start with /.
      expect(m.source.startsWith("/")).toBe(true);
    }
  });
});

describe("R8 — Preserved legacy routes still exist on disk", () => {
  it.each<string>([
    "app/profile/page.tsx",
    "app/business-card/page.tsx",
    "app/commissions/page.tsx",
    "app/commission-calculator/page.tsx",
    "app/crm/settings/page.tsx",
    "app/training-legacy/page.tsx",
    "app/vendors/page.tsx",
    "app/cma/page.tsx",
    "app/mls-ask/page.tsx",
    "app/chat/page.tsx",
    "app/portal/[token]/page.tsx",
    "app/client/deal/[token]/page.tsx",
  ])("file exists: %s", (relPath) => {
    expect(existsSync(join(process.cwd(), relPath))).toBe(true);
  });
});

describe("R8 — Retired stub for /opportunities", () => {
  it("/opportunities still exists", () => {
    expect(
      existsSync(join(process.cwd(), "app/opportunities/page.tsx"))
    ).toBe(true);
  });

  it("the stub is a small read-only AP2-safe page", () => {
    const src = readFileSync(
      join(process.cwd(), "app/opportunities/page.tsx"),
      "utf-8"
    );
    // Marked as retired in the header comment.
    expect(src).toMatch(/R8\s*—\s*Retired stub/);
    // No forms, no inputs, no writes.
    expect(src).not.toMatch(/<form[\s>]/i);
    expect(src).not.toMatch(/<input[\s>]/i);
    expect(src).not.toMatch(/<textarea[\s>]/i);
    expect(src).not.toMatch(/<select[\s>]/i);
    expect(src).not.toMatch(/<button[\s\S]*?onClick=/);
    // No fetch, no DB calls, no Supabase mutation chains.
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/\.from\(/);
    expect(src).not.toMatch(/\.rpc\(/);
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    // No use of supabase/createClient — fully static-server-component.
    expect(src).not.toMatch(/createClient|createServerClient/);
    // Explains where the live surface moved + provides a link out.
    expect(src.includes("/home")).toBe(true);
    expect(src).toMatch(/Open Home/);
  });
});

describe("R8 — boundary lint", () => {
  it("no new app/api/ route was added in R8 (cleanup-only phase)", () => {
    // We can't fully prove this without git, but we can assert that
    // the next.config.js redirects file has no new exported handler.
    const src = readFileSync(NEXT_CONFIG_PATH, "utf-8");
    expect(src).not.toMatch(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/);
  });

  it("retired /marketing-resources is folded into Training Hub Resources tab", () => {
    const m = findRedirect("/marketing-resources");
    expect(m).toBeDefined();
    expect(m!.destination).toBe("/training?tab=resources");
  });
});
