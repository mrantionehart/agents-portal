/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.3B.3D — party forward route contract (source-level)
// ============================================================================
// Locks the thin-proxy contract without mocking the full Supabase + Vault stack
// (matches the create-route test style). The route must resolve the caller's
// token, forward to the Vault AGENT party endpoint, and stay side-effect-free.
// ============================================================================

import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf8");

describe("transactions/[id]/parties forward", () => {
  it("carries the security marker (authenticated route)", () => {
    // Required by scripts/check-api-routes.js — new routes must be marked.
    expect(src).toMatch(/\brequireAuth\b/);
  });

  it("resolves the caller's access token (agent Bearer)", () => {
    expect(src).toContain("resolveAccessToken(request)");
    expect(src).toMatch(/Authorization:\s*`Bearer \$\{token\}`/);
  });

  it("forwards to the Vault AGENT party endpoint", () => {
    expect(src).toContain(
      "/paperwork/agents/transactions/${id}/parties"
    );
    expect(src).toContain("VAULT_API_URL");
  });

  it("is a POST-only proxy (no generate / send / envelope logic)", () => {
    expect(src).toContain("export async function POST");
    expect(src).not.toMatch(/\bgenerate\b/i);
    expect(src).not.toMatch(/\benvelope\b/i);
    expect(src).not.toMatch(/docusign|esign/i);
  });

  it("401s when there is no token", () => {
    expect(src).toMatch(/if \(!token\)/);
    expect(src).toContain("status: 401");
  });

  it("passes the Vault status through (does not force 200)", () => {
    expect(src).toMatch(/status:\s*res\.status/);
  });
});
