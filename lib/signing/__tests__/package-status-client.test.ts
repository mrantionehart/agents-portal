/**
 * @jest-environment node
 */
// ============================================================================
// Slice 2 Phase 3B-3.5 · package-status-client coercer + fetcher tests
// ============================================================================
// Covers:
//   * coercePackageResponse — accepts valid agent projection; drops broker
//     projections; drops broken shapes; freezes the returned view; enforces
//     UUID id fields; strips unknown fields; carries rejection_reason only
//     when a non-empty string; carries previous_package_id only when UUID
//   * fetchSigningPackageStatus — status-code → discriminated result mapping
//     for 200, 401, 403, 404, 502, non-JSON body, unexpected status
// ============================================================================

import {
  coercePackageResponse,
  fetchSigningPackageStatus,
  type FetchPackageStatusResult,
} from "../package-status-client";

// AP tsconfig has `strict: false`, so discriminated-union narrowing on
// `if (!r.ok)` does NOT narrow `kind` visibility. Cast to the failure
// variant explicitly for `kind`-side assertions.
type FailBranch = Exclude<FetchPackageStatusResult, { ok: true }>;
const asFailure = (r: FetchPackageStatusResult): FailBranch => r as FailBranch;

const VALID_PKG_ID = "00000000-0000-4000-8000-000000000001";
const VALID_MATTER_ID = "00000000-0000-4000-8000-000000000002";
const VALID_TXN_ID = "00000000-0000-4000-8000-000000000003";
const VALID_PREV_ID = "00000000-0000-4000-8000-000000000004";

function base(pkgOver: Record<string, unknown> = {}) {
  return {
    viewer: "agent",
    package: {
      package_id: VALID_PKG_ID,
      matter_id: VALID_MATTER_ID,
      transaction_id: VALID_TXN_ID,
      package_status: "awaiting_broker_approval",
      approval_status: "pending",
      routing_order: "parallel",
      plan_version: "v1",
      previous_package_id: null,
      created_at: "2026-08-01T12:00:00Z",
      submitted_at: "2026-08-01T12:00:00Z",
      approved_at: null,
      ready_at: null,
      rejected_at: null,
      document_count: 1,
      recipient_count: 1,
      ...pkgOver,
    },
  };
}

// ─── coercer ──────────────────────────────────────────────────────────────

describe("coercePackageResponse", () => {
  it("accepts a canonical agent projection", () => {
    const v = coercePackageResponse(base());
    expect(v).not.toBeNull();
    expect(v!.package_id).toBe(VALID_PKG_ID);
    expect(v!.package_status).toBe("awaiting_broker_approval");
  });

  it("rejects broker-viewer body (never renders broker projection in AP)", () => {
    expect(coercePackageResponse({ viewer: "broker", package: {} })).toBeNull();
  });

  it("rejects missing viewer discriminator", () => {
    expect(coercePackageResponse({ package: {} })).toBeNull();
  });

  it("rejects non-object body", () => {
    expect(coercePackageResponse(null)).toBeNull();
    expect(coercePackageResponse([])).toBeNull();
    expect(coercePackageResponse("string")).toBeNull();
  });

  it("rejects missing package_id / matter_id / transaction_id", () => {
    expect(coercePackageResponse(base({ package_id: undefined }))).toBeNull();
    expect(coercePackageResponse(base({ matter_id: "not-a-uuid" }))).toBeNull();
    expect(coercePackageResponse(base({ transaction_id: 123 }))).toBeNull();
  });

  it("coerces unknown package_status to 'unknown' (safe fallback)", () => {
    const v = coercePackageResponse(base({ package_status: "mystery_state" }));
    expect(v!.package_status).toBe("unknown");
  });

  it("coerces unknown approval_status to 'unknown'", () => {
    const v = coercePackageResponse(base({ approval_status: "mystery" }));
    expect(v!.approval_status).toBe("unknown");
  });

  it("coerces plan_version 'v2' → 'v2', anything else → 'v1'", () => {
    expect(coercePackageResponse(base({ plan_version: "v2" }))!.plan_version).toBe("v2");
    expect(coercePackageResponse(base({ plan_version: "v1" }))!.plan_version).toBe("v1");
    expect(coercePackageResponse(base({ plan_version: "v3" }))!.plan_version).toBe("v1");
    expect(coercePackageResponse(base({ plan_version: undefined }))!.plan_version).toBe("v1");
  });

  it("previous_package_id kept only when a UUID; null otherwise", () => {
    expect(coercePackageResponse(base({ previous_package_id: VALID_PREV_ID }))!.previous_package_id).toBe(VALID_PREV_ID);
    expect(coercePackageResponse(base({ previous_package_id: "not-uuid" }))!.previous_package_id).toBeNull();
    expect(coercePackageResponse(base({ previous_package_id: null }))!.previous_package_id).toBeNull();
    expect(coercePackageResponse(base({ previous_package_id: undefined }))!.previous_package_id).toBeNull();
  });

  it("rejection_reason exposed only when non-empty string", () => {
    const with_ = coercePackageResponse(base({ package_status: "rejected", rejection_reason: "missing signature" }));
    expect(with_!.rejection_reason).toBe("missing signature");
    const empty = coercePackageResponse(base({ package_status: "rejected", rejection_reason: "" }));
    expect(empty).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(empty!, "rejection_reason")).toBe(false);
    const absent = coercePackageResponse(base({ package_status: "rejected" }));
    expect(Object.prototype.hasOwnProperty.call(absent!, "rejection_reason")).toBe(false);
  });

  it("STRIPS broker-only fields even if the wire body ever includes them", () => {
    const withLeaks = coercePackageResponse(
      base({
        tenant_id: "leaked",
        created_by: "broker-user-uuid",
        submitted_by: "broker-user-uuid",
        package_name: "internal-name",
        updated_at: "2026-08-01T12:00:00Z",
        package_source: "composed",
        approved_payload_snapshot: { should: "not appear" },
        matter_type: "broker_approval_package",
        matter_status: "open",
      }),
    );
    // None of the broker-only keys survive.
    for (const k of [
      "tenant_id",
      "created_by",
      "submitted_by",
      "package_name",
      "updated_at",
      "package_source",
      "approved_payload_snapshot",
      "matter_type",
      "matter_status",
    ]) {
      expect(Object.prototype.hasOwnProperty.call(withLeaks!, k)).toBe(false);
    }
  });

  it("returns a frozen object (defensive immutability)", () => {
    const v = coercePackageResponse(base());
    expect(Object.isFrozen(v)).toBe(true);
  });

  it("document_count / recipient_count default to 0 on non-number", () => {
    const v = coercePackageResponse(base({ document_count: "not-a-number", recipient_count: null }));
    expect(v!.document_count).toBe(0);
    expect(v!.recipient_count).toBe(0);
  });
});

// ─── fetcher (status-code → discriminated result) ─────────────────────────

function makeFetchImpl(res: Partial<{ status: number; body: unknown; throws: boolean; nonJson: boolean }>) {
  return async () => {
    if (res.throws) throw new Error("network fail");
    return {
      status: res.status ?? 200,
      json: async () => {
        if (res.nonJson) throw new Error("bad json");
        return res.body;
      },
    } as unknown as Response;
  };
}

describe("fetchSigningPackageStatus", () => {
  it("200 with valid body → ok:true with package", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ status: 200, body: base() }),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.package.package_id).toBe(VALID_PKG_ID);
  });

  it("200 with invalid body → invalid_response", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ status: 200, body: { viewer: "broker", package: {} } }),
    });
    expect(r.ok).toBe(false);
    expect(asFailure(r).kind).toBe("invalid_response");
  });

  it("200 with non-JSON body → invalid_response", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ status: 200, nonJson: true }),
    });
    expect(r.ok).toBe(false);
    expect(asFailure(r).kind).toBe("invalid_response");
  });

  it("401 → unauthorized", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ status: 401 }),
    });
    expect(r.ok).toBe(false);
    expect(asFailure(r).kind).toBe("unauthorized");
  });

  it("403 → forbidden", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ status: 403 }),
    });
    expect(r.ok).toBe(false);
    expect(asFailure(r).kind).toBe("forbidden");
  });

  it("404 → not_found", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ status: 404 }),
    });
    expect(r.ok).toBe(false);
    expect(asFailure(r).kind).toBe("not_found");
  });

  it("502 → vault_unreachable", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ status: 502 }),
    });
    expect(r.ok).toBe(false);
    expect(asFailure(r).kind).toBe("vault_unreachable");
  });

  it("network error → vault_unreachable", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ throws: true }),
    });
    expect(r.ok).toBe(false);
    expect(asFailure(r).kind).toBe("vault_unreachable");
  });

  it("500 → unexpected_status", async () => {
    const r = await fetchSigningPackageStatus(VALID_PKG_ID, {
      fetchImpl: makeFetchImpl({ status: 500 }),
    });
    expect(r.ok).toBe(false);
    expect(asFailure(r).kind).toBe("unexpected_status");
  });
});
