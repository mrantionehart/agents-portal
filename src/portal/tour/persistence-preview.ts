// ============================================================================
// AP2 guided-training — Broker preview state
// ============================================================================
// PREVIEW-ONLY. Uses sessionStorage (per-tab, cleared on close).
//
// This module NEVER reads or writes learner-mode resume data. The two
// stores are physically separate (sessionStorage vs localStorage) AND
// use disjoint key prefixes so no key can be misinterpreted between
// stores.
//
// Storage key shape:
//   ht.pcert.tour.preview.{scriptId}.{scriptVersion}
//
// No user identifier is included — preview is a broker workflow
// operating on script content, not on a specific agent's progress.
//
// Track 2 mount-fix (2026-07-18): `certificationId` + `lessonId` were
// added to the stored PreviewState so TourProvider can rehydrate an
// in-flight preview on a fresh mount (URL-bar / refresh / deep-link
// scenarios that reset the React state). Older entries lacking these
// fields are still readable and are simply ignored by the rescan path;
// they continue to work under the existing readPreviewState() flow so
// no rehydration downgrade occurs for pre-fix sessions.
// ============================================================================

const PREFIX = "ht.pcert.tour.preview" as const;
// Matches keys of the form `{PREFIX}.{scriptId}.{scriptVersion}` where
// scriptId may itself contain dots and scriptVersion is a semver
// triplet. Anchored so parsing is deterministic.
const KEY_SUFFIX_RE = /^(.+)\.(\d+\.\d+\.\d+)$/;

export interface PreviewState {
  currentStepId: string;
  updatedAt: string; // ISO
  // Track 2 mount-fix: identifiers needed to rehydrate a preview on a
  // fresh mount. Optional for backward compatibility with older entries.
  certificationId?: string;
  lessonId?: string;
}

interface StoredEntry extends PreviewState {
  scriptVersion: string;
}

/** Rehydration record surfaced by `findActivePreview()`. */
export interface ActivePreviewLocator {
  scriptId: string;
  scriptVersion: string;
  currentStepId: string;
  updatedAt: string;
  certificationId: string;
  lessonId: string;
}

function key(scriptId: string, scriptVersion: string): string {
  return `${PREFIX}.${scriptId}.${scriptVersion}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function readPreviewState(
  scriptId: string,
  scriptVersion: string,
): PreviewState | null {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(key(scriptId, scriptVersion));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredEntry;
    if (parsed.scriptVersion !== scriptVersion) return null;
    return {
      currentStepId: parsed.currentStepId,
      updatedAt: parsed.updatedAt,
      certificationId: parsed.certificationId,
      lessonId: parsed.lessonId,
    };
  } catch {
    return null;
  }
}

export function writePreviewState(
  scriptId: string,
  scriptVersion: string,
  state: PreviewState,
): void {
  if (!isBrowser()) return;
  const entry: StoredEntry = { ...state, scriptVersion };
  window.sessionStorage.setItem(
    key(scriptId, scriptVersion),
    JSON.stringify(entry),
  );
}

export function clearPreviewState(
  scriptId: string,
  scriptVersion: string,
): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(key(scriptId, scriptVersion));
}

/**
 * Scan sessionStorage for an in-flight preview and return the most-
 * recently updated entry that carries the mount-fix identifiers
 * (`certificationId` + `lessonId`). Used exclusively by
 * TourProvider's mount effect to rehydrate after a hard navigation.
 *
 * Older entries that predate the mount-fix (no cert/lesson stored) are
 * silently skipped — they can still be resumed only via an active
 * client-side session where TourProvider already holds the id in memory.
 *
 * Returns null when no rehydratable entry exists, when sessionStorage is
 * unavailable, or when the store throws a security/quota error.
 */
export function findActivePreview(): ActivePreviewLocator | null {
  if (!isBrowser()) return null;
  let best: ActivePreviewLocator | null = null;
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (!k || !k.startsWith(PREFIX + ".")) continue;
      const suffix = k.slice(PREFIX.length + 1);
      const m = suffix.match(KEY_SUFFIX_RE);
      if (!m) continue;
      const scriptId = m[1];
      const scriptVersion = m[2];
      const raw = window.sessionStorage.getItem(k);
      if (!raw) continue;
      let parsed: StoredEntry;
      try {
        parsed = JSON.parse(raw) as StoredEntry;
      } catch {
        continue;
      }
      if (parsed.scriptVersion !== scriptVersion) continue;
      if (typeof parsed.certificationId !== "string") continue;
      if (typeof parsed.lessonId !== "string") continue;
      if (typeof parsed.currentStepId !== "string") continue;
      if (typeof parsed.updatedAt !== "string") continue;
      if (!best || parsed.updatedAt > best.updatedAt) {
        best = {
          scriptId,
          scriptVersion,
          currentStepId: parsed.currentStepId,
          updatedAt: parsed.updatedAt,
          certificationId: parsed.certificationId,
          lessonId: parsed.lessonId,
        };
      }
    }
  } catch {
    return null;
  }
  return best;
}
