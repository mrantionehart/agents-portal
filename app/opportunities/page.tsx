// ============================================================================
// AGENT PORTAL 2.1 — R8 — Retired stub for /opportunities
// ============================================================================
// The legacy /opportunities page had no real backend — it hardcoded an
// empty list behind a broker-only role check. R6's Home Intelligence
// dashboard now surfaces opportunities directly in the Opportunities
// widget at /home, with a graceful empty state until a real curated
// feed lands. This route remains reachable so the Home widget's
// "View all →" deep-link doesn't break; it explains where the live
// surface lives.
//
// Read-only stub. No forms, no DB calls, no API calls, no writes.
// ============================================================================

import Link from "next/link";
import { Sparkles, Home, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Opportunities — HartFelt",
};

export default function OpportunitiesRetiredPage() {
  return (
    <main className="min-h-screen bg-[#0b0b10] text-[#F1F1F3] flex items-center justify-center px-6 py-12">
      <section className="max-w-md w-full rounded-lg border border-[#1a1a2e] bg-[#11111a] p-8">
        <div
          aria-hidden
          className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-[#252538] bg-[#0b0b10] mb-4"
        >
          <Sparkles className="h-5 w-5 text-[#C9A84C]" />
        </div>

        <h1 className="text-xl font-semibold mb-2">Opportunities</h1>
        <p className="text-sm text-[#A1A1AA] leading-relaxed">
          The Opportunities surface has moved into the Home dashboard. When a
          curated investor or off-market deal is published, it appears in the
          Opportunities widget at the top of <span className="text-[#E8D5A3]">Home</span>.
        </p>

        <p className="text-xs text-[#71717A] mt-3 leading-relaxed">
          Until then, the widget shows a graceful empty state alongside Market
          News, Development Radar, Hot Leads, Production, and Pipeline
          snapshots — all in one place.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
          <Link
            href="/home"
            className="
              inline-flex items-center gap-1 rounded-md
              border border-[#C9A84C]/40 bg-[#C9A84C]/10
              px-3 py-1.5 text-[#E8D5A3]
              hover:bg-[#C9A84C]/15
              transition-colors duration-[180ms]
            "
          >
            <Home className="h-3.5 w-3.5" /> Open Home
          </Link>
          <Link
            href="/workspace"
            className="
              inline-flex items-center gap-1 rounded-md
              border border-[#1a1a2e] bg-[#11111a]
              px-3 py-1.5 text-[#A1A1AA]
              hover:text-[#F1F1F3] hover:border-[#252538]
              transition-colors duration-[180ms]
            "
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Transactions
          </Link>
        </div>
      </section>
    </main>
  );
}
