// ============================================================================
// Broker Preview Agent View — persistent banner
// ============================================================================
// Shown on every agent-facing page while a Broker of Record previews the real
// Agent Portal. Makes it impossible to mistake the preview for a live agent
// session, states that it is read-only, and offers a one-click return to Vault.
// Renders ONLY when this tab is an active broker preview tab (capability enabled
// + server-derived broker-tier role + per-tab flag set) — never for an agent.
// ============================================================================

"use client";

import { Eye, ArrowLeft } from "lucide-react";

const VAULT_URL =
  process.env.NEXT_PUBLIC_VAULT_URL || "https://vault.hartfeltrealestate.com";

export function BrokerPreviewBanner() {
  return (
    <div
      data-testid="broker-preview-banner"
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-[#C9A84C]/50 bg-[#2a2410] px-4 py-2 text-sm"
    >
      <div className="flex min-w-0 items-center gap-2 text-[#E8D5A3]">
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-semibold uppercase tracking-wide">Broker Preview Mode</span>
        <span className="hidden truncate text-[#C9A84C]/80 sm:inline">
          · You are viewing the agent experience · read-only · no agent data
        </span>
      </div>
      <a
        href={VAULT_URL}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#C9A84C]/50 px-2.5 py-1 text-xs font-medium text-[#E8D5A3] transition hover:bg-[#C9A84C]/15"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Return to Vault
      </a>
    </div>
  );
}
