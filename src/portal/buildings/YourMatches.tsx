"use client";

// ============================================================================
// EASE-2.0-PLAN-STR-DESTINATION-1 — "Your Matches" section
// ============================================================================
// Sits above the directory on /buildings. Shows the agent's own active matches
// in Vault's order, and highlights one when arrived at via `?match=<id>` — the
// destination the Daily Game Plan links to.
//
// The section hides itself entirely when the agent has no matches. The
// directory below is the page's real subject; an empty "Your Matches" heading
// over nothing would just be noise on a screen that already works.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  fetchMyMatches,
  markMatchReviewed,
  type MatchRow,
} from "./matches-model";

type Status = "loading" | "error" | "empty" | "ready";

export default function YourMatches({
  highlightMatchId = null,
}: {
  /** From `?match=` — used ONLY to pick a row to highlight, never to fetch. */
  highlightMatchId?: string | null;
}) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    try {
      const res = await fetchMyMatches({ signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setMatches(res.matches);
      setStatus(res.matches.length === 0 ? "empty" : "ready");
    } catch {
      if (ctrl.signal.aborted) return;
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  /**
   * Explicit review. The ONLY path that writes, and only from a click —
   * never from render, never from arriving with `?match=`.
   */
  const onReviewed = useCallback(async (id: string) => {
    setReviewing(id);
    const ok = await markMatchReviewed(id);
    if (ok) {
      setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
    }
    setReviewing(null);
  }, []);

  // Nothing to show and nothing wrong — stay out of the way.
  if (status === "empty") return null;

  return (
    <section data-testid="your-matches" aria-labelledby="your-matches-heading" className="mb-8">
      <div className="mb-3 flex items-center gap-2 text-[#71717A] text-xs font-medium uppercase tracking-wide">
        <Sparkles className="h-4 w-4" aria-hidden />
        <h2 id="your-matches-heading">Your Matches</h2>
      </div>

      {status === "loading" && (
        <div
          data-testid="your-matches-loading"
          aria-busy="true"
          aria-live="polite"
          className="h-20 rounded-lg border border-[#1a1a2e] bg-[#11111a]"
        />
      )}

      {status === "error" && (
        <div
          data-testid="your-matches-error"
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-[#3a1d1d] bg-[#1a1010] p-4"
        >
          <p className="text-sm text-[#f87171]">Your matches couldn&apos;t be loaded.</p>
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-[#3a1d1d] px-3 py-1 text-xs text-[#f87171] hover:bg-[#241414]"
          >
            {/* Deliberately not "Retry": the directory below has its own retry,
                and two identically-named buttons on one page are ambiguous to
                anyone navigating by accessible name. */}
            Reload matches
          </button>
        </div>
      )}

      {status === "ready" && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {matches.map((m) => {
            const highlighted = highlightMatchId !== null && m.id === highlightMatchId;
            return (
              <li
                key={m.id}
                data-testid={`your-match-${m.id}`}
                data-highlighted={highlighted ? "true" : undefined}
                aria-current={highlighted ? "true" : undefined}
                className={[
                  "rounded-lg border bg-[#11111a] p-4",
                  highlighted
                    ? "border-[#C9A84C] ring-1 ring-[#C9A84C]/40"
                    : "border-[#1a1a2e]",
                ].join(" ")}
              >
                <p className="text-sm font-medium text-[#F1F1F3]">{m.buildingLabel}</p>
                {m.locality && (
                  <p className="mt-0.5 text-xs text-[#71717A]">{m.locality}</p>
                )}

                {m.reasons.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {m.reasons.map((r) => (
                      <li key={r} className="text-xs text-[#A1A1AA]">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#52525B]">
                    {m.listingsCount !== null ? `${m.listingsCount} listings` : " "}
                  </span>
                  {m.isRead ? (
                    <span data-testid={`reviewed-${m.id}`} className="text-[11px] text-[#52525B]">
                      Reviewed
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid={`review-${m.id}`}
                      disabled={reviewing === m.id}
                      onClick={() => onReviewed(m.id)}
                      className="rounded-md border border-[#1a1a2e] px-2.5 py-1 text-[11px] text-[#A1A1AA] hover:border-[#C9A84C]/50 hover:text-[#E8D5A3] disabled:opacity-50"
                    >
                      {reviewing === m.id ? "Marking…" : "Mark reviewed"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
