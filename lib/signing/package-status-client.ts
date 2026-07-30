// ============================================================================
// Slice 2 Phase 3B-3.5 · Signing package-status typed client + coercer
// ============================================================================
// Runtime-safe fetcher for the AP proxy at
//   GET /api/signing/packages/[packageId]
// which forwards to Vault's agent-safe package-detail endpoint. The wire
// shape mirrors Vault's SigningPackageDetailResult discriminated union:
//   { viewer: 'agent' | 'broker', package: AgentPackageDetail | BrokerPackageDetail }
//
// This slice consumes ONLY the agent projection. The coercer:
//   * accepts the discriminator strictly (rejects unknown viewers)
//   * validates the exact minimal field set 3B-4 needs (§3B-4 workflow "View
//     status" + rejected-state affordance)
//   * strips unknown / broker-only fields even if the wire shape ever drifts
//     to include them (defensive — never renders broker-only data on an
//     agent-facing page)
//   * exposes rejection_reason only when it is a non-empty string
//   * exposes previous_package_id only when it is a UUID
//
// Read-side only — this file never mutates, submits, or invokes the composer.
// ============================================================================

/** Package lifecycle vocabulary the agent UI understands. Extra values
 *  are treated as "unknown" and rendered as a neutral status. */
export type AgentPackageStatus =
  | "awaiting_broker_approval"
  | "approved"
  | "rejected"
  | "unknown";

/** Approval sub-status vocabulary from the Vault projection. */
export type AgentApprovalStatus = "pending" | "approved" | "rejected" | "unknown";

/**
 * The minimal set of fields 3B-4 needs — a strict subset of Vault's
 * AgentPackageDetail projection. Broker-only fields, actor UUIDs, tenant
 * ids, and approval-note text are intentionally NOT in this type so the
 * UI cannot render them even by accident.
 */
export interface SigningPackageAgentView {
  readonly package_id: string;
  readonly matter_id: string;
  readonly transaction_id: string;
  readonly package_status: AgentPackageStatus;
  readonly approval_status: AgentApprovalStatus;
  readonly routing_order: string;
  readonly plan_version: "v1" | "v2";
  readonly previous_package_id: string | null;
  readonly created_at: string;
  readonly submitted_at: string;
  readonly approved_at: string | null;
  readonly ready_at: string | null;
  readonly rejected_at: string | null;
  readonly document_count: number;
  readonly recipient_count: number;
  /** Populated only when the package is rejected AND the caller is the
   *  owning agent AND a rejection audit note exists. Absent otherwise. */
  readonly rejection_reason?: string;
}

/** Structured fetch result. Discriminated on `ok`. Never throws for
 *  expected HTTP or shape failures — the caller renders per the code. */
export type FetchPackageStatusResult =
  | { readonly ok: true; readonly package: SigningPackageAgentView }
  | { readonly ok: false; readonly kind: "unauthorized"; readonly httpStatus: 401 }
  | { readonly ok: false; readonly kind: "forbidden"; readonly httpStatus: 403 }
  | { readonly ok: false; readonly kind: "not_found"; readonly httpStatus: 404 }
  | { readonly ok: false; readonly kind: "vault_unreachable"; readonly httpStatus: 502 }
  | { readonly ok: false; readonly kind: "invalid_response"; readonly httpStatus: number }
  | { readonly ok: false; readonly kind: "unexpected_status"; readonly httpStatus: number };

/** UUID (any version, case-insensitive) — mirrors the app-wide regex. */
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const KNOWN_PACKAGE_STATUSES: ReadonlySet<AgentPackageStatus> = new Set([
  "awaiting_broker_approval",
  "approved",
  "rejected",
]);

const KNOWN_APPROVAL_STATUSES: ReadonlySet<AgentApprovalStatus> = new Set([
  "pending",
  "approved",
  "rejected",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asIso(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Coerce a Vault package-detail wire body to the AP-safe view. Returns
 * null when the shape is drift-broken (unexpected viewer, missing
 * required id, etc.) — the caller then renders `invalid_response`.
 */
export function coercePackageResponse(body: unknown): SigningPackageAgentView | null {
  if (!isPlainObject(body)) return null;
  if (body.viewer !== "agent") return null;
  const pkg = body.package;
  if (!isPlainObject(pkg)) return null;

  if (typeof pkg.package_id !== "string" || !UUID_RE.test(pkg.package_id)) return null;
  if (typeof pkg.matter_id !== "string" || !UUID_RE.test(pkg.matter_id)) return null;
  if (typeof pkg.transaction_id !== "string" || !UUID_RE.test(pkg.transaction_id)) return null;

  const packageStatus: AgentPackageStatus = KNOWN_PACKAGE_STATUSES.has(
    pkg.package_status as AgentPackageStatus,
  )
    ? (pkg.package_status as AgentPackageStatus)
    : "unknown";

  const approvalStatus: AgentApprovalStatus = KNOWN_APPROVAL_STATUSES.has(
    pkg.approval_status as AgentApprovalStatus,
  )
    ? (pkg.approval_status as AgentApprovalStatus)
    : "unknown";

  const routingOrder =
    typeof pkg.routing_order === "string" && pkg.routing_order.length > 0
      ? pkg.routing_order
      : "";

  const planVersion: "v1" | "v2" = pkg.plan_version === "v2" ? "v2" : "v1";

  let previousPackageId: string | null = null;
  if (typeof pkg.previous_package_id === "string" && UUID_RE.test(pkg.previous_package_id)) {
    previousPackageId = pkg.previous_package_id;
  }

  const documentCount = typeof pkg.document_count === "number" ? pkg.document_count : 0;
  const recipientCount = typeof pkg.recipient_count === "number" ? pkg.recipient_count : 0;

  const createdAt =
    typeof pkg.created_at === "string" && pkg.created_at.length > 0 ? pkg.created_at : "";
  const submittedAt =
    typeof pkg.submitted_at === "string" && pkg.submitted_at.length > 0
      ? pkg.submitted_at
      : createdAt;

  const view: SigningPackageAgentView = {
    package_id: pkg.package_id,
    matter_id: pkg.matter_id,
    transaction_id: pkg.transaction_id,
    package_status: packageStatus,
    approval_status: approvalStatus,
    routing_order: routingOrder,
    plan_version: planVersion,
    previous_package_id: previousPackageId,
    created_at: createdAt,
    submitted_at: submittedAt,
    approved_at: asIso(pkg.approved_at),
    ready_at: asIso(pkg.ready_at),
    rejected_at: asIso(pkg.rejected_at),
    document_count: documentCount,
    recipient_count: recipientCount,
    // rejection_reason is exposed by Vault ONLY when the caller owns the
    // parent transaction, the package is rejected, and an audit note exists.
    // When present, expose it; otherwise omit the key entirely.
    ...(typeof pkg.rejection_reason === "string" && pkg.rejection_reason.length > 0
      ? { rejection_reason: pkg.rejection_reason }
      : {}),
  };
  return Object.freeze(view);
}

/**
 * Fetch the signing package status from the AP proxy. Pure over the given
 * `fetchImpl` — pass a mock in tests. Uses same-origin credentials so the
 * Supabase session cookie is forwarded to the proxy route.
 */
export async function fetchSigningPackageStatus(
  packageId: string,
  opts: { readonly fetchImpl?: typeof fetch } = {},
): Promise<FetchPackageStatusResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(
      `/api/signing/packages/${encodeURIComponent(packageId)}`,
      { method: "GET", credentials: "same-origin", cache: "no-store" },
    );
  } catch {
    return { ok: false, kind: "vault_unreachable", httpStatus: 502 };
  }
  if (res.status === 401) return { ok: false, kind: "unauthorized", httpStatus: 401 };
  if (res.status === 403) return { ok: false, kind: "forbidden", httpStatus: 403 };
  if (res.status === 404) return { ok: false, kind: "not_found", httpStatus: 404 };
  if (res.status === 502) return { ok: false, kind: "vault_unreachable", httpStatus: 502 };
  if (res.status !== 200) {
    return { ok: false, kind: "unexpected_status", httpStatus: res.status };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, kind: "invalid_response", httpStatus: 200 };
  }
  const view = coercePackageResponse(body);
  if (!view) return { ok: false, kind: "invalid_response", httpStatus: 200 };
  return { ok: true, package: view };
}
