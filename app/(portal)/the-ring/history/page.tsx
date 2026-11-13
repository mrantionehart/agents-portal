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

import {
  ACQUISITION_CERTIFICATION_ID,
  LISTING_CERTIFICATION_ID,
  getPracticeHistory,
  RingApiError,
  type PracticeRow,
} from "@/lib/ring/vault-ring-client";
import { CoachingPanel } from "./coaching-panel";

// Every Ring program an agent can practise from the Portal. History used to
// ask Vault for Acquisition ONLY, so Listing rounds (FSBO / Divorce /
// Relocation) never appeared. Each program is read separately — Vault's
// history route is learner-gated per certification, so a program the agent is
// not assigned simply contributes nothing instead of failing the page.
const HISTORY_PROGRAMS = [
  { certificationId: ACQUISITION_CERTIFICATION_ID, label: "Acquisition" },
  { certificationId: LISTING_CERTIFICATION_ID, label: "Listing" },
] as const;

type HistoryRow = PracticeRow & { programLabel: string; certificationId: string };

const CARD = "rounded-lg border border-[#1a1a2e] bg-[#11111a]";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function RingHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  // One round's coaching open at a time; keyed by program too, since a
  // session id is only unique within what Vault returned for one program.
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        HISTORY_PROGRAMS.map((p) => getPracticeHistory(p.certificationId)),
      );
      if (cancelled) return;
      const merged: HistoryRow[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          for (const row of r.value.rows) merged.push({ ...row, programLabel: HISTORY_PROGRAMS[i].label, certificationId: HISTORY_PROGRAMS[i].certificationId });
        }
      });
      if (results.some((r) => r.status === "fulfilled")) {
        merged.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
        setRows(merged);
        setState("ready");
        return;
      }
      const allDark = results.every(
        (r) => r.status === "rejected" && r.reason instanceof RingApiError && r.reason.notEnabled,
      );
      setState(allDark ? "unavailable" : "error");
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
            <li key={`${r.certificationId}:${r.sessionId}`} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#F1F1F3]">{r.scenarioLabel}</p>
                  <p className="mt-0.5 text-xs text-[#71717A]">
                    {r.programLabel} · Practice · {r.channel} · {formatDate(r.startedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-xs text-[#A1A1AA] capitalize">{r.status.replace(/_/g, " ")}</span>
                  {/* Only a round with coaching on file offers it. Evaluating,
                      in-progress and no-result rounds have nothing to reopen. */}
                  {r.status === "ready" && (
                    <button
                      type="button"
                      aria-expanded={openKey === `${r.certificationId}:${r.sessionId}`}
                      onClick={() => {
                        const key = `${r.certificationId}:${r.sessionId}`;
                        setOpenKey((cur) => (cur === key ? null : key));
                      }}
                      className="min-h-[36px] rounded-md border border-[#C9A84C]/40 px-3 text-xs font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10"
                    >
                      {openKey === `${r.certificationId}:${r.sessionId}` ? "Hide Coaching" : "View Coaching"}
                    </button>
                  )}
                </div>
              </div>
              {openKey === `${r.certificationId}:${r.sessionId}` && (
                <CoachingPanel
                  certificationId={r.certificationId}
                  row={r}
                  programLabel={r.programLabel}
                  formattedDate={formatDate(r.startedAt)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
