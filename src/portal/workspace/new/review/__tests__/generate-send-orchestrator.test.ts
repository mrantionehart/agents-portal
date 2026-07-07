/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.3D — generate/send orchestrator tests
// ============================================================================
// Injected fetch; no real network. Covers materialize→generate, skip-existing-
// instance, add/generate failures, 422 unbound_fields, send happy/skip-sent,
// 409 needsConnect, connection + preview helpers.
// ============================================================================

import {
  generatePackage,
  sendPackage,
  checkEsignConnected,
  getConnectUrl,
  getPreviewUrl,
} from "../generate-send-orchestrator";

interface H {
  status: number;
  data: any;
}
function makeFetch(route: (url: string, method: string, body: any) => H) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const fetchImpl = (async (url: string, init: any) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const h = route(String(url), method, body);
    return { ok: h.status >= 200 && h.status < 300, status: h.status, json: async () => h.data } as any;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("generatePackage", () => {
  it("generates an existing instance (no materialize call)", async () => {
    const { fetchImpl, calls } = makeFetch((url) => {
      if (url.endsWith("/generate")) return { status: 200, data: { ok: true, filled_count: 3 } };
      return { status: 404, data: {} };
    });
    const res = await generatePackage("txn-1", [{ form_id: "RLHD-3x", form_instance_id: "fi-1" }], { fetchImpl });
    expect(res).toEqual([{ form_id: "RLHD-3x", form_instance_id: "fi-1", ok: true }]);
    expect(calls.some((c) => c.url.includes("/forms/add"))).toBe(false);
    expect(calls.some((c) => c.url.includes("/documents/fi-1/generate"))).toBe(true);
  });

  it("materializes an optional form (forms/add) then generates", async () => {
    const { fetchImpl, calls } = makeFetch((url) => {
      if (url.endsWith("/forms/add")) return { status: 201, data: { form_instance_id: "fi-new", created: true } };
      if (url.endsWith("/generate")) return { status: 200, data: { ok: true, filled_count: 1 } };
      return { status: 404, data: {} };
    });
    const res = await generatePackage("txn-1", [{ form_id: "CDS-1" }], { fetchImpl });
    expect(res[0]).toEqual({ form_id: "CDS-1", form_instance_id: "fi-new", ok: true });
    expect(calls[0].url).toContain("/forms/add");
    expect(calls[0].body).toEqual({ form_id: "CDS-1" });
    expect(calls[1].url).toContain("/documents/fi-new/generate");
  });

  it("materialize failure → outcome not ok, no generate", async () => {
    const { fetchImpl, calls } = makeFetch((url) => {
      if (url.endsWith("/forms/add")) return { status: 400, data: { error: "no template" } };
      return { status: 200, data: { ok: true } };
    });
    const res = await generatePackage("txn-1", [{ form_id: "ZZ" }], { fetchImpl });
    expect(res[0]).toMatchObject({ form_id: "ZZ", ok: false, error: "no template" });
    expect(calls.some((c) => c.url.endsWith("/generate"))).toBe(false);
  });

  it("generate 422 surfaces unbound_fields", async () => {
    const { fetchImpl } = makeFetch((url) => {
      if (url.endsWith("/generate")) return { status: 422, data: { ok: false, step: "incomplete_fill", unbound_fields: ["buyer_name"] } };
      return { status: 200, data: {} };
    });
    const res = await generatePackage("txn-1", [{ form_id: "X", form_instance_id: "fi-x" }], { fetchImpl });
    expect(res[0]).toMatchObject({ ok: false, unbound_fields: ["buyer_name"] });
  });
});

describe("sendPackage", () => {
  it("sends ready forms", async () => {
    const { fetchImpl } = makeFetch((url) => {
      if (url.endsWith("/send")) return { status: 200, data: { ok: true, envelope_id: "env-1", status: "sent" } };
      return { status: 404, data: {} };
    });
    const r = await sendPackage("txn-1", [{ form_id: "A", form_instance_id: "fi-a" }], { fetchImpl });
    expect(r.needsConnect).toBe(false);
    expect(r.results[0]).toEqual({ form_id: "A", form_instance_id: "fi-a", ok: true });
  });

  it("skips already-sent forms", async () => {
    const { fetchImpl, calls } = makeFetch(() => ({ status: 200, data: { ok: true } }));
    const r = await sendPackage("txn-1", [{ form_id: "A", form_instance_id: "fi-a", disposition: "sent_for_signature" }], { fetchImpl });
    expect(r.results[0]).toMatchObject({ ok: true, skipped: true });
    expect(calls.some((c) => c.url.endsWith("/send"))).toBe(false);
  });

  it("409 esign_not_connected → needsConnect, stops", async () => {
    const { fetchImpl } = makeFetch((url) => {
      if (url.endsWith("/send")) return { status: 409, data: { code: "esign_not_connected" } };
      return { status: 200, data: {} };
    });
    const r = await sendPackage(
      "txn-1",
      [{ form_id: "A", form_instance_id: "fi-a" }, { form_id: "B", form_instance_id: "fi-b" }],
      { fetchImpl }
    );
    expect(r.needsConnect).toBe(true);
    expect(r.results).toHaveLength(1); // stopped after the first
  });

  it("missing instance → not ok", async () => {
    const { fetchImpl } = makeFetch(() => ({ status: 200, data: { ok: true } }));
    const r = await sendPackage("txn-1", [{ form_id: "A" }], { fetchImpl });
    expect(r.results[0]).toMatchObject({ ok: false });
  });
});

describe("connection + preview helpers", () => {
  it("checkEsignConnected reads status.connected", async () => {
    const yes = makeFetch(() => ({ status: 200, data: { connected: true } }));
    expect(await checkEsignConnected({ fetchImpl: yes.fetchImpl })).toBe(true);
    const no = makeFetch(() => ({ status: 200, data: { connected: false } }));
    expect(await checkEsignConnected({ fetchImpl: no.fetchImpl })).toBe(false);
  });
  it("getConnectUrl returns redirectUrl", async () => {
    const { fetchImpl } = makeFetch(() => ({ status: 200, data: { redirectUrl: "https://docusign/oauth" } }));
    expect(await getConnectUrl({ fetchImpl })).toBe("https://docusign/oauth");
  });
  it("getPreviewUrl returns signed_url", async () => {
    const { fetchImpl } = makeFetch(() => ({ status: 200, data: { signed_url: "https://s3/signed" } }));
    expect(await getPreviewUrl("txn-1", "fi-1", { fetchImpl })).toBe("https://s3/signed");
  });
});
