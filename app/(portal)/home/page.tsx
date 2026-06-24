// ============================================================================
// AGENT PORTAL 2.0 — Home landing (placeholder)
// ============================================================================
// AP2.1A ships a minimal placeholder so the new (portal) route group has
// a working landing. The actual Daily Briefing + buckets land in AP2.1E.
// ============================================================================

export const dynamic = "force-dynamic";

export default function PortalHomePage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#F1F1F3]">Home</h1>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Your daily briefing and today&apos;s transactions will live here.
        </p>
      </header>

      <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-6">
        <div className="text-[10px] uppercase tracking-wider text-[#71717A]">
          Preview · AP2.1A
        </div>
        <p className="mt-2 text-sm text-[#A1A1AA] max-w-prose leading-relaxed">
          The new Portal shell is live. Workspace, Transactions, Paperwork,
          Clients, AI, Calendar, Notifications, and Settings are reachable
          from the sidebar — each lands as its own sub-phase
          (AP2.1B&ndash;AP2.1H). Until then, this page acts as the landing
          for the new experience.
        </p>
        <p className="mt-3 text-xs text-[#71717A]">
          Broker confirmation is required for any change. This Portal does
          not send envelopes — Vault stays the source of truth for every
          sensitive action.
        </p>
      </div>
    </div>
  );
}
