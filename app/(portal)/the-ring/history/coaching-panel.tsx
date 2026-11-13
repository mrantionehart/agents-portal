// ============================================================================
// RING-COACHING-HISTORY-1 — saved coaching for one past round
// ============================================================================
// Opened from History's "View Coaching". Reads the coaching Vault already
// stored for the round (getSavedCoaching: GET-only) and renders it with the
// same CoachingSection the live round uses. Never completes, retries or
// re-grades — reopening coaching cannot start a paid call.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  getSavedCoaching,
  type Coaching,
  type PracticeRow,
} from "@/lib/ring/vault-ring-client";
import { CoachingSection } from "../_components/ring-experience";

const LEVEL_LABEL: Record<number, string> = { 1: "Beginner", 2: "Intermediate", 3: "Advanced", 4: "Level 4" };

export function levelLabel(level: PracticeRow["level"]): string | null {
  return level == null ? null : LEVEL_LABEL[level] ?? `Level ${level}`;
}

/** Score only when Vault marked it reportable; otherwise say why there is none. */
export function scoreLine(row: Pick<PracticeRow, "score" | "reportable">): string {
  if (row.reportable && typeof row.score === "number") return `Score ${row.score}`;
  return "No score — not enough of the conversation to grade reliably";
}

type PanelState =
  | { kind: "loading" }
  | { kind: "ready"; coaching: Coaching }
  | { kind: "pending" }
  | { kind: "unavailable" };

function isCoaching(c: unknown): c is Coaching {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return ["strengths", "improvements", "missedOpportunities", "coaching"].every((k) => Array.isArray(o[k]));
}

export function CoachingPanel({
  certificationId,
  row,
  programLabel,
  formattedDate,
}: {
  certificationId: string;
  row: PracticeRow;
  programLabel: string;
  formattedDate: string;
}) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getSavedCoaching(certificationId, row.sessionId, row.channel);
        if (cancelled) return;
        if (res.status === "ready" && isCoaching(res.coaching)) setState({ kind: "ready", coaching: res.coaching });
        else if (res.status === "analyzing") setState({ kind: "pending" });
        else setState({ kind: "unavailable" });
      } catch {
        if (cancelled) return;
        // 404 (not yours / not found / dark), 403, network — all read the same.
        setState({ kind: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [certificationId, row.sessionId, row.channel]);

  const level = levelLabel(row.level);

  return (
    <div data-testid="coaching-panel" className="mt-3 rounded-md border border-[#1a1a2e] bg-[#0d0d14] p-4">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-[#A1A1AA] sm:grid-cols-2">
        <div><dt className="inline text-[#71717A]">Scenario: </dt><dd className="inline">{row.scenarioLabel}</dd></div>
        <div><dt className="inline text-[#71717A]">Program: </dt><dd className="inline">{programLabel}</dd></div>
        {level && <div><dt className="inline text-[#71717A]">Difficulty: </dt><dd className="inline">{level}</dd></div>}
        <div><dt className="inline text-[#71717A]">Channel: </dt><dd className="inline capitalize">{row.channel}</dd></div>
        <div><dt className="inline text-[#71717A]">Date: </dt><dd className="inline">{formattedDate}</dd></div>
        <div><dt className="inline text-[#71717A]">Result: </dt><dd className="inline">{scoreLine(row)}</dd></div>
      </dl>

      <div className="mt-4">
        {state.kind === "loading" && (
          <Loader2 className="h-4 w-4 animate-spin text-[#C9A84C]" aria-label="Loading coaching" />
        )}
        {state.kind === "pending" && (
          <p className="text-sm text-[#A1A1AA]">Coaching for this round is still being prepared. Check back shortly.</p>
        )}
        {state.kind === "unavailable" && (
          <p className="text-sm text-[#A1A1AA]">Coaching isn&rsquo;t available for this round.</p>
        )}
        {state.kind === "ready" && (
          <div className="space-y-5">
            <CoachingSection title="What you did well" items={state.coaching.strengths} />
            <CoachingSection title="Areas for improvement" items={state.coaching.improvements} />
            <CoachingSection title="Missed opportunities" items={state.coaching.missedOpportunities} />
            <CoachingSection title="Coaching recommendations" items={state.coaching.coaching} />
          </div>
        )}
      </div>
    </div>
  );
}
