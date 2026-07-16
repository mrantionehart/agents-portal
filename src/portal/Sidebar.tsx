// ============================================================================
// AGENT PORTAL 2.0 — Sidebar
// ============================================================================
// Vertical nav for the new (portal) shell. Desktop: fixed left rail.
// Mobile: hidden by default, shown via a drawer driven by the parent
// layout. No business logic — only renders the nav config + highlights
// the active item.
// ============================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Calendar,
  GraduationCap,
  Home,
  Library,
  ListChecks,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { cls } from "@/src/design/tokens";
import { isActiveRoute, visibleNavItems, type NavItem } from "./nav-config";

const ICONS = {
  "home": Home,
  "list-checks": ListChecks,
  "users": Users,
  "sparkles": Sparkles,
  "calendar": Calendar,
  "bell": Bell,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  "library": Library,
  "settings": Settings,
} as const;

export interface SidebarProps {
  role: string | null | undefined;
  /** Mobile drawer state — desktop ignores. */
  open?: boolean;
  /** Called when an item is clicked OR the close button is pressed. */
  onDismiss?: () => void;
}

export default function Sidebar({ role, open = false, onDismiss }: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const items = visibleNavItems(role);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={onDismiss}
        />
      )}

      <aside
        data-training-id="portal.navigation.sidebar"
        className={`
          fixed top-0 left-0 z-30 h-screen w-[240px]
          border-r border-[#1a1a2e] bg-[#0b0b10] text-[#A1A1AA]
          flex flex-col
          transform transition-transform duration-[180ms]
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
        aria-label="Primary navigation"
      >
        {/* Brand + mobile close */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#1a1a2e]">
          <Link
            href="/home"
            onClick={onDismiss}
            className="text-[#F1F1F3] font-semibold tracking-tight text-[15px] flex items-center gap-2"
          >
            <span
              aria-hidden
              className="inline-block w-6 h-6 rounded bg-[#C9A84C]/15 border border-[#C9A84C]/40"
            />
            HartFelt
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="md:hidden p-1 rounded text-[#A1A1AA] hover:text-[#F1F1F3] hover:bg-white/[0.04]"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {items.map((item) => (
            <SidebarLink
              key={item.id}
              item={item}
              active={isActiveRoute(pathname, item.href)}
              onClick={onDismiss}
            />
          ))}
        </nav>

        {/* Footer note */}
        <div className="px-4 py-3 border-t border-[#1a1a2e] text-[10px] uppercase tracking-wide text-[#71717A]">
          Portal 2.0 · Preview
        </div>
      </aside>
    </>
  );
}

// The four ids below are the pilot's tour-target anchors on nav rows.
// Adding more nav-item anchors requires extending the allowlist in
// src/portal/tour/anchors.ts.
const NAV_TRAINING_ANCHORS: Record<string, string> = {
  home: "portal.navigation.home",
  transactions: "portal.navigation.workspace",
  notifications: "portal.navigation.notifications",
  settings: "portal.navigation.settings",
};

function SidebarLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = ICONS[item.icon];
  const trainingId = NAV_TRAINING_ANCHORS[item.id];
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`${cls.navItem} ${active ? cls.navItemActive : ""}`}
      aria-current={active ? "page" : undefined}
      data-training-id={trainingId}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

