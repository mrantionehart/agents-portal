// ============================================================================
// Broker Preview Agent View — preview-state logic
// ============================================================================
// The security core: the capability is dark by default, and when active the
// read-only clamp blocks every mutation EXCEPT the isolated Ring roleplay
// practice paths.
// ============================================================================

import {
  brokerPreviewEnabled,
  isBrokerOfRecord,
  isPreviewActive,
  markPreviewActive,
  clearPreview,
  isSafeInteractiveUrl,
  previewBlocksRequest,
} from "../preview-state";

const FLAG = "NEXT_PUBLIC_BROKER_PREVIEW_ENABLED";
const prev = process.env[FLAG];

afterEach(() => {
  clearPreview();
  if (prev === undefined) delete process.env[FLAG];
  else process.env[FLAG] = prev;
});

describe("capability flag (dark by default)", () => {
  it("brokerPreviewEnabled is false unless the flag is exactly 'true'", () => {
    delete process.env[FLAG];
    expect(brokerPreviewEnabled()).toBe(false);
    process.env[FLAG] = "1";
    expect(brokerPreviewEnabled()).toBe(false);
    process.env[FLAG] = "true";
    expect(brokerPreviewEnabled()).toBe(true);
  });

  it("isPreviewActive stays false while the flag is off, even if the tab flag is set", () => {
    delete process.env[FLAG];
    markPreviewActive("tok.sig");
    expect(isPreviewActive()).toBe(false);
  });

  it("isPreviewActive is true only with flag ON and the per-tab marker set", () => {
    process.env[FLAG] = "true";
    expect(isPreviewActive()).toBe(false);
    markPreviewActive("tok.sig");
    expect(isPreviewActive()).toBe(true);
    clearPreview();
    expect(isPreviewActive()).toBe(false);
  });
});

describe("isBrokerOfRecord (BoR only)", () => {
  it("admits ONLY role-exact broker — Emily (office_manager), admins, agents excluded", () => {
    expect(isBrokerOfRecord("broker")).toBe(true);
    for (const r of ["admin", "office_manager", "agent", "new_agent", null, undefined, ""]) {
      expect(isBrokerOfRecord(r as string)).toBe(false);
    }
  });
});

describe("read-only clamp — isSafeInteractiveUrl", () => {
  it("permits ONLY the isolated Ring roleplay practice paths", () => {
    expect(isSafeInteractiveUrl("https://vault/api/simulation/text/prepare")).toBe(true);
    expect(isSafeInteractiveUrl("https://vault/api/simulation/text/turn")).toBe(true);
    expect(isSafeInteractiveUrl("https://vault/api/simulation/practice/join")).toBe(true);
  });
  it("never permits assessments (they count) or real mutations", () => {
    expect(isSafeInteractiveUrl("https://vault/api/simulation/text/assessment/begin")).toBe(false);
    expect(isSafeInteractiveUrl("https://vault/api/transactions/create")).toBe(false);
    expect(isSafeInteractiveUrl("https://vault/api/signing/send")).toBe(false);
    expect(isSafeInteractiveUrl("/api/profile/update")).toBe(false);
  });
});

describe("previewBlocksRequest", () => {
  beforeEach(() => {
    process.env[FLAG] = "true";
    markPreviewActive("tok.sig");
  });

  it("allows all reads", () => {
    expect(previewBlocksRequest("GET", "/api/transactions")).toBe(false);
    expect(previewBlocksRequest(undefined, "/api/anything")).toBe(false);
  });

  it("blocks real mutations (deals, signing, assignments, payouts, notifications, profile)", () => {
    for (const [m, u] of [
      ["POST", "/api/transactions/create"],
      ["POST", "/api/signing/send"],
      ["POST", "/api/platform/certifications/assignments"],
      ["POST", "/api/settings/payouts"],
      ["PATCH", "/api/profile"],
      ["DELETE", "/api/followups/1"],
    ] as const) {
      expect(previewBlocksRequest(m, u)).toBe(true);
    }
  });

  it("permits the isolated Ring roleplay practice mutations", () => {
    expect(previewBlocksRequest("POST", "https://vault/api/simulation/text/prepare")).toBe(false);
    expect(previewBlocksRequest("POST", "https://vault/api/simulation/text/complete")).toBe(false);
  });

  it("is a no-op when preview is not active (normal agent/broker use is unaffected)", () => {
    clearPreview();
    expect(previewBlocksRequest("POST", "/api/transactions/create")).toBe(false);
    delete process.env[FLAG];
    markPreviewActive("tok.sig");
    expect(previewBlocksRequest("POST", "/api/transactions/create")).toBe(false);
  });
});
