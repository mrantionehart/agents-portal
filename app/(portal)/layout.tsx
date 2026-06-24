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

import { useAuth } from "../providers";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  // Redirect unauthed users. Mirrors the legacy auth gate.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

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
    <div className="min-h-screen bg-[#050507] text-[#F1F1F3]">
      <Sidebar
        role={role}
        open={mobileNavOpen}
        onDismiss={() => setMobileNavOpen(false)}
      />

      {/* Main column — offset by sidebar on md+. */}
      <div className="md:ml-[240px] min-h-screen flex flex-col">
        <TopBar
          userName={(user as any)?.user_metadata?.full_name ?? null}
          userEmail={user?.email ?? null}
          role={role}
          onMenuClick={() => setMobileNavOpen(true)}
          onCommandBarOpen={() => setCommandBarOpen(true)}
        />

        <main className="flex-1 px-4 md:px-6 py-6 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>

      <CommandBar
        open={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
      />
    </div>
  );
}
