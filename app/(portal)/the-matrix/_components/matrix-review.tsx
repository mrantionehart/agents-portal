// ============================================================================
// Matrix Simulator — Broker review queue (Agent Portal)
// ============================================================================
// Broker of Record reviews submitted exercises and certifies (approve) or
// returns them (reject). The DECISION is enforced in Vault: this surface only
// lists the queue and posts the decision; Vault re-scores and checks the live
// evaluator grant + role-exact broker before recording anything.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ClipboardCheck } from "lucide-react";

import {
  getReviewQueue,
  certifySubmission,
  MatrixApiError,
  type ReviewQueueItem,
} from "@/lib/matrix/vault-matrix-client";
import { matrixSimulatorEnabled } from "../_lib/matrix-flags";

const CARD = "rounded-lg border border-[#13231a] bg-[#0b0f0c]";
const GREEN = "bg-[#22c55e] text-[#04120a]";

export function MatrixReview() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = useState<ReviewQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const { queue } = await getReviewQueue();
      setRows(queue);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof MatrixApiError && err.notEnabled ? "The Matrix simulator isn’t available yet." : "Could not load the review queue.");
      setPhase("error");
    }
  }, []);

  useEffect(() => { if (matrixSimulatorEnabled()) void load(); }, [load]);

  const decide = useCallback(async (submissionId: string, decision: "approve" | "reject") => {
    setBusyId(submissionId);
    try {
      await certifySubmission(submissionId, decision);
      setRows((rs) => rs.filter((r) => r.submissionId !== submissionId));
    } catch {
      setError("That action could not be completed.");
    } finally {
      setBusyId(null);
    }
  }, []);

  if (!matrixSimulatorEnabled()) {
    return <div className={`${CARD} p-6`}><p className="text-sm text-[#9db3a6]">Broker review is coming soon.</p></div>;
  }
  if (phase === "loading") {
    return <div className={`${CARD} flex items-center justify-center p-12`}><Loader2 className="h-5 w-5 animate-spin text-[#22c55e]" aria-hidden="true" /></div>;
  }
  if (phase === "error") {
    return <div className={`${CARD} p-6`}><p className="text-sm text-[#f87171]">{error}</p></div>;
  }

  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-[#22c55e]" aria-hidden="true" />
        <h2 className="text-base font-semibold text-[#E6F5EC]">Pending review</h2>
      </div>
      {error && <p className="mt-2 text-xs text-[#f87171]" role="alert">{error}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#9db3a6]">Nothing awaiting review.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.submissionId} className="flex items-center justify-between gap-3 rounded-md border border-[#13231a] bg-[#060a07] p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-[#E6F5EC]">{r.scenarioId}</p>
                <p className="text-xs text-[#9db3a6]">
                  Score {r.scorePct}% · {r.criticalErrorCount} critical · {r.passed ? "meets bar" : "below bar"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label={`Return ${r.submissionId}`}
                  disabled={busyId === r.submissionId}
                  onClick={() => void decide(r.submissionId, "reject")}
                  className="inline-flex h-8 items-center rounded-md border border-[#1f3a2b] px-3 text-xs font-medium text-[#9db3a6] disabled:opacity-50"
                >
                  Return
                </button>
                <button
                  type="button"
                  aria-label={`Certify ${r.submissionId}`}
                  disabled={busyId === r.submissionId || !r.passed}
                  title={r.passed ? "" : "Below the pass bar — cannot certify"}
                  onClick={() => void decide(r.submissionId, "approve")}
                  className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold disabled:opacity-40 ${GREEN}`}
                >
                  Certify
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
