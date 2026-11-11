// ============================================================================
// AGENT PORTAL 2.0 — (portal) route group shell
// ============================================================================
// New layout for the modern Portal experience. Lives in parallel with
// the legacy app/ routes (closeiq, commissions, vendors, etc.) which
// are NOT touched.
//
// Auth: relies on the existing AuthProvider hook from the root layout.
// Unauthed users see the same /login redirect the legacy shell uses.
//
// IMPORTANT: this layout exports ONLY a default function (Next.js
// requirement). No business logic, no data fetching, no DB calls.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/src/portal/Sidebar";
import TopBar from "@/src/portal/TopBar";
import CommandBar from "@/src/portal/CommandBar";
import { TourProvider } from "@/src/portal/tour/TourProvider";
import { TourRunner } from "@/src/portal/tour/TourRunner";
import { BrokerPreviewBanner } from "@/src/portal/preview/BrokerPreviewBanner";
import {
  brokerPreviewEnabled,
  isBrokerTierRole,
  isPreviewActive,
  markPreviewActive,
} from "@/src/portal/preview/preview-state";
import { authFetch } from "@/lib/supabase";

import { useAuth } from "../providers";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);

  // Redirect unauthed users. Mirrors the legacy auth gate.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Broker Preview Mode. Activates ONLY when: the capability is enabled, the
  // SERVER-DERIVED role (useAuth, from the authenticated session) is broker-tier,
  // and either this tab arrived with ?preview=1 or is already an active preview
  // tab. A URL param alone never activates it — an agent with ?preview=1 has an
  // agent role and is unaffected. The audit ping fires once, BEFORE the per-tab
  // flag is set, so the read-only clamp never blocks the audit itself.
  useEffect(() => {
    if (loading || !user || !brokerPreviewEnabled()) return;
    if (!isBrokerTierRole(role)) return;
    let paramSet = false;
    try {
      paramSet = new URLSearchParams(window.location.search).get("preview") === "1";
    } catch {
      paramSet = false;
    }
    if (!isPreviewActive() && paramSet) {
      // First entry: record access (best-effort), then activate the clamp.
      authFetch("/api/broker/preview-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ surface: window.location.pathname }),
      }).catch(() => {});
      markPreviewActive();
    }
    if (paramSet || isPreviewActive()) setPreviewActive(true);
  }, [loading, user, role]);

  // ⌘K opens the command bar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandBarOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Loading state — same shell, blank canvas. Avoids layout shift.
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] text-[#F1F1F3] flex items-center justify-center text-sm text-[#71717A]">
        Loading…
      </div>
    );
  }

  return (
    <TourProvider>
      <div className="min-h-screen bg-[#050507] text-[#F1F1F3] overflow-x-hidden">
        <Sidebar
          role={role}
          open={mobileNavOpen}
          onDismiss={() => setMobileNavOpen(false)}
        />

        {/* Main column — offset by sidebar on md+. min-w-0 so flex
            children can shrink instead of forcing horizontal overflow. */}
        <div className="md:ml-[240px] min-h-screen flex flex-col min-w-0">
          {previewActive && <BrokerPreviewBanner />}
          <TopBar
            userName={(user as any)?.user_metadata?.full_name ?? null}
            userEmail={user?.email ?? null}
            role={role}
            onMenuClick={() => setMobileNavOpen(true)}
            onCommandBarOpen={() => setCommandBarOpen(true)}
          />

          <main className="flex-1 px-4 md:px-6 py-6 max-w-[1280px] w-full mx-auto min-w-0">
            {children}
          </main>
        </div>

        <CommandBar
          open={commandBarOpen}
          onClose={() => setCommandBarOpen(false)}
        />

        {/* Guided-training runtime — no-op unless a tour is started. */}
        <TourRunner />
      </div>
    </TourProvider>
  );
}
