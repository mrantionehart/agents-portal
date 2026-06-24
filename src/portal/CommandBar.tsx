// ============================================================================
// AGENT PORTAL 2.0 — Command Bar (placeholder)
// ============================================================================
// Linear/Arc-style ⌘K palette. AP2.1A renders the shell + a wired open
// state; AP2.1H attaches actual actions (navigation prompts, AI prompt
// seeding). NEVER triggers tool calls directly — actions only navigate
// or seed the AI panel.
// ============================================================================

"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";

export interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandBar({ open, onClose }: CommandBarProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command bar (preview)"
      className="fixed inset-0 z-40 flex items-start justify-center pt-[15vh] px-4"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="
          relative w-full max-w-xl
          rounded-lg border border-[#252538] bg-[#11111a]
          shadow-[0_12px_32px_rgba(0,0,0,0.5)]
        "
      >
        <div className="px-4 py-3 border-b border-[#252538] flex items-center gap-2 text-[#A1A1AA]">
          <Sparkles className="h-4 w-4 text-[#C9A84C]" />
          <input
            type="text"
            placeholder="Search transactions, clients, forms… (preview)"
            disabled
            className="
              flex-1 bg-transparent outline-none
              text-sm text-[#F1F1F3] placeholder:text-[#71717A]
              disabled:opacity-70
            "
            autoFocus
          />
          <kbd className="text-[10px] tracking-wide text-[#71717A] border border-[#252538] rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>
        <div className="px-4 py-6 text-sm text-[#71717A]">
          <p>The command bar is a preview in AP2.1A.</p>
          <p className="mt-1 text-xs">
            Navigation, transaction search, and AI prompt seeding will land in
            AP2.1H. It will never trigger writes directly — actions only
            navigate or open the AI panel pre-seeded.
          </p>
        </div>
      </div>
    </div>
  );
}
