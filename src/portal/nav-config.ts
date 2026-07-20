// ============================================================================
// AGENT PORTAL 2.0 — Sidebar navigation config
// ============================================================================
// Single declarative list of nav items. The Sidebar reads this — the
// only place a route changes when we ship a new (portal) page.
//
// ── AP2 NAVIGATION SPEC OF RECORD ───────────────────────────────────────────
// This comment IS the AP2 nav design spec of record (there is no separate
// AP2.1H document in the repo). The locked 10-item order is:
//
//   Home / Transactions / Clients / Buildings / AI / Calendar /
//   Notifications / Training / Library / Settings
//
// Future reordering, additions, or removals still require documented product
// approval recorded here before the array below changes.
//
// R5 — Training Hub unifies the old Training + Script Library +
// Resources surfaces under one (portal) destination at /training.
// The standalone Resources sidebar entry was removed (its content
// is now a tab inside Training). Legacy /training was renamed to
// /training-legacy so the new hub owns /training; cards in the hub's
// Training tab deep-link there for video playback.
//
// AGENT.DOCS.1 — Adds "Library" as a top-level nav item between
// Training and Settings. Points at the blank-template library at
// /library, gated server-side by the agent-scoped Vault endpoint.
//
// HOTFIX.AP.STR.001 — Adds "Buildings" immediately after Clients. Migration
// rationale: the Airbnb-friendly building directory shipped only in the
// legacy Portal 1.0 shell (app/components/SidebarNav.tsx -> /str-directory)
// and was never carried into Portal 2.0, so agents lost the surface. This
// entry restores it natively at /buildings (Vault-backed, unchanged proxy).
// ============================================================================

export type NavItem = {
  id: string;
  label: string;
  /** Lucide icon name (resolved by the Sidebar). */
  icon:
    | "home"
    | "list-checks"
    | "users"
    | "building-2"
    | "sparkles"
    | "calendar"
    | "bell"
    | "graduation-cap"
    | "book-open"
    | "library"
    | "settings";
  href: string;
  /** Optional gate. When true, the item only renders for broker tier. */
  brokerOnly?: boolean;
  /** True when this item routes to a legacy page (outside (portal)). */
  legacy?: boolean;
};

/** Sidebar order is fixed by AP2.1H — do NOT reorder without updating
 *  the AP2 design doc. */
export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: "home",         label: "Home",          icon: "home",            href: "/home" },
  { id: "transactions", label: "Transactions",  icon: "list-checks",     href: "/workspace" },
  { id: "clients",      label: "Clients",       icon: "users",           href: "/clients" },
  { id: "buildings",    label: "Buildings",     icon: "building-2",      href: "/buildings" },
  { id: "ai",           label: "AI",            icon: "sparkles",        href: "/ai" },
  { id: "calendar",     label: "Calendar",      icon: "calendar",        href: "/calendar" },
  { id: "notifications",label: "Notifications", icon: "bell",            href: "/notifications" },
  { id: "training",     label: "Training",      icon: "graduation-cap",  href: "/training" },
  { id: "library",      label: "Library",       icon: "library",         href: "/library" },
  { id: "settings",     label: "Settings",      icon: "settings",        href: "/settings" },
] as const;

/** Tier check. Mirrors Vault's isBrokerTier vocabulary so the same
 *  semantic predicate evaluates the same way on both sides. */
export function isBrokerTier(role: string | null | undefined): boolean {
  return role === "broker" || role === "admin" || role === "office_manager";
}

/** Filter the nav list for a given role. */
export function visibleNavItems(role: string | null | undefined): NavItem[] {
  const broker = isBrokerTier(role);
  return NAV_ITEMS.filter((item) => (item.brokerOnly ? broker : true));
}

/** Active when the pathname matches the item's href.
 *  /home is exact-match to avoid matching every route. Nested routes
 *  (e.g. /workspace/abc-123) light up their parent.
 *  Guarded against prefix false-positives like /clients-other → /clients. */
export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}
