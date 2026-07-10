// ============================================================================
// TRANSACTION ASSISTANT 4.0D — assistant-api (client fetch) tests
// ============================================================================
// Offline — injected fetch + getToken. Verifies payload, Bearer header, envelope
// passthrough, status→friendly-error mapping, timeout (real AbortController),
// network error, and the lock-free-auth guarantee (no supabase.auth.getSession
// in the panel).

import { readFileSync } from "fs";
import { join } from "path";

import { askAssistant } from "../assistant-api";
import type { AssistantEnvelope } from "../assistant-types";

const ENVELOPE: AssistantEnvelope = {
  request_id: "req-1",
  context_version: "4.0B.1",
  directive_version: "3.4A",
  assistant_version: "4.0C.0",
  answer: "Here's what's next.",
  sources: ["Coordinator"],
  evidence: [{ source: "Coordinator", fact: "Workflow state is awaiting_broker" }],
  confidence: "high",
  suggested_actions: [],
  draft: null,
  warnings: [],
};

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
function errResponse(status: number, code?: string) {
  return { ok: false, status, json: async () => (code ? { error: { code } } : {}) } as unknown as Response;
}

const getToken = async () => "tkn-123";

describe("askAssistant — happy path", () => {
  it("posts message/history/mode, sends the Bearer, returns the envelope", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return okResponse(ENVELOPE);
    }) as unknown as typeof fetch;

    const res = await askAssistant({
      transactionId: "txn-1",
      message: "what's next?",
      history: [{ role: "user", content: "hi" }],
      mode: "explain",
      fetchImpl,
      getToken,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.envelope.answer).toBe("Here's what's next.");

    const { url, init } = calls[0];
    expect(url).toContain("/platform/transactions/txn-1/assistant");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tkn-123");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ message: "what's next?", history: [{ role: "user", content: "hi" }], mode: "explain" });
  });

  it("includes draft_type in the body when a draft is requested (4.0E.2)", async () => {
    const calls: Array<{ init: RequestInit }> = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      calls.push({ init });
      return okResponse(ENVELOPE);
    }) as unknown as typeof fetch;

    await askAssistant({ transactionId: "txn-1", message: "Buyer follow-up", history: [], draftType: "buyer_follow_up", fetchImpl, getToken });
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.draft_type).toBe("buyer_follow_up");
    expect(body.message).toBe("Buyer follow-up"); // non-empty (Vault rejects empty)
  });

  it("omits draft_type when not drafting", async () => {
    const calls: Array<{ init: RequestInit }> = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      calls.push({ init });
      return okResponse(ENVELOPE);
    }) as unknown as typeof fetch;
    await askAssistant({ transactionId: "txn-1", message: "hi", history: [], fetchImpl, getToken });
    const body = JSON.parse(calls[0].init.body as string);
    expect("draft_type" in body).toBe(false);
  });
});

describe("askAssistant — error mapping (never leaks raw errors)", () => {
  it.each([
    [401, undefined, "unauthorized"],
    [403, undefined, "forbidden"],
    [404, "not_found", "not_found"],
    [429, "assistant_rate_limited", "assistant_rate_limited"],
    [503, "assistant_unavailable", "assistant_unavailable"],
    [504, "assistant_timeout", "assistant_timeout"],
  ] as Array<[number, string | undefined, string]>)("status %s → mapped error", async (status, code, expectedCode) => {
    const fetchImpl = (async () => errResponse(status, code)) as unknown as typeof fetch;
    const res = await askAssistant({ transactionId: "txn-1", message: "x", history: [], fetchImpl, getToken });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe(expectedCode);
    expect(res.error.message).not.toMatch(/stack|Error:|\bundefined\b/);
  });

  it("no transactionId → no_transaction (no fetch)", async () => {
    const fetchImpl = jest.fn();
    const res = await askAssistant({ transactionId: "", message: "x", history: [], fetchImpl: fetchImpl as unknown as typeof fetch, getToken });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("no_transaction");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("network failure → network error", async () => {
    const fetchImpl = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    const res = await askAssistant({ transactionId: "txn-1", message: "x", history: [], fetchImpl, getToken });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("network");
  });

  it("timeout → aborts and maps to timeout (real AbortController)", async () => {
    // fetch that only settles when the signal aborts.
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
        );
      })) as unknown as typeof fetch;
    const res = await askAssistant({ transactionId: "txn-1", message: "x", history: [], fetchImpl, getToken, timeoutMs: 20 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("timeout");
  });
});

describe("lock-free auth guarantee", () => {
  it("the Assistant panel never uses supabase.auth.getSession()", () => {
    const src = readFileSync(join(__dirname, "..", "..", "AIAssistantPanel.tsx"), "utf8");
    expect(src).not.toContain("getSession");
    expect(src).not.toContain("auth.getSession");
  });
  it("assistant-api uses the lock-free getAccessToken helper by default", () => {
    const src = readFileSync(join(__dirname, "..", "assistant-api.ts"), "utf8");
    expect(src).toContain("getAccessToken");
    expect(src).not.toContain("getSession");
  });
});
