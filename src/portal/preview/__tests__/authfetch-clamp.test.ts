// ============================================================================
// Broker Preview Agent View — authFetch read-only clamp (integration)
// ============================================================================
// Proves the single client chokepoint actually refuses a real mutation while in
// preview, BEFORE any network call — so every agent-facing write (AP routes AND
// Vault-direct) is neutralised. The allow/pass decisions are unit-covered in
// preview-state.test.ts; here we prove authFetch honours them.
// ============================================================================

import { authFetch } from "@/lib/supabase";
import { markPreviewActive, clearPreview, PreviewReadOnlyError } from "../preview-state";

const FLAG = "NEXT_PUBLIC_BROKER_PREVIEW_ENABLED";
const prev = process.env[FLAG];

afterEach(() => {
  clearPreview();
  if (prev === undefined) delete process.env[FLAG]; else process.env[FLAG] = prev;
  jest.restoreAllMocks();
});

describe("authFetch read-only clamp", () => {
  it("rejects a real mutation in preview mode before any network call", async () => {
    process.env[FLAG] = "true";
    markPreviewActive("tok.sig");
    const fetchMock = jest.fn();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    await expect(
      authFetch("https://vault.test/api/transactions/create", { method: "POST", body: "{}" }),
    ).rejects.toMatchObject({ code: "preview_read_only" });
    await expect(
      authFetch("https://vault.test/api/signing/send", { method: "POST" }),
    ).rejects.toBeInstanceOf(PreviewReadOnlyError);
    expect(fetchMock).not.toHaveBeenCalled(); // blocked before the wire
  });
});
