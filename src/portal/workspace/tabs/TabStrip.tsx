// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Transaction Workspace tab strip
// ============================================================================
// Server-rendered tab navigation. Pure Link nav — no client JS, no
// mutations. Tabs follow the R3B / R5 pattern: ?tab= preserved across
// transactions, default tab omits the param.
// ============================================================================

import Link from "next/link";
import {
  Clock,
  FileText,
  Handshake,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Wallet,
} from "lucide-react";

import { WORKSPACE_TABS, tabHref, type TabId } from "./tab-config";

const ICON_MAP = {
  "layout-dashboard": LayoutDashboard,
  package: Package,
  "file-text": FileText,
  clock: Clock,
  "user-circle-2": UserCircle2,
  handshake: Handshake,
  "shield-check": ShieldCheck,
  wallet: Wallet,
  sparkles: Sparkles,
} as const;

export interface TabStripProps {
  transactionId: string;
  active: TabId;
}

export default function TabStrip({ transactionId, active }: TabStripProps) {
  return (
    <nav
      aria-label="Transaction workspace"
      className="
        inline-flex rounded-md border border-[#1a1a2e] bg-[#0b0b10]
        p-0.5 text-xs mb-5 flex-wrap
      "
    >
      {WORKSPACE_TABS.map((t) => {
        const Icon = ICON_MAP[t.icon];
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={tabHref(transactionId, t.id)}
            aria-current={isActive ? "page" : undefined}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded
              transition-colors duration-[180ms]
              ${isActive
                ? "bg-[#C9A84C]/15 text-[#E8D5A3] border border-[#C9A84C]/40"
                : "text-[#A1A1AA] hover:text-[#F1F1F3] border border-transparent"
              }
            `}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
