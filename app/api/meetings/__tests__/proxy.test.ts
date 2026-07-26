/**
 * @jest-environment node
 */
// Route tests for the thin Portal meeting proxies. Asserts: correct Vault paths,
// create forwards ONLY agent-owned fields (no tenant/broker/requester/status/
// expiration), respond validates the action, and requireAuth gates the edge.
import { NextResponse } from "next/server";

jest.mock("@/lib/vault-forward", () => ({
  proxyToVault: jest.fn(async () => NextResponse.json({ ok: true }, { status: 200 })),
}));
jest.mock("@/lib/security", () => ({
  requireAuth: jest.fn(async () => ({ user: { id: "agent-1" } })),
}));

import { GET as listGET, POST as listPOST } from "@/app/api/meetings/route";
import { GET as detailGET } from "@/app/api/meetings/[id]/route";
import { POST as cancelPOST } from "@/app/api/meetings/[id]/cancel/route";
import { POST as respondPOST } from "@/app/api/meetings/[id]/respond/route";
import { proxyToVault } from "@/lib/vault-forward";
import { requireAuth } from "@/lib/security";

const pv = proxyToVault as jest.Mock;
const ra = requireAuth as jest.Mock;

function req(body?: unknown): any {
  return { json: async () => (body ?? {}), headers: { get: () => null } };
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  pv.mockClear();
  ra.mockReset();
  ra.mockResolvedValue({ user: { id: "agent-1" } });
});

describe("GET /api/meetings", () => {
  it("proxies to Vault /meetings", async () => {
    await listGET(req());
    expect(pv).toHaveBeenCalledWith(expect.anything(), "GET", "/meetings");
  });
});

describe("POST /api/meetings (create)", () => {
  it("forwards ONLY agent-owned fields; drops tenant/broker/requester/status/expiration", async () => {
    await listPOST(req({
      meetingType: "deal_review", priority: "high", durationMin: 30, timezone: "America/New_York",
      proposedStarts: ["2026-08-20T15:00:00Z"], notes: "hi", idempotencyKey: "abcd1234",
      // forbidden — must NOT be forwarded:
      tenantId: "t-x", brokerId: "b-x", requesterId: "a-x", requesting_agent_id: "a-x",
      status: "confirmed", expiresAt: "2099-01-01T00:00:00Z",
    }));
    expect(pv).toHaveBeenCalledTimes(1);
    const [, method, path, forwarded] = pv.mock.calls[0];
    expect(method).toBe("POST");
    expect(path).toBe("/meetings");
    expect(forwarded).toEqual({
      meetingType: "deal_review", priority: "high", durationMin: 30, timezone: "America/New_York",
      proposedStarts: ["2026-08-20T15:00:00Z"], notes: "hi", idempotencyKey: "abcd1234",
    });
    for (const k of ["tenantId", "brokerId", "requesterId", "requesting_agent_id", "status", "expiresAt"]) {
      expect(forwarded).not.toHaveProperty(k);
    }
  });

  it("omits idempotencyKey when not a string", async () => {
    await listPOST(req({ meetingType: "general", priority: "low", durationMin: 15, timezone: "UTC", proposedStarts: ["2026-08-20T15:00:00Z"] }));
    const [, , , forwarded] = pv.mock.calls[0];
    expect(forwarded).not.toHaveProperty("idempotencyKey");
    expect(forwarded.notes).toBeNull();
  });
});

describe("GET /api/meetings/[id]", () => {
  it("proxies to Vault /meetings/<id>", async () => {
    await detailGET(req(), params("m-1"));
    expect(pv).toHaveBeenCalledWith(expect.anything(), "GET", "/meetings/m-1");
  });
});

describe("POST /api/meetings/[id]/cancel", () => {
  it("proxies with the optional note", async () => {
    await cancelPOST(req({ note: "bye" }), params("m-1"));
    expect(pv).toHaveBeenCalledWith(expect.anything(), "POST", "/meetings/m-1/cancel", { note: "bye" });
  });
});

describe("POST /api/meetings/[id]/respond", () => {
  it("forwards a valid accept_alternate + optionId", async () => {
    await respondPOST(req({ action: "accept_alternate", optionId: "o-1" }), params("m-1"));
    expect(pv).toHaveBeenCalledWith(expect.anything(), "POST", "/meetings/m-1/respond", { action: "accept_alternate", optionId: "o-1" });
  });
  it("forwards decline_alternate", async () => {
    await respondPOST(req({ action: "decline_alternate" }), params("m-1"));
    expect(pv).toHaveBeenCalledWith(expect.anything(), "POST", "/meetings/m-1/respond", { action: "decline_alternate" });
  });
  it("rejects an invalid action with 400 and never proxies (no broker actions)", async () => {
    const res = await respondPOST(req({ action: "confirm" }), params("m-1"));
    expect((res as Response).status).toBe(400);
    expect(pv).not.toHaveBeenCalled();
  });
});

describe("requireAuth gate", () => {
  it("short-circuits with the 401 response and never proxies", async () => {
    ra.mockResolvedValueOnce({ response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    const res = await listGET(req());
    expect((res as Response).status).toBe(401);
    expect(pv).not.toHaveBeenCalled();
  });
});
