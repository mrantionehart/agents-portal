// ============================================================================
// AP2 guided-training — anchor vocabulary + DOM resolver
// ============================================================================
// Semantic anchor ids are dotted namespaces: {product}.{surface}.{element}.
// They are stable across UI refactors (rename a component; the anchor id
// stays); NEVER CSS selectors.
//
// This module is the ONE authoritative allowlist for the guided-training
// tracks. Adding a new anchor requires:
//   1. Extend TRAINING_ANCHORS below.
//   2. Plant `data-training-id={anchor}` on the corresponding AP2
//      component's root DOM element.
//   3. Update the anchor coverage test.
// ============================================================================

export const TRAINING_ANCHORS = {
  // Track 1 — Portal Foundations (pcert-l01/l02/l03).
  navSidebar: "portal.navigation.sidebar",
  navHome: "portal.navigation.home",
  navWorkspace: "portal.navigation.workspace",
  navNotifications: "portal.navigation.notifications",
  navSettings: "portal.navigation.settings",
  homeDashboard: "portal.home.dashboard",
  notificationsInbox: "portal.notifications.inbox",
  settingsProfile: "portal.settings.profile",

  // Track 2 — Transaction Intelligence (pcert-l06/l07/l08/l09/l10).
  // Anchors span the transaction workspace hero (Coordinator + Coach),
  // the assistant prompt-chips row, the AI tab pill, and the AI panel
  // family (panel · draft picker · draft card and its sub-regions).
  //
  // Repetition notes:
  //   * All anchors below are unique per rendered page EXCEPT the
  //     `workspaceAiDraftCard*` family. Multiple drafts in the AI
  //     history render multiple `AssistantDraftCard` instances; the
  //     resolver returns the first-match in DOM order (see resolver
  //     doc below). Track 2 QA fixtures ensure one draft per fixture
  //     transaction; tour scripts must NOT depend on a specific draft
  //     when multiple could render.
  workspaceCoordinator: "portal.workspace.coordinator",
  workspaceCoordinatorDirective: "portal.workspace.coordinator.directive",
  workspaceCoordinatorBlockers: "portal.workspace.coordinator.blockers",
  workspaceCoordinatorCta: "portal.workspace.coordinator.cta",
  workspaceCoachStrip: "portal.workspace.coach.strip",
  workspaceAssistantPromptChips: "portal.workspace.assistant.prompt-chips",
  workspaceTabAi: "portal.workspace.tab.ai",
  workspaceAiPanel: "portal.workspace.ai.panel",
  workspaceAiDraftPicker: "portal.workspace.ai.draft-picker",
  workspaceAiDraftCard: "portal.workspace.ai.draft-card",
  workspaceAiDraftCardConfidence: "portal.workspace.ai.draft-card.confidence",
  workspaceAiDraftCardWarnings: "portal.workspace.ai.draft-card.warnings",
  workspaceAiDraftCardFactsUsed: "portal.workspace.ai.draft-card.facts-used",
} as const;

export type TrainingAnchorKey = keyof typeof TRAINING_ANCHORS;
export type TrainingAnchorId = (typeof TRAINING_ANCHORS)[TrainingAnchorKey];

export const ALLOWED_TRAINING_ANCHOR_IDS: readonly TrainingAnchorId[] =
  Object.values(TRAINING_ANCHORS);

const ANCHOR_ID_SHAPE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/**
 * True when `id` is a syntactically valid semantic anchor. This is a
 * cheap sanity guard for authored content; it does NOT check DOM
 * presence.
 */
export function isValidAnchorId(id: string): boolean {
  return ANCHOR_ID_SHAPE.test(id);
}

/**
 * True when `id` is in the pilot's allowlist. Used by the tour runner
 * to fail fast when a script (somehow) requests an anchor the AP2
 * shell has never been asked to plant.
 */
export function isAllowedAnchorId(id: string): boolean {
  return (ALLOWED_TRAINING_ANCHOR_IDS as readonly string[]).includes(id);
}

/**
 * Resolves an anchor id to its live DOM element. Returns null when the
 * element is not present (the caller MUST NOT auto-advance; show the
 * missing-target fallback instead).
 *
 * The resolver uses a strict `[data-training-id="..."]` attribute
 * selector — the id is baked in by the AP2 components, never derived
 * from a class name or route.
 */
export function resolveAnchor(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  // Attribute selectors are safe because the anchor id shape excludes
  // CSS metacharacters. We still guard by shape as defense in depth.
  if (!isValidAnchorId(id)) return null;
  // Use the DOM API (not string concat into HTML) so the browser
  // handles quoting.
  return (document.querySelector(
    `[data-training-id="${id}"]`,
  ) as HTMLElement | null) ?? null;
}
