// ============================================================================
// Slice 2 Phase 3B-3.5 · Signing package status — CLIENT view
// ============================================================================
// (Split from page.tsx at Slice 3B-4 to enable a Server Component wrapper
// that reads the AP_SIGNING_COMPOSER_ENABLED flag and passes the resolved
// boolean as `composerEnabled` — the "Revise package" link is only shown
// when the package is rejected AND the flag is ON.)
//
// Minimal, read-only status view for a signing package. Renders:
//   * current package + approval status
//   * key lifecycle timestamps (submitted / approved / rejected)
//   * rejection_reason ONLY when it is present in the Vault projection
//     (Vault exposes it only to the owning agent + only for rejected pkgs)
//   * previous-package relationship + a "View previous submission" link
//     when previous_package_id is present
//   * "Revise package" link when rejected + composer flag ON (3B-4)
//
// Explicitly OUT OF SCOPE:
//   * broker approval / rejection controls
//   * audit history (blocked upstream by Vault for agents)
//   * approval notes
// ============================================================================

"use client";

import Link from "next/link";

import { useSigningPackageStatus } from "@/hooks/useSigningPackageStatus";

interface PackageStatusClientProps {
  readonly packageId: string;
  /** Resolved server-side from AP_SIGNING_COMPOSER_ENABLED. When true and
   *  the package is rejected, the "Revise package" affordance appears. */
  readonly composerEnabled: boolean;
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  awaiting_broker_approval: "Awaiting broker approval",
  approved: "Approved",
  rejected: "Rejected",
  unknown: "Status unavailable",
};

const APPROVAL_LABELS: Readonly<Record<string, string>> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  unknown: "Unknown",
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function PackageStatusClient({
  packageId,
  composerEnabled,
}: PackageStatusClientProps) {
  const state = useSigningPackageStatus(packageId);

  if (state.phase === "loading") {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <p aria-live="polite">Loading package status…</p>
      </main>
    );
  }

  const result = state.result;

  if (!result.ok) {
    // Unified unavailable / not-found experience for anything that isn't a
    // clean 200 with a decodable body. We deliberately do NOT distinguish
    // 403 vs 404 to the caller — Vault's own contract already leaks nothing
    // when the agent doesn't own the package.
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>Package unavailable</h1>
        <p style={{ marginTop: 12 }}>
          This signing package is not available. It may not exist, or you may
          not have access to it.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/transactions">Back to transactions</Link>
        </p>
      </main>
    );
  }

  const pkg = result.package;
  const statusLabel = STATUS_LABELS[pkg.package_status] ?? "Status unavailable";
  const approvalLabel = APPROVAL_LABELS[pkg.approval_status] ?? "Unknown";
  const isRejected = pkg.package_status === "rejected";

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <nav style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/transactions">Transactions</Link>
        <span aria-hidden> &rsaquo; </span>
        <Link href={`/transactions/${encodeURIComponent(pkg.transaction_id)}`}>
          Transaction
        </Link>
        <span aria-hidden> &rsaquo; Signing package</span>
      </nav>

      <h1 style={{ margin: 0 }}>Signing package</h1>
      <p style={{ marginTop: 4, color: "#666", fontSize: 14 }}>
        {pkg.document_count} document{pkg.document_count === 1 ? "" : "s"} ·{" "}
        {pkg.recipient_count} recipient{pkg.recipient_count === 1 ? "" : "s"} ·{" "}
        {pkg.routing_order || "unknown"} routing
      </p>

      <section aria-label="Package status" style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 8, fontSize: 18 }}>Status</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 8 }}>
          <dt style={{ color: "#666" }}>Package</dt>
          <dd style={{ margin: 0 }}>{statusLabel}</dd>
          <dt style={{ color: "#666" }}>Broker review</dt>
          <dd style={{ margin: 0 }}>{approvalLabel}</dd>
          <dt style={{ color: "#666" }}>Submitted</dt>
          <dd style={{ margin: 0 }}>{formatTimestamp(pkg.submitted_at)}</dd>
          {pkg.approved_at ? (
            <>
              <dt style={{ color: "#666" }}>Approved</dt>
              <dd style={{ margin: 0 }}>{formatTimestamp(pkg.approved_at)}</dd>
            </>
          ) : null}
          {pkg.rejected_at ? (
            <>
              <dt style={{ color: "#666" }}>Rejected</dt>
              <dd style={{ margin: 0 }}>{formatTimestamp(pkg.rejected_at)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {isRejected && pkg.rejection_reason ? (
        <section aria-label="Rejection reason" style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 8, fontSize: 18 }}>Rejection reason</h2>
          <p
            style={{
              margin: 0,
              padding: 12,
              background: "#fdecec",
              border: "1px solid #f5c2c2",
              borderRadius: 4,
              whiteSpace: "pre-wrap",
            }}
          >
            {pkg.rejection_reason}
          </p>
        </section>
      ) : null}

      {pkg.previous_package_id ? (
        <section aria-label="Previous submission" style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 8, fontSize: 18 }}>Previous submission</h2>
          <p style={{ margin: 0 }}>
            This package is a revision of a previous submission.{" "}
            <Link
              href={`/signing/packages/${encodeURIComponent(pkg.previous_package_id)}`}
            >
              View previous submission
            </Link>
          </p>
        </section>
      ) : null}

      {isRejected && composerEnabled ? (
        <section aria-label="Revise package" style={{ marginTop: 24 }}>
          <p style={{ margin: 0 }}>
            <Link
              href={`/signing/transactions/${encodeURIComponent(pkg.transaction_id)}/compose?previous_package_id=${encodeURIComponent(pkg.package_id)}`}
            >
              Revise package
            </Link>
          </p>
        </section>
      ) : null}

      {isRejected && !composerEnabled ? (
        <section aria-label="Next steps" style={{ marginTop: 24 }}>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            The signing composer workflow is not yet available. Once enabled,
            you'll be able to open a revision from here.
          </p>
        </section>
      ) : null}
    </main>
  );
}
