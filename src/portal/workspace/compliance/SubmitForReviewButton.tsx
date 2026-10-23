// ============================================================================
// TRANSACTION OS 3.3E — Submit for Review (in-workspace action)
// ============================================================================
// Client button that submits the transaction for broker review via the thin
// portal forward to the existing Vault submit-review endpoint. No broker-review
// engine change — the button only calls the endpoint and refreshes the page so
// the status pill updates.
// ============================================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, AlertCircle } from "lucide-react";

export interface SubmitForReviewButtonProps {
  transactionId: string;
  /** Injectable for tests (defaults to window.fetch). */
  fetchImpl?: typeof fetch;
  /**
   * P4H-13 — when this transaction carries an agreement that is reviewed
   * before submission (ERL-14), the form instance and its form id. Both
   * absent keeps the button byte-identical to what it was: one POST to
   * submit-review and nothing else. That matters because this button also
   * submits FAR-BAR and lease transactions.
   */
  reviewFormInstanceId?: string | null;
  reviewFormId?: string | null;
}

/** Forms whose submission runs the review first. */
const REVIEWED_FORM_IDS = ["ERL-14"];

type Verdict = "pass" | "needs_correction" | "manual_review";

interface ReviewFinding {
  code: string;
  kind: "blocking" | "advisory" | "judgment";
  label: string;
  detail: string;
}

export default function SubmitForReviewButton({
  transactionId,
  fetchImpl,
  reviewFormInstanceId,
  reviewFormId,
}: SubmitForReviewButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [blocked, setBlocked] = useState<ReviewFinding[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reviewFirst =
    !!reviewFormInstanceId && !!reviewFormId && REVIEWED_FORM_IDS.includes(reviewFormId);

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    setBlocked(null);
    setNotice(null);
    const doFetch = fetchImpl ?? fetch;
    try {
      // ── P4H-13 · review before submitting ──────────────────────────
      // POST, not GET: the POST verb is the only one that can reach the
      // optional semantic pass, and Vault caches the result against the
      // document checksum so this costs nothing on a resubmit of unchanged
      // bytes. Deterministic checks run first inside Vault and decide; the
      // model can only ever add a judgment finding.
      if (reviewFirst) {
        const rev = await doFetch(
          `/api/paperwork/compliance-review/${transactionId}/${reviewFormInstanceId}`,
          { method: "POST", credentials: "include" },
        );
        const body = await rev.json().catch(() => null);
        if (!rev.ok) {
          // A review that did not run is not permission to submit.
          setError(body?.error || "Couldn't run the checks — nothing was submitted.");
          setBusy(false);
          return;
        }
        const verdict: Verdict | undefined = body?.review?.verdict;
        if (verdict === "needs_correction") {
          // Back to the agent. The findings say what to fix.
          setBlocked(
            (body.review.findings ?? []).filter(
              (f: ReviewFinding) => f.kind === "blocking",
            ),
          );
          setBusy(false);
          return;
        }
        // PASS and MANUAL_REVIEW both proceed; the broker sees the findings on
        // their own card. Say plainly when the semantic pass did not run, so a
        // clean result is not mistaken for a model having looked.
        if (body?.semantic === "skipped") {
          setNotice("Automatic checks passed. AI review was not performed.");
        } else if (body?.semantic === "unavailable") {
          setNotice("Automatic checks passed. AI review was unavailable — your broker will review it.");
        }
      }

      const res = await doFetch(`/api/transactions/${transactionId}/submit-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Couldn't submit for review.");
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
      // Refresh so the server re-reads broker_review_status → pill updates.
      router.refresh();
    } catch {
      setError("Network error submitting for review.");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
          <Check className="h-4 w-4" />
          Submitted
        </span>
        {notice && (
          <span data-testid="submit-review-notice" className="text-xs text-zinc-400">
            {notice}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-3 py-1.5 text-sm font-medium text-[#E8D5A3] hover:bg-[#C9A84C]/25 transition-colors disabled:pointer-events-none disabled:opacity-40"
      >
        <Send className="h-4 w-4" />
        {busy ? "Submitting…" : "Submit for Review"}
      </button>
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </span>
      )}
      {blocked && (
        <div
          data-testid="submit-review-blocked"
          className="max-w-sm rounded-md border border-red-500/40 bg-red-500/10 p-2 text-left"
        >
          <p className="text-xs font-semibold text-red-200">
            Not submitted — {blocked.length === 1 ? "one thing" : `${blocked.length} things`} to fix
            first
          </p>
          <ul className="mt-1 space-y-0.5">
            {blocked.map((f) => (
              <li key={f.code} className="text-xs text-red-200/90">
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
