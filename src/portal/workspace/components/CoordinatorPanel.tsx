// ============================================================================
// TRANSACTION OS 3.4D — CoordinatorPanel
// ============================================================================
// A single inline strip that renders the Vault-produced TransactionDirective
// (3.4C: GET /api/platform/transactions/[id]/coordinator) above the workspace
// tabs, beside CoachStrip. PRESENTATION ONLY — every field is consumed verbatim
// from the directive via the pure coordinator-view helpers; this component
// computes nothing.
//
// It loads INDEPENDENTLY (client-side, session Bearer → direct-to-Vault fetch,
// reusing the AIAssistantPanel idiom) so the server-rendered workspace never
// waits on it and never fails because of it:
//   • loading      → subtle "Loading coordinator…"
//   • unavailable  → subtle "Coordinator temporarily unavailable." (fetch
//                    threw / non-200 / malformed body). Workspace unaffected.
//   • degraded     → loaded, plus a subtle count-only notice (never a raw
//                    collection error message).
//
// The CTA ONLY NAVIGATES (router.push + refresh to the recommended tab, the
// CoachStrip idiom). It never performs the action itself.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass } from "lucide-react";

import type { LifecycleTone } from "../types";
import {
  COORDINATOR_LABEL,
  coordinatorPanelVM,
  type CoordinatorPanelVM,
  type CoordinatorResponse,
} from "../coordinator-view";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

const TONE_CLASS: Record<LifecycleTone, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  muted: "bg-white/[0.04] text-[#A1A1AA] border-white/[0.08]",
};

/** Hard ceiling on the whole load (token retrieval + fetch). If either exceeds
 *  this, the strip degrades to "unavailable" instead of spinning forever. The
 *  token helper is itself bounded (~2s) and the endpoint answers in ~4s, so this
 *  is generous headroom, not the expected path — it's a hang backstop. */
const COORDINATOR_LOAD_TIMEOUT_MS = 10_000;

/** Default session-token getter — reuses the app's approved lock-free
 *  access-token helper (getAccessToken from lib/supabase). It deliberately
 *  avoids the lock-based session read that hangs indefinitely on the navigator
 *  LockManager (documented in lib/supabase.ts). Lazily imported so tests (which
 *  inject `getToken`) never load the Supabase client. */
async function defaultGetToken(): Promise<string | null> {
  const { getAccessToken } = await import("@/lib/supabase");
  return (await getAccessToken()) ?? null;
}

export interface CoordinatorPanelProps {
  transactionId: string;
  /** Injected in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected in tests. Defaults to the app's lock-free access-token helper. */
  getToken?: () => Promise<string | null>;
  /** Injected in tests. Overall load timeout (token + fetch), in ms. */
  timeoutMs?: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "loaded"; vm: CoordinatorPanelVM };

function Chip({ tone, children }: { tone: LifecycleTone; children: React.ReactNode }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export default function CoordinatorPanel({
  transactionId,
  fetchImpl,
  getToken,
  timeoutMs = COORDINATOR_LOAD_TIMEOUT_MS,
}: CoordinatorPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // 3.5 Phase 2 — blocker list collapse (presentation only). Default collapsed:
  // show the single highest-priority blocker after presentation ordering.
  const [blockersExpanded, setBlockersExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const doFetch = fetchImpl ?? fetch;
    const readToken = getToken ?? defaultGetToken;

    // The load: read a token (lock-free helper), fetch, project. Returns the
    // next LoadState; never throws (its own failures resolve to "unavailable").
    const load = (async (): Promise<LoadState> => {
      try {
        const token = await readToken();
        const res = await doFetch(
          `${VAULT_API_URL}/platform/transactions/${transactionId}/coordinator`,
          {
            method: "GET",
            credentials: "omit",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        if (!res.ok) return { status: "unavailable" };
        const body = (await res.json()) as CoordinatorResponse;
        if (!body?.directive?.next_action) return { status: "unavailable" };
        return { status: "loaded", vm: coordinatorPanelVM(body, transactionId) };
      } catch {
        // Isolated failure — the workspace has already rendered; degrade quietly.
        return { status: "unavailable" };
      }
    })();

    // Hang backstop — the spinner must ALWAYS terminate. If token retrieval or
    // the fetch hangs (e.g. a token-helper/LockManager stall), the timeout wins
    // the race and the strip shows "unavailable" instead of loading forever.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<LoadState>((resolve) => {
      timer = setTimeout(() => resolve({ status: "unavailable" }), timeoutMs);
    });

    Promise.race([load, timeout])
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [transactionId, fetchImpl, getToken, timeoutMs]);

  // ── loading (height-preserving skeleton — no layout shift) ──────────────────
  // Mirrors the loaded panel's structure (header line, primary directive line,
  // meta row, one blocker row) so the hero reserves its space and the primary
  // answer doesn't jump the page when it resolves (~2s client load).
  if (state.status === "loading") {
    return (
      <section
        role="status"
        aria-label="Transaction Coordinator loading"
        aria-busy="true"
        data-testid="coordinator-skeleton"
        className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-4 py-3 mb-3"
      >
        <div className="flex items-start gap-3 animate-pulse">
          <div className="h-4 w-4 mt-0.5 shrink-0 rounded-full bg-white/[0.06]" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-2.5 w-40 rounded bg-white/[0.06]" />
            <div className="h-4 w-3/5 rounded bg-white/[0.08]" />
            <div className="flex gap-2">
              <div className="h-4 w-14 rounded bg-white/[0.06]" />
              <div className="h-4 w-28 rounded bg-white/[0.06]" />
              <div className="h-4 w-24 rounded bg-white/[0.06]" />
            </div>
            <div className="h-3 w-4/5 rounded bg-white/[0.04]" />
          </div>
          <div className="h-8 w-40 shrink-0 rounded-md bg-white/[0.06]" />
        </div>
      </section>
    );
  }

  // ── unavailable ──────────────────────────────────────────────────────────────
  if (state.status === "unavailable") {
    return (
      <div
        role="status"
        aria-label="Transaction Coordinator unavailable"
        className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-3 py-2.5 mb-3 flex items-center gap-2 text-xs text-[#71717A]"
      >
        <Compass className="h-3.5 w-3.5 shrink-0" /> Coordinator temporarily unavailable.
      </div>
    );
  }

  // ── loaded ───────────────────────────────────────────────────────────────────
  const vm = state.vm;
  return (
    <section
      aria-label="Transaction Coordinator"
      className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-4 py-3 mb-3"
    >
      <div className="flex items-start gap-3">
        <Compass className="h-4 w-4 mt-0.5 shrink-0 text-[#C9A84C]" />
        <div className="min-w-0 flex-1">
          {/* header: label + workflow state */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-[#71717A]">
              {COORDINATOR_LABEL}
            </span>
            <Chip tone="muted">{vm.workflow_state_label}</Chip>
          </div>

          {/* primary directive */}
          <div
            data-training-id="portal.workspace.coordinator.directive"
            className="text-sm font-medium text-[#F1F1F3] mt-0.5"
          >
            {vm.primary_directive}
          </div>

          {/* meta chips: priority · confidence. Readiness moved to the LeftRail
              (3.5 Phase 3A) — shown once, not repeated here. */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <Chip tone={vm.priority_tone}>{vm.priority}</Chip>
            <Chip tone={vm.confidence_tone}>Confidence {vm.confidence_label}</Chip>
            {vm.can_prepare_package && (
              <span className="text-[10px] text-[#71717A]">· can prepare package</span>
            )}
            {vm.can_send_for_signature && (
              <span className="text-[10px] text-[#71717A]">· can send</span>
            )}
          </div>

          {/* degraded (subtle, count-only) */}
          {vm.degraded && vm.degraded_notice && (
            <div className="mt-1 text-[11px] text-[#71717A]">{vm.degraded_notice}</div>
          )}

          {/* blockers + risks (only when present) — collapsed shows the single
              highest-priority blocker; the rest reveal on expand (3.5 Phase 2).
              Severity carries the color; owner stays neutral. */}
          {vm.has_blockers_section && (
            <div
              data-training-id="portal.workspace.coordinator.blockers"
              className="mt-2 space-y-1.5"
            >
              {(blockersExpanded ? vm.blockers : vm.blockers.slice(0, 1)).map((b, i) => (
                <div key={`b-${i}`} className="flex items-start gap-2">
                  <Chip tone={b.severity_tone}>{b.severity_label}</Chip>
                  <Chip tone="muted">{b.owner_label}</Chip>
                  <div className="min-w-0 text-[11px] leading-relaxed">
                    <span className="text-[#E4E4E7]">
                      {b.reason}
                      {b.count != null ? ` (${b.count})` : ""}
                    </span>
                    <span className="text-[#71717A]"> — {b.resolution}</span>
                  </div>
                </div>
              ))}

              {/* collapse/expand toggle */}
              {vm.blockers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setBlockersExpanded((v) => !v)}
                  className="text-[11px] text-[#71717A] hover:text-[#A1A1AA] cursor-pointer"
                >
                  {blockersExpanded
                    ? "Show less"
                    : `+ ${vm.total_blockers - 1} more blocker${vm.total_blockers - 1 === 1 ? "" : "s"}`}
                </button>
              )}

              {/* when expanded but capped at MAX_BLOCKERS, note the remainder */}
              {blockersExpanded && vm.total_blockers > vm.blockers.length && (
                <div className="text-[11px] text-[#71717A]">
                  + {vm.total_blockers - vm.blockers.length} more blocker
                  {vm.total_blockers - vm.blockers.length === 1 ? "" : "s"}
                </div>
              )}

              {vm.risks.map((r, i) => (
                <div key={`r-${i}`} className="flex items-start gap-2">
                  <Chip tone={r.tone}>Risk</Chip>
                  <div className="min-w-0 text-[11px] leading-relaxed text-[#A1A1AA]">{r.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA — the primary gold button. NAVIGATION ONLY (never performs the
            action; it routes to the recommended tab). */}
        <button
          type="button"
          data-training-id="portal.workspace.coordinator.cta"
          onClick={() => {
            router.push(vm.cta.href);
            router.refresh();
          }}
          className="shrink-0 mt-0.5 inline-flex items-center gap-1.5 rounded-md bg-[#C9A84C] px-3 py-1.5 text-xs font-semibold text-[#0b0b10] hover:bg-[#dbb86a] cursor-pointer"
        >
          {vm.cta.label} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}
