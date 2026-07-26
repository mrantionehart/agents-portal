"use client";
// ============================================================================
// Agent actions on a meeting — cancel own / accept broker alternate / decline
// broker alternate. Calls the same-origin Portal proxy routes (which forward
// the bearer to Vault). There is NO confirm/decline/propose here — those are
// broker-only and are never exposed. On success we router.refresh() so the SSR
// page re-fetches the agent-safe state.
// ============================================================================
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/supabase";

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; error?: string }> {
  const token = await getAccessToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  let error: string | undefined;
  if (!res.ok) {
    try { const j = await res.json(); error = typeof j?.error === "string" ? j.error : undefined; } catch { /* ignore */ }
  }
  return { ok: res.ok, status: res.status, error };
}

export default function MeetingActions({
  id,
  status,
  alternateOptionId,
}: {
  id: string;
  status: string;
  alternateOptionId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const terminal = ["completed", "cancelled", "declined", "expired"].includes(status);
  if (terminal) return null;

  async function run(kind: string, fn: () => Promise<{ ok: boolean; status: number; error?: string }>) {
    setBusy(kind);
    setError(null);
    try {
      const r = await fn();
      if (r.ok) router.refresh();
      else setError(r.error ?? `Request failed (${r.status}).`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  const cancel = () => {
    if (!window.confirm("Cancel this meeting request? This cannot be undone.")) return;
    void run("cancel", () => post(`/api/meetings/${id}/cancel`, { note: "" }));
  };
  const accept = () =>
    void run("accept", () => post(`/api/meetings/${id}/respond`, { action: "accept_alternate", optionId: alternateOptionId }));
  const decline = () =>
    void run("decline", () => post(`/api/meetings/${id}/respond`, { action: "decline_alternate" }));

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {status === "alternate_proposed" && (
          <>
            <button
              type="button"
              onClick={accept}
              disabled={!!busy || !alternateOptionId}
              className="rounded-md bg-[#C9A84C] px-3 py-1.5 text-sm font-medium text-[#0b0b10] hover:bg-[#E8D5A3] disabled:opacity-50"
              title={alternateOptionId ? "Accept the broker's proposed time" : "No alternate time available"}
            >
              {busy === "accept" ? "Accepting…" : "Accept alternate"}
            </button>
            <button
              type="button"
              onClick={decline}
              disabled={!!busy}
              className="rounded-md border border-[#252538] px-3 py-1.5 text-sm text-[#A1A1AA] hover:text-[#F1F1F3] disabled:opacity-50"
            >
              {busy === "decline" ? "Declining…" : "Decline alternate"}
            </button>
          </>
        )}
        {(status === "requested" || status === "alternate_proposed" || status === "confirmed") && (
          <button
            type="button"
            onClick={cancel}
            disabled={!!busy}
            className="rounded-md border border-rose-700/40 bg-rose-900/20 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-900/30 disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling…" : status === "confirmed" ? "Cancel meeting" : "Cancel request"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
