// ============================================================================
// AGENT PORTAL 2.0 — TopBar
// ============================================================================
// Search input + notification bell + user pill. Mobile shows a hamburger
// that toggles the sidebar drawer. No data fetching in AP2.1A — the
// notifications count and the search action are deliberately placeholders
// pending AP2.1F (notifications) and AP2.1H (command bar wiring).
// ============================================================================

"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Menu, Search } from "lucide-react";

import AIChatPanel from "./ai/AIChatPanel";
import { useAskEnabled } from "./ai/use-ask-enabled";

import { cls } from "@/src/design/tokens";

export interface TopBarProps {
  userName: string | null;
  userEmail: string | null;
  role: string | null;
  /** Toggles the mobile sidebar drawer. */
  onMenuClick?: () => void;
  /** Opens the command bar — wired in AP2.1H. */
  onCommandBarOpen?: () => void;
}

export default function TopBar({
  userName,
  userEmail,
  role,
  onMenuClick,
  onCommandBarOpen,
}: TopBarProps) {
  const askEnabled = useAskEnabled();
  const askButtonRef = useRef<HTMLButtonElement>(null);
  function closeAsk() {
    setAskOpen(false);
    askButtonRef.current?.focus();
  }
  const [askOpen, setAskOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="
        sticky top-0 z-10 h-14
        border-b border-[#1a1a2e] bg-[#050507]/85 backdrop-blur
        flex items-center gap-3 px-4
      "
      role="banner"
    >
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 rounded text-[#A1A1AA] hover:text-[#F1F1F3] hover:bg-white/[0.04]"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Command-bar-style search trigger (placeholder; AP2.1H) */}
      <button
        type="button"
        onClick={onCommandBarOpen}
        className="
          flex-1 max-w-md
          flex items-center gap-2
          rounded-md border border-[#1a1a2e] bg-[#0b0b10]/60
          px-3 py-1.5 text-left
          text-sm text-[#71717A]
          hover:border-[#252538] hover:text-[#A1A1AA]
          transition-colors duration-[180ms]
        "
        aria-label="Open command bar"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">Search transactions, clients, forms…</span>
        <kbd className="hidden sm:inline-flex text-[10px] tracking-wide text-[#71717A] border border-[#1a1a2e] rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" aria-hidden />

      {askEnabled && <>
        <button ref={askButtonRef} type="button" onClick={() => setAskOpen(true)} className={cls.buttonGhost}>Ask</button>
        {askOpen && createPortal(<div onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); closeAsk(); }
          if (event.key === 'Tab') {
            const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled)');
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }} role="dialog" aria-modal="true" aria-label="Ask HartFelt AI" className="fixed inset-0 z-50 bg-[#050507] p-4 overflow-y-auto">
          <button type="button" autoFocus onClick={closeAsk} className={cls.buttonGhost}>Close Ask</button>
          <AIChatPanel transactionId={null} initialMode="ask" />
        </div>, document.body)}
      </>}
      {/* Notification bell — placeholder count */}
      <button
        type="button"
        className={cls.buttonGhost + " relative"}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
      </button>

      {/* User pill + menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="
            inline-flex items-center gap-2
            rounded-md border border-[#1a1a2e] bg-[#0b0b10]
            px-2 py-1.5
            text-sm text-[#A1A1AA]
            hover:text-[#F1F1F3] hover:border-[#252538]
            transition-colors duration-[180ms]
          "
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar name={userName ?? userEmail ?? "?"} />
          <span className="hidden sm:inline max-w-[140px] truncate">
            {userName ?? userEmail ?? "Account"}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="
              absolute right-0 mt-1 w-56 z-30
              rounded-md border border-[#252538] bg-[#11111a] shadow-lg
              py-1
            "
            onClick={() => setMenuOpen(false)}
          >
            <div className="px-3 py-2 text-xs text-[#71717A]">
              <div className="text-[#F1F1F3] text-sm truncate">{userName ?? "—"}</div>
              <div className="truncate">{userEmail ?? "—"}</div>
              {role && (
                <div className="mt-1 inline-block text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 border border-[#252538] text-[#A1A1AA]">
                  {role}
                </div>
              )}
            </div>
            <div className="border-t border-[#252538] my-1" />
            <a
              href="/settings"
              role="menuitem"
              className="block px-3 py-1.5 text-sm text-[#A1A1AA] hover:text-[#F1F1F3] hover:bg-white/[0.04]"
            >
              Settings
            </a>
            <a
              href="/logout"
              role="menuitem"
              className="block px-3 py-1.5 text-sm text-[#A1A1AA] hover:text-[#F1F1F3] hover:bg-white/[0.04]"
            >
              Sign out
            </a>
          </div>
        )}
      </div>
    </header>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <span
      aria-hidden
      className="
        inline-flex items-center justify-center w-6 h-6 rounded-full
        bg-[#C9A84C]/15 border border-[#C9A84C]/40
        text-[10px] font-medium text-[#E8D5A3]
      "
    >
      {initials}
    </span>
  );
}
