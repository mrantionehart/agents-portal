// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — /settings placeholder
// ============================================================================
// Clean placeholder so the Settings sidebar entry doesn't dead-link.
// Real settings UI ships in a later phase.
// ============================================================================

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-[#C9A84C]" />
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">Settings</h1>
        </div>
        <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
          Personal preferences and account controls.
        </p>
      </header>

      <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-8 text-center">
        <p className="text-sm text-[#A1A1AA]">Settings UI is coming soon.</p>
        <p className="text-xs text-[#71717A] mt-1 max-w-md mx-auto leading-relaxed">
          For account changes today, contact your broker.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs">
          <Link href="/home" className="text-[#E8D5A3] hover:underline">
            Back to Home
          </Link>
        </div>
      </section>
    </div>
  );
}
