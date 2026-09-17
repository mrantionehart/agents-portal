// ============================================================================
// COMM-1C — The Ring · History (Agent Portal)
// ============================================================================
// The agent's own past Ring rounds, from Vault's practice/history endpoint
// (learner-scoped server-side; no learner param exists). V1 lists practice
// rounds — a unified practice+assessment attempt log is a documented later
// adapter (Vault would need a small read change), deliberately out of scope so
// COMM-1C stays a no-Vault-change Agent Portal PR.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";

import { getPracticeHistory, RingApiError, type PracticeRow } from "@/lib/ring/vault-ring-client";

const CARD = "rounded-lg border border-[#1a1a2e] bg-[#11111a]";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function RingHistoryPage() {
  const [rows, setRows] = useState<PracticeRow[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await getPracticeHistory("hartfelt-holdings-acquisition-certified");
        if (cancelled) return;
        setRows(h.rows);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof RingApiError && err.notEnabled) setState("unavailable");
        else setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/the-ring" className="mb-4 inline-flex items-center gap-1 text-sm text-[#71717A] hover:text-[#A1A1AA]">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> The Ring
      </Link>
      <h1 className="text-2xl font-semibold text-[#F1F1F3]">History</h1>
      <p className="mt-1 mb-6 text-sm text-[#A1A1AA]">Your past practice rounds.</p>

      {state === "loading" && <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C]" aria-hidden="true" />}

      {state === "error" && <p className="text-sm text-[#A1A1AA]">Your history isn&rsquo;t available right now.</p>}

      {state === "unavailable" && (
        <p className="text-sm text-[#71717A]">Practice isn&rsquo;t available yet — check back soon.</p>
      )}

      {state === "ready" && rows && rows.length === 0 && (
        <div className={`${CARD} p-8 text-center`}>
          <p className="text-sm text-[#A1A1AA]">No rounds yet.</p>
          <Link href="/the-ring/practice" className="mt-3 inline-flex h-9 items-center rounded-md bg-[#C9A84C] px-4 text-sm font-semibold text-[#0b0b10]">
            Start Practice
          </Link>
        </div>
      )}

      {state === "ready" && rows && rows.length > 0 && (
        <ul className={`${CARD} divide-y divide-[#1a1a2e]`}>
          {rows.map((r) => (
            <li key={r.sessionId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#F1F1F3]">{r.scenarioLabel}</p>
                <p className="mt-0.5 text-xs text-[#71717A]">
                  Practice · {r.channel} · {formatDate(r.startedAt)}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[#A1A1AA] capitalize">{r.status.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
