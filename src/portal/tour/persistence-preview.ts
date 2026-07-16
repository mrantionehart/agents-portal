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
// ============================================================================

const PREFIX = "ht.pcert.tour.preview" as const;

export interface PreviewState {
  currentStepId: string;
  updatedAt: string; // ISO
}

interface StoredEntry extends PreviewState {
  scriptVersion: string;
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
    return { currentStepId: parsed.currentStepId, updatedAt: parsed.updatedAt };
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
