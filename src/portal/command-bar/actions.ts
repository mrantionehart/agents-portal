// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — Command Bar actions
// ============================================================================
// Pure derivations: action catalog + search/filter composition. NO DOM,
// NO React, NO mutations. The catalog is the SOURCE OF TRUTH for what
// the command bar can do; anything not in this file is not allowed.
//
// Hard rule: every action is either NAVIGATION or AI-SEED. The
// command bar never:
//   - sends envelopes
//   - approves paperwork
//   - updates transaction fields
//   - sends portal invites
//   - marks compliance complete
// Sensitive actions ALWAYS happen through Vault AI chat or Vault UI
// with broker confirmation.
// ============================================================================

export type ActionKind = "navigate" | "seed-ai";

export interface NavigateAction {
  id: string;
  kind: "navigate";
  label: string;
  hint?: string;
  href: string;
  /** Sidebar grouping for the palette. */
  section: "Navigate" | "Recent" | "AI";
}

export interface SeedAIAction {
  id: string;
  kind: "seed-ai";
  label: string;
  hint?: string;
  /** The /ai page reads ?seed=<text> and pre-fills the input — never auto-sends. */
  seed: string;
  section: "AI";
}

export type CommandAction = NavigateAction | SeedAIAction;

// ── Static navigation catalog ───────────────────────────────────────

/** Top-level navigation actions. These MIRROR the sidebar except they're
 *  available from the ⌘K palette as well. */
export const NAV_ACTIONS: ReadonlyArray<NavigateAction> = [
  { id: "nav-home",         kind: "navigate", section: "Navigate", label: "Go to Home",          hint: "/home",          href: "/home" },
  { id: "nav-transactions", kind: "navigate", section: "Navigate", label: "Go to Transactions",  hint: "/workspace",     href: "/workspace" },
  { id: "nav-clients",      kind: "navigate", section: "Navigate", label: "Go to Clients",       hint: "/clients",       href: "/clients" },
  { id: "nav-calendar",     kind: "navigate", section: "Navigate", label: "Go to Calendar",      hint: "/calendar",      href: "/calendar" },
  { id: "nav-notifications",kind: "navigate", section: "Navigate", label: "Go to Notifications", hint: "/notifications", href: "/notifications" },
  { id: "nav-ai",           kind: "navigate", section: "Navigate", label: "Go to AI",            hint: "/ai",            href: "/ai" },
] as const;

// ── Search helpers ──────────────────────────────────────────────────

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/\s+/).filter(Boolean);
}

function fuzzyContains(hay: string, needleTokens: string[]): boolean {
  const h = hay.toLowerCase();
  return needleTokens.every((t) => h.includes(t));
}

export interface CommandTxn {
  id: string;
  title: string;     // property address or "(no address)"
  subtitle: string;  // client name + stage
}

export interface CommandClient {
  id: string;
  title: string;     // full_name
  subtitle: string;  // email / phone
}

/** Build navigate-to-transaction actions from a workspace card list,
 *  filtered by the search query. Returns at most `max` results. */
export function transactionActions(
  txns: CommandTxn[],
  query: string,
  max = 8
): NavigateAction[] {
  const tokens = tokenize(query);
  const filtered = tokens.length === 0
    ? txns
    : txns.filter((t) => fuzzyContains(`${t.title} ${t.subtitle}`, tokens));
  return filtered.slice(0, max).map((t) => ({
    id: `txn-${t.id}`,
    kind: "navigate" as const,
    section: "Navigate" as const,
    label: t.title,
    hint: t.subtitle,
    href: `/workspace/${t.id}`,
  }));
}

/** Same shape for client search → /clients/[id]. */
export function clientActions(
  clients: CommandClient[],
  query: string,
  max = 8
): NavigateAction[] {
  const tokens = tokenize(query);
  const filtered = tokens.length === 0
    ? clients
    : clients.filter((c) => fuzzyContains(`${c.title} ${c.subtitle}`, tokens));
  return filtered.slice(0, max).map((c) => ({
    id: `client-${c.id}`,
    kind: "navigate" as const,
    section: "Navigate" as const,
    label: c.title,
    hint: c.subtitle,
    href: `/clients/${c.id}`,
  }));
}

/** Filter the static nav catalog by query. */
export function filteredNavActions(query: string): NavigateAction[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...NAV_ACTIONS];
  return NAV_ACTIONS.filter((a) => fuzzyContains(a.label, tokens));
}

/** Build a single "Ask AI: <query>" seed action when the user has typed
 *  enough characters to be meaningful. */
export function seedAIActions(query: string): SeedAIAction[] {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  return [
    {
      id: `seed-${trimmed.length}`,
      kind: "seed-ai",
      section: "AI",
      label: `Ask AI: ${trimmed}`,
      hint: "Opens /ai with this prompt pre-filled. You still press Send.",
      seed: trimmed,
    },
  ];
}

// ── Top-level composer ──────────────────────────────────────────────

export interface ComposedResults {
  nav: NavigateAction[];
  txns: NavigateAction[];
  clients: NavigateAction[];
  ai: SeedAIAction[];
}

/** Compose every section the palette will show. Each section is
 *  independently capped so a noisy section can't crowd out the others. */
export function composePalette(input: {
  query: string;
  txns: CommandTxn[];
  clients: CommandClient[];
}): ComposedResults {
  return {
    nav: filteredNavActions(input.query),
    txns: transactionActions(input.txns, input.query),
    clients: clientActions(input.clients, input.query),
    ai: seedAIActions(input.query),
  };
}

/** Flatten the composed palette into a single ordered list of actions —
 *  used by keyboard navigation (↑ / ↓) so a single index can address
 *  any visible row. */
export function flattenActions(r: ComposedResults): CommandAction[] {
  return [...r.nav, ...r.txns, ...r.clients, ...r.ai];
}

/** Static sanity check — the catalog never includes a mutation. The
 *  build-time test in __tests__ asserts this stays true. */
export const ALLOWED_KINDS: ReadonlyArray<ActionKind> = ["navigate", "seed-ai"];

/** Build the navigation target the parent's <Link> should use. For
 *  AI-seed actions, we encode the seed in the /ai search params so
 *  the page reads it on mount. Always client-side navigation. */
export function targetFor(a: CommandAction): string {
  if (a.kind === "navigate") return a.href;
  return `/ai?seed=${encodeURIComponent(a.seed)}`;
}
