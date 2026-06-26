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
