// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Transaction Workspace tab config
// ============================================================================
// Single declarative list of the 8 transaction tabs. Tab IDs are stable
// strings used in the `?tab=` URL param. Adding a new tab means editing
// this file PLUS the dispatch switch in app/(portal)/workspace/[transactionId]/page.tsx.
// No business logic here — pure presentation contract.
// ============================================================================

export type TabId =
  | "overview"
  | "package"
  | "documents"
  | "timeline"
  | "client"
  | "offers"
  | "compliance"
  | "commission"
  | "ai";

export interface TabSpec {
  id: TabId;
  label: string;
  /** Lucide icon name (resolved in TabStrip). */
  icon:
    | "layout-dashboard"
    | "package"
    | "file-text"
    | "clock"
    | "user-circle-2"
    | "handshake"
    | "shield-check"
    | "wallet"
    | "sparkles";
}

/** Tab order is fixed. Do NOT reorder existing tabs — agents bookmark `?tab=…`
 *  and external surfaces (R6 Home, R3A Clients, /workspace card) deep-link to
 *  specific tabs. Transaction OS 3.3E added `package`; ids are otherwise stable. */
export const WORKSPACE_TABS: ReadonlyArray<TabSpec> = [
  { id: "overview",   label: "Overview",   icon: "layout-dashboard" },
  { id: "package",    label: "Package",    icon: "package" },
  { id: "documents",  label: "Paperwork",  icon: "file-text" },
  { id: "timeline",   label: "Timeline",   icon: "clock" },
  { id: "client",     label: "Client",     icon: "user-circle-2" },
  { id: "offers",     label: "Offers",     icon: "handshake" },
  { id: "compliance", label: "Compliance", icon: "shield-check" },
  { id: "commission", label: "Commission", icon: "wallet" },
  { id: "ai",         label: "AI",         icon: "sparkles" },
] as const;

export const DEFAULT_TAB: TabId = "overview";

const TAB_ID_SET: Set<string> = new Set(WORKSPACE_TABS.map((t) => t.id));

/** Resolve a raw query-string value into a valid TabId. Unknown values
 *  (including null/undefined and any string not in the allowlist) fall
 *  back to the default tab. Mirrors the R3B/R5 tab-parse pattern. */
export function parseTab(raw: string | undefined | null): TabId {
  if (raw && TAB_ID_SET.has(raw)) return raw as TabId;
  return DEFAULT_TAB;
}

/** Build a `?tab=…` URL preserving an optional transactionId base. */
export function tabHref(transactionId: string, tab: TabId): string {
  if (tab === DEFAULT_TAB) return `/workspace/${transactionId}`;
  return `/workspace/${transactionId}?tab=${tab}`;
}
