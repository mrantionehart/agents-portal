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
}

export default function SubmitForReviewButton({
  transactionId,
  fetchImpl,
}: SubmitForReviewButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    const doFetch = fetchImpl ?? fetch;
    try {
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
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
        <Check className="h-4 w-4" />
        Submitted
      </span>
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
    </div>
  );
}
