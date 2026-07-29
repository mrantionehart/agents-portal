/**
 * @jest-environment node
 */
// Portal birthday proxy tests: requireAuth gates the edge, GET/dismiss hit the
// correct Vault paths, and PUT forwards ONLY self-service fields (never agentId
// or any administrative field).
import { NextResponse } from "next/server";

jest.mock("@/lib/vault-forward", () => ({
  proxyToVault: jest.fn(async () => NextResponse.json({ ok: true }, { status: 200 })),
}));
jest.mock("@/lib/security", () => ({
  requireAuth: jest.fn(async () => ({ user: { id: "agent-1" } })),
}));

import { GET, PUT } from "@/app/api/profile/birthday/route";
import { POST as DISMISS } from "@/app/api/profile/birthday/dismiss/route";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";

const pv = proxyToVault as jest.Mock;
const ra = requireAuth as jest.Mock;

function req(body?: unknown): any {
  return { json: async () => (body ?? {}), headers: { get: () => null } };
}

beforeEach(() => {
  pv.mockClear();
  ra.mockReset();
  ra.mockResolvedValue({ user: { id: "agent-1" } });
});

describe("GET /api/profile/birthday", () => {
  it("requires auth", async () => {
    ra.mockResolvedValue({ response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(pv).not.toHaveBeenCalled();
  });

  it("proxies to Vault", async () => {
    await GET(req());
    expect(pv).toHaveBeenCalledWith(expect.anything(), "GET", "/api/profile/birthday");
  });
});

describe("PUT /api/profile/birthday", () => {
  it("forwards ONLY birthMonth/birthDay/birthdayEmailEnabled; drops agentId + unknowns", async () => {
    await PUT(
      req({
        birthMonth: 7,
        birthDay: 27,
        birthdayEmailEnabled: false,
        // forbidden — must NOT be forwarded:
        agentId: "someone-else",
        birthYear: 1990,
        role: "broker",
        tenantId: "t-x",
      }),
    );
    expect(pv).toHaveBeenCalledTimes(1);
    const [, method, path, forwarded] = pv.mock.calls[0];
    expect(method).toBe("PUT");
    expect(path).toBe("/api/profile/birthday");
    expect(forwarded).toEqual({ birthMonth: 7, birthDay: 27, birthdayEmailEnabled: false });
    expect(forwarded).not.toHaveProperty("agentId");
    expect(forwarded).not.toHaveProperty("birthYear");
  });

  it("omits birthdayEmailEnabled when not provided (defaults live in Vault)", async () => {
    await PUT(req({ birthMonth: 3, birthDay: 3 }));
    const [, , , forwarded] = pv.mock.calls[0];
    expect(forwarded).toEqual({ birthMonth: 3, birthDay: 3 });
  });

  it("requires auth", async () => {
    ra.mockResolvedValue({ response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    const res = await PUT(req({ birthMonth: 7, birthDay: 27 }));
    expect(res.status).toBe(401);
    expect(pv).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/birthday/dismiss", () => {
  it("proxies POST to the Vault dismiss path", async () => {
    await DISMISS(req());
    expect(pv).toHaveBeenCalledWith(expect.anything(), "POST", "/api/profile/birthday/dismiss");
  });
});
