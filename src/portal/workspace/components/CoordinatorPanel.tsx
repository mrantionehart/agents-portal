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
import { ArrowRight, Compass, Loader2 } from "lucide-react";

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

/** Default session-token getter — lazily imports the browser Supabase client so
 *  tests (which inject `getToken`) never load it. */
async function defaultGetToken(): Promise<string | null> {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface CoordinatorPanelProps {
  transactionId: string;
  /** Injected in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected in tests. Defaults to the Supabase session access token. */
  getToken?: () => Promise<string | null>;
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
}: CoordinatorPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const doFetch = fetchImpl ?? fetch;
    const readToken = getToken ?? defaultGetToken;

    (async () => {
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
        if (!res.ok) {
          if (!cancelled) setState({ status: "unavailable" });
          return;
        }
        const body = (await res.json()) as CoordinatorResponse;
        if (!body?.directive?.next_action) {
          if (!cancelled) setState({ status: "unavailable" });
          return;
        }
        if (!cancelled) setState({ status: "loaded", vm: coordinatorPanelVM(body, transactionId) });
      } catch {
        // Isolated failure — the workspace has already rendered; degrade quietly.
        if (!cancelled) setState({ status: "unavailable" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactionId, fetchImpl, getToken]);

  // ── loading ────────────────────────────────────────────────────────────────
  if (state.status === "loading") {
    return (
      <div
        role="status"
        aria-label="Transaction Coordinator loading"
        className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-3 py-2.5 mb-3 flex items-center gap-2 text-xs text-[#71717A]"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading coordinator…
      </div>
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
          <div className="text-sm font-medium text-[#F1F1F3] mt-0.5">{vm.primary_directive}</div>

          {/* meta chips: priority · readiness · confidence */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <Chip tone={vm.priority_tone}>{vm.priority}</Chip>
            <span className="text-[11px] text-[#A1A1AA]">Readiness: {vm.readiness_label}</span>
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

          {/* blockers + risks (only when present) */}
          {vm.has_blockers_section && (
            <div className="mt-2 space-y-1.5">
              {vm.blockers.map((b, i) => (
                <div key={`b-${i}`} className="flex items-start gap-2">
                  <Chip tone={b.tone}>Blocker</Chip>
                  <div className="min-w-0 text-[11px] leading-relaxed">
                    <span className="text-[#E4E4E7]">
                      {b.reason}
                      {b.count != null ? ` (${b.count})` : ""}
                    </span>
                    <span className="text-[#71717A]"> — {b.resolution}</span>
                  </div>
                </div>
              ))}
              {vm.risks.map((r, i) => (
                <div key={`r-${i}`} className="flex items-start gap-2">
                  <Chip tone={r.tone}>Risk</Chip>
                  <div className="min-w-0 text-[11px] leading-relaxed text-[#A1A1AA]">{r.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA — NAVIGATION ONLY. Never performs the action. */}
        <button
          type="button"
          onClick={() => {
            router.push(vm.cta.href);
            router.refresh();
          }}
          className={`text-xs inline-flex items-center gap-1 shrink-0 mt-0.5 cursor-pointer ${
            vm.cta.is_blocked
              ? "text-[#A1A1AA] hover:text-[#d4d4d8]"
              : "text-[#C9A84C] hover:text-[#dbb86a]"
          }`}
        >
          {vm.cta.label} <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </section>
  );
}
