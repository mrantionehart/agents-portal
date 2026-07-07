/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.3D — portal forward-route contracts (source-level)
// ============================================================================
// Locks the thin-proxy contract for the 6 new forwards without mocking the full
// stack: each carries the requireAuth security marker (check-api-routes guard),
// proxies via proxyToVault to the right Vault path + method, and adds no logic.
// ============================================================================

import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
function src(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const ROUTES: Array<{
  file: string;
  method: "GET" | "POST";
  vaultFragment: string;
}> = [
  {
    file: "app/api/transactions/[id]/forms/add/route.ts",
    method: "POST",
    vaultFragment: "/paperwork/agents/transactions/${id}/forms/add",
  },
  {
    file: "app/api/transactions/[id]/documents/[fid]/generate/route.ts",
    method: "POST",
    vaultFragment: "/paperwork/agents/transactions/${id}/documents/${fid}/generate",
  },
  {
    file: "app/api/transactions/[id]/documents/[fid]/send/route.ts",
    method: "POST",
    vaultFragment: "/paperwork/agents/transactions/${id}/documents/${fid}/send",
  },
  {
    file: "app/api/transactions/[id]/documents/[fid]/download/route.ts",
    method: "GET",
    vaultFragment: "/paperwork/agents/transactions/${id}/documents/${fid}/download",
  },
  {
    file: "app/api/esign/status/route.ts",
    method: "GET",
    vaultFragment: "/esign/status",
  },
  {
    file: "app/api/esign/connect/route.ts",
    method: "GET",
    vaultFragment: "/esign/docusign/connect",
  },
];

describe.each(ROUTES)("forward %s", ({ file, method, vaultFragment }) => {
  const text = src(file);

  it("carries the requireAuth security marker", () => {
    expect(text).toMatch(/\brequireAuth\b/);
  });
  it("proxies via proxyToVault", () => {
    expect(text).toContain("proxyToVault");
  });
  it(`exports ${method} and targets the Vault path`, () => {
    expect(text).toContain(`export async function ${method}`);
    expect(text).toContain(vaultFragment);
  });
  it("adds no generate/send/docusign business logic", () => {
    expect(text).not.toMatch(/generateFormPdf|sendEnvelopeForFormInstance/);
  });
});
