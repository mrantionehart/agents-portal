// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Transaction Workspace shell
// ============================================================================
// Composes: back nav + compliance banner + (left rail | tab strip + body).
// Server-rendered. Pure presentation — no fetches.
// ============================================================================

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { WorkspaceCard } from "../types";
import ComplianceBanner from "./ComplianceBanner";
import LeftRail, { type LeftRailDealPortal } from "./LeftRail";
import TabStrip from "./TabStrip";
import type { TabId } from "./tab-config";
import type { ComposedBannerState } from "../banner/compose-banner-state";
import CoachStrip from "../components/CoachStrip";
import CoordinatorPanel from "../components/CoordinatorPanel";
import AssistantPromptChips from "../components/AssistantPromptChips";

export interface WorkspaceShellProps {
  card: WorkspaceCard;
  vaultBase: string;
  activeTab: TabId;
  agentName?: string | null;
  dealPortal?: LeftRailDealPortal;
  /** Workflow 3.2.C.1 — composed banner state. Page derives via
   *  composeBannerState() from already-loaded signals. */
  bannerState: ComposedBannerState;
  children: React.ReactNode;
}

export default function WorkspaceShell({
  card,
  vaultBase,
  activeTab,
  agentName,
  dealPortal,
  bannerState,
  children,
}: WorkspaceShellProps) {
  return (
    <div>
      <Link
        href="/workspace"
        className="text-xs text-[#71717A] hover:text-[#A1A1AA] inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Workspace
      </Link>

      <ComplianceBanner state={bannerState} />

      {/* TXN-OS 3.4D — Transaction Coordinator strip = the hero. Loads
          independently (client-side, session Bearer → Vault 3.4C endpoint);
          the server workspace never waits on it and still renders if it's
          unavailable. Presentation only — renders the Vault-produced
          TransactionDirective; its CTA only navigates.
          The wrapper carries the Track 2 `portal.workspace.coordinator`
          semantic anchor. It renders inline (no visual box), so the
          panel below is styled and spaced identically to before. The
          anchor survives all three internal panel states (loading,
          unavailable, loaded) because the wrapper stays mounted. */}
      <div data-training-id="portal.workspace.coordinator">
        <CoordinatorPanel transactionId={card.transaction_id} />
      </div>

      {/* TXN-ASSISTANT 4.0D — one-tap suggested prompts. Beneath the Coordinator
          hero, above the Coach. Each chip deep-links to ?tab=ai&prompt=… ; the
          AI panel auto-sends it once. Navigation only — never calls the
          assistant itself, never moves the Coordinator or Coach. */}
      <AssistantPromptChips transactionId={card.transaction_id} />

      {/* W3.4.6.4 — AI Transaction Coach strip. 3.5 Phase 3A: demoted BELOW the
          Coordinator as contextual "how" guidance (Coordinator answers "what",
          Coach answers "how"). Sourced verbatim from `card.coach_recommendation`;
          renders nothing when the Coach has no actionable recommendation. */}
      <CoachStrip recommendation={card.coach_recommendation} />

      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4">
        {/* Left rail */}
        <div className="min-w-0">
          <LeftRail
            card={card}
            vaultBase={vaultBase}
            agentName={agentName}
            dealPortal={dealPortal}
          />
        </div>

        {/* Tab strip + body */}
        <div className="min-w-0">
          <TabStrip transactionId={card.transaction_id} active={activeTab} />
          {children}
        </div>
      </div>
    </div>
  );
}
