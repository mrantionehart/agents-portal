/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — Sidebar active-route highlighting
// ============================================================================
// Pure helper lives in nav-config so this test does not need a DOM env.
// ============================================================================

import { isActiveRoute } from "../nav-config";

describe("isActiveRoute (sidebar highlighting)", () => {
  it("/home matches exactly /home", () => {
    expect(isActiveRoute("/home", "/home")).toBe(true);
    expect(isActiveRoute("/home/anything", "/home")).toBe(false);
  });

  it("/workspace matches /workspace AND /workspace/<id>", () => {
    expect(isActiveRoute("/workspace", "/workspace")).toBe(true);
    expect(isActiveRoute("/workspace/abc-123", "/workspace")).toBe(true);
    expect(isActiveRoute("/workspace/abc-123/forms", "/workspace")).toBe(true);
  });

  it("/clients does not match /clients-other (prefix-only false-positive guard)", () => {
    expect(isActiveRoute("/clients-other", "/clients")).toBe(false);
  });

  it("siblings are not co-highlighted", () => {
    expect(isActiveRoute("/workspace", "/transactions")).toBe(false);
  });

  it("nested settings sections highlight Settings", () => {
    expect(isActiveRoute("/settings/profile", "/settings")).toBe(true);
    expect(isActiveRoute("/settings", "/settings")).toBe(true);
  });
});
