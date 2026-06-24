// ============================================================================
// AGENT PORTAL 2.0 — Design Tokens
// ============================================================================
// Single source of truth for the new (portal) experience. Mirrors Vault's
// vocabulary so the agent sees the same readiness colors / typography
// scale / spacing rhythm across both surfaces.
//
// Scope: AP2.1A introduces the tokens. AP2.1B-H consume them as components
// land. The legacy portal shell is untouched and may keep its existing
// inline classes — these tokens drive ONLY the new (portal) route group.
//
// No business logic. No runtime state. Pure constants.
// ============================================================================

/** Spacing scale, in pixels. Generous rhythm a la Notion / Linear. */
export const spacing = {
  px:  "1px",
  0:   "0px",
  1:   "4px",
  2:   "8px",
  3:   "12px",
  4:   "16px",
  5:   "20px",
  6:   "24px",
  8:   "32px",
  10:  "40px",
  12:  "48px",
  16:  "64px",
  20:  "80px",
  24:  "96px",
} as const;

/** Type scale — 12 / 14 / 16 / 18 / 24 / 30 / 36 / 48. */
export const typography = {
  size: {
    xs:  "0.75rem",   // 12 — meta, captions
    sm:  "0.875rem",  // 14 — body, table cells
    base:"1rem",      // 16 — default body
    lg:  "1.125rem",  // 18 — emphasis
    xl:  "1.5rem",    // 24 — section headers
    "2xl": "1.875rem",// 30 — page headers
    "3xl": "2.25rem", // 36 — KPI digits
    "4xl": "3rem",    // 48 — hero number (readiness %)
  },
  weight: {
    regular:  "400",
    medium:   "500",
    semibold: "600",
    bold:     "700",
  },
  // Inter is loaded in the root layout already.
  family: {
    sans: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  // tabular-nums utility for KPI digits.
  numeric: {
    tabular: "tabular-nums",
  },
} as const;

/** Border radius. */
export const radius = {
  none: "0",
  sm:   "4px",
  md:   "6px",
  lg:   "8px",
  xl:   "12px",
  "2xl":"16px",
  pill: "9999px",
} as const;

/** Color palette. Dark-first; light mode is Phase 2. */
export const colors = {
  // Surfaces — deep neutral, low chrome. Mirrors Vault's zinc-950 base.
  surface: {
    page:     "#050507", // body background
    base:     "#0b0b10", // primary container
    raised:   "#11111a", // cards above page
    overlay:  "#1a1a25", // popovers, drawers
    hover:    "rgba(255,255,255,0.04)",
  },
  // Borders — subtle, never harsh.
  border: {
    default:  "#1a1a2e",
    strong:   "#252538",
    subtle:   "rgba(255,255,255,0.06)",
  },
  // Text — large contrast steps, no in-between greys.
  text: {
    primary:   "#F1F1F3",
    secondary: "#A1A1AA",
    muted:     "#71717A",
    inverse:   "#0b0b10",
  },
  // Accent — HartFelt gold (matches Vault's amber accent).
  accent: {
    DEFAULT: "#C9A84C",
    soft:    "#E8D5A3",
    deep:    "#9D824B",
  },
  // Semantic — mirrors Vault P10I/P1B vocabulary so badges match.
  semantic: {
    ok:    { fg: "#a7f3d0", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.4)" },
    info:  { fg: "#bae6fd", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.4)" },
    warn:  { fg: "#fde68a", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)" },
    danger:{ fg: "#fecaca", bg: "rgba(220,38,38,0.12)", border: "rgba(220,38,38,0.4)" },
    muted: { fg: "#A1A1AA", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" },
  },
} as const;

/** Shadow scale. Used sparingly — Linear-ish. */
export const shadows = {
  none: "none",
  sm:   "0 1px 2px rgba(0,0,0,0.4)",
  md:   "0 4px 12px rgba(0,0,0,0.45)",
  lg:   "0 12px 32px rgba(0,0,0,0.5)",
  // Inset for raised cards on dark surfaces.
  raised: "inset 0 0 0 1px rgba(255,255,255,0.04)",
} as const;

/** Transition tokens — short, consistent. No decorative motion. */
export const transitions = {
  duration: {
    fast:    "120ms",
    base:    "180ms",
    slow:    "240ms",
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    enter:    "cubic-bezier(0, 0, 0, 1)",
    exit:     "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

/** Layout dimensions consumed by the shell. */
export const layout = {
  sidebar: {
    width: "240px",
    widthCollapsed: "64px",
  },
  topbar: {
    height: "56px",
  },
  content: {
    maxWidth: "1280px",
    padding: spacing[6],
  },
} as const;

/** Z-index scale. Keep low integer values; layering is rare. */
export const z = {
  base:    0,
  raised:  1,
  sticky:  10,
  drawer:  20,
  overlay: 30,
  modal:   40,
  toast:   50,
} as const;

/** Pre-baked Tailwind class fragments for the most common cases.
 *  Components reach for these so design changes happen here, not in
 *  every JSX file. */
export const cls = {
  // Surfaces
  pageBg:    "bg-[#050507] text-[#F1F1F3]",
  card:      "rounded-lg border border-[#1a1a2e] bg-[#11111a]",
  cardRaised:"rounded-lg border border-[#252538] bg-[#1a1a25]",
  // Borders
  divider:   "border-t border-[#1a1a2e]",
  // Buttons
  buttonGhost:
    "inline-flex items-center gap-1.5 rounded-md border border-transparent " +
    "px-2.5 py-1.5 text-sm text-[#A1A1AA] " +
    "hover:bg-white/[0.04] hover:text-[#F1F1F3] " +
    "transition-colors duration-[180ms]",
  buttonAccent:
    "inline-flex items-center gap-1.5 rounded-md border border-[#C9A84C]/40 " +
    "bg-[#C9A84C]/15 px-3 py-1.5 text-sm font-medium text-[#E8D5A3] " +
    "hover:bg-[#C9A84C]/25 transition-colors duration-[180ms]",
  // Nav item base
  navItem:
    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm " +
    "text-[#A1A1AA] hover:text-[#F1F1F3] " +
    "hover:bg-white/[0.04] transition-colors duration-[180ms]",
  navItemActive:
    "bg-white/[0.06] text-[#F1F1F3]",
} as const;

export type TokenColor = keyof typeof colors;
export type SemanticTone = keyof typeof colors.semantic;
