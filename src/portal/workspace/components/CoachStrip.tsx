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
// ============================================================================

import Link from "next/link";
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
  if (!recommendation) return null;

  const Icon = iconForKind(recommendation.kind);

  // Palette is purely a function of the blocker flag — the Vault
  // payload's `blocker` boolean is the single source of truth. We
  // never re-derive urgency from amounts, status, or anything else.
  const palette = recommendation.blocker
    ? {
        wrap: "bg-[#3a1a1a] border-[#7a2a2a]",
        accent: "text-[#ef4444]",
        badge:
          "bg-[#7a2a2a]/40 text-[#fca5a5] border border-[#7a2a2a]",
      }
    : {
        wrap: "bg-[#3a2e1a] border-[#7a5a2a]",
        accent: "text-[#C9A84C]",
        badge:
          "bg-[#7a5a2a]/40 text-[#facc15] border border-[#7a5a2a]",
      };

  return (
    <div
      role="status"
      aria-label="AI Transaction Coach recommendation"
      className={`rounded-lg border ${palette.wrap} px-3 py-2.5 mb-3`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${palette.accent}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#F1F1F3]">
              {/* AGENT.SIGN.1E.2 — prefer the kind-level title; fall back to label. */}
              {recommendation.title ?? recommendation.label}
            </span>
            <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${palette.badge}`}>
              {recommendation.blocker ? "Blocker" : "Next step"}
            </span>
          </div>
          <div className="text-xs text-[#A1A1AA] mt-0.5 leading-relaxed">
            {recommendation.reason}
          </div>
          {/* AGENT.SIGN.1E.2 — recommended action + estimated time hint. */}
          {(recommendation.recommended_action || recommendation.estimated_time) && (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#C9A84C]">
              {recommendation.recommended_action && (
                <span className="font-medium">{recommendation.recommended_action}</span>
              )}
              {recommendation.estimated_time &&
                recommendation.estimated_time !== "—" && (
                  <span className="inline-flex items-center gap-1 text-[#71717A]">
                    <Clock className="h-3 w-3" /> {recommendation.estimated_time}
                  </span>
                )}
            </div>
          )}
        </div>
        <Link
          href={recommendation.drill_url}
          className="text-xs text-[#C9A84C] hover:text-[#dbb86a] inline-flex items-center gap-1 shrink-0 mt-0.5"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
