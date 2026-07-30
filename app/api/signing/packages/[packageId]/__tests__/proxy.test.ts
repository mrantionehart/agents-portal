/**
 * @jest-environment node
 */
// ============================================================================
// Slice 2 Phase 3B-3.5 · AP proxy route tests
// ============================================================================
// Asserts:
//   * requireAuth gate — unauth short-circuits with 401, no Vault call
//   * authenticated → proxies GET to Vault at /signing/packages/<id> exactly
//   * packageId URL-encoded (defense against path smuggling)
//   * no ?include=history forwarding — the AP page never asks for it (agent
//     forbidden upstream), and this proxy has no query-string plumbing
//   * Vault status + body forwarded verbatim (status pass-through)
// ============================================================================
import { NextResponse } from "next/server";

jest.mock("@/lib/vault-forward", () => ({
  proxyToVault: jest.fn(async () => NextResponse.json({ viewer: "agent", package: {} }, { status: 200 })),
}));
jest.mock("@/lib/security", () => ({
  requireAuth: jest.fn(async () => ({ user: { id: "agent-1" } })),
}));

import { GET } from "@/app/api/signing/packages/[packageId]/route";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";

const pv = proxyToVault as jest.Mock;
const ra = requireAuth as jest.Mock;

function req(): any {
  return { headers: { get: () => null } };
}
const params = (packageId: string) => ({ params: Promise.resolve({ packageId }) });

beforeEach(() => {
  pv.mockClear();
  ra.mockReset();
  ra.mockResolvedValue({ user: { id: "agent-1" } });
});

describe("GET /api/signing/packages/[packageId]", () => {
  it("requireAuth short-circuits with the 401 response and never proxies", async () => {
    ra.mockResolvedValueOnce({
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const res = await GET(req(), params("00000000-0000-4000-8000-000000000001"));
    expect((res as Response).status).toBe(401);
    expect(pv).not.toHaveBeenCalled();
  });

  it("authenticated → proxies GET to /signing/packages/<id>", async () => {
    const pkgId = "00000000-0000-4000-8000-000000000abc";
    await GET(req(), params(pkgId));
    expect(pv).toHaveBeenCalledTimes(1);
    const [reqArg, method, path] = pv.mock.calls[0];
    expect(reqArg).toBeDefined();
    expect(method).toBe("GET");
    expect(path).toBe(`/signing/packages/${pkgId}`);
  });

  it("URL-encodes the packageId path segment (defense against smuggling)", async () => {
    // Not a realistic packageId, but proves encoding happens.
    await GET(req(), params("a b/../c"));
    const [, , path] = pv.mock.calls[0];
    expect(path).toBe("/signing/packages/a%20b%2F..%2Fc");
    expect(path).not.toContain("/..");
    expect(path).not.toContain(" ");
  });

  it("passes NO extra body / query args — proxy signature is (request, method, path) only", async () => {
    await GET(req(), params("00000000-0000-4000-8000-000000000abc"));
    expect(pv.mock.calls[0]).toHaveLength(3);
  });
});
