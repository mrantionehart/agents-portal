// ============================================================================
// WORKFLOW 3.4.6.4 — CoachStrip
// ============================================================================
// Renders the Vault-produced coach_recommendation (W3.4.6.3 workspace
// endpoint) as a single inline strip above the workspace tabs.
//
// PRESENTATION ONLY. This component never computes anything — every
// field comes verbatim from the Vault payload:
//
//   • kind             → drives the icon picker (label is the canonical copy)
//   • label            → headline
//   • blocker          → red vs amber styling
//   • reason           → secondary line (one short sentence, sanitized
//                         upstream by composeTransactionCoachState)
//   • suggested_prompt → unused here (rendered by AIAssistantPanel)
//   • drill_url        → "Open" link target
//
// AGENT.SIGN.1E.2 also reads the richer card fields (title / severity /
// recommended_action / estimated_time) — all kind-derived static strings from
// the deliberately-widened Vault projection. Still presentation-only; no field
// is computed here.
//
// Render rules:
//   • recommendation === null/undefined  → render nothing
//   • blocker === true                   → red palette
//   • blocker === false                  → amber palette
//
// Navigation: the "Open" control uses client-side router.push + refresh so
// the target tab reliably re-renders even when only the ?tab= query changes
// (a bare <Link> soft-nav to the same pathname can leave the view stale).
// drill_url is always an in-portal /workspace/[id]?tab=… route — never Vault.
// ============================================================================

"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSignature,
  Hourglass,
  Package,
  PenLine,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import type { CoachRecommendation } from "../types";

const KIND_ICON: Record<string, typeof Sparkles> = {
  complete_collection: ClipboardList,
  request_statutory_attestation: ShieldAlert,
  ready_for_packaging: Package, // AGENT.SIGN.1E.2
  awaiting_signatures: PenLine, // AGENT.SIGN.1E.2
  submit_for_broker_review: Send,
  send_for_signatures: FileSignature,
  await_broker_approval: Hourglass,
  commission_blocked: AlertCircle,
  ready_for_payout: CheckCircle2,
  nothing_urgent: Sparkles,
};

function iconForKind(kind: string): typeof Sparkles {
  return KIND_ICON[kind] ?? Sparkles;
}

export interface CoachStripProps {
  recommendation: CoachRecommendation | null | undefined;
}

export default function CoachStrip({ recommendation }: CoachStripProps) {
  const router = useRouter();

  // Always mount a wrapper that carries the `portal.workspace.coach.strip`
  // training anchor — even when no coaching recommendation is currently
  // available — so anchor identity is stable across recommendation states
  // and the tour engine can always resolve this anchor. When there is
  // nothing to render, the placeholder wrapper is visually empty (no
  // border, no padding, no children), so the user-visible layout is
  // identical to the previous return-null.
  if (!recommendation) {
    return <div data-training-id="portal.workspace.coach.strip" />;
  }

  const Icon = iconForKind(recommendation.kind);

  // 3.5 Phase 3A — Coach is DEMOTED to contextual "how" guidance beneath the
  // Coordinator hero. A single muted/neutral palette (no red/amber alert box, no
  // Blocker badge, no gold "Open") so it never visually competes with the
  // Coordinator. Content is UNCHANGED (title/reason/action from the Vault
  // payload); this is presentation only.
  return (
    <div
      role="status"
      aria-label="AI Transaction Coach guidance"
      data-training-id="portal.workspace.coach.strip"
      className="rounded-lg border border-[#171720] bg-[#0d0d13] px-3 py-2 mb-3"
    >
      <div className="flex items-start gap-2.5">
        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#71717A]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-[#71717A]">Coach</span>
            {/* AGENT.SIGN.1E.2 — prefer the kind-level title; fall back to label. */}
            <span className="text-xs text-[#A1A1AA]">{recommendation.title ?? recommendation.label}</span>
          </div>
          <div className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed">
            {recommendation.reason}
          </div>
          {/* AGENT.SIGN.1E.2 — recommended action + estimated time hint. */}
          {(recommendation.recommended_action || recommendation.estimated_time) && (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#71717A]">
              {recommendation.recommended_action && (
                <span>{recommendation.recommended_action}</span>
              )}
              {recommendation.estimated_time &&
                recommendation.estimated_time !== "—" && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {recommendation.estimated_time}
                  </span>
                )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            // In-portal navigation. push moves to the target tab; refresh
            // forces the server component to re-render with the new ?tab=.
            router.push(recommendation.drill_url);
            router.refresh();
          }}
          className="text-[11px] text-[#71717A] hover:text-[#A1A1AA] inline-flex items-center gap-1 shrink-0 mt-0.5 cursor-pointer"
        >
          Open <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
