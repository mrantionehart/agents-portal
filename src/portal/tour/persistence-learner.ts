// ============================================================================
// AP2 guided-training — Agent (learner) resume persistence
// ============================================================================
// LEARNER-ONLY. Uses localStorage. Never reads or writes preview state.
//
// Storage key shape:
//   ht.pcert.tour.{opaqueUserSuffix}.{scriptId}.{scriptVersion}
//
// Rules (Phase 2 D + Resume-state separation):
//   * The KEY carries NO email, NO tenant, NO personal identifiers. If a
//     userId is provided we take a short opaque suffix (last 8 chars of
//     the uuid) to prevent shared-browser collisions; that suffix is not
//     itself a PII disclosure risk beyond what the browser session
//     already has.
//   * When the script version differs, the cached entry is invalidated.
//   * Preview mode uses a DIFFERENT module and never touches this store.
// ============================================================================

const PREFIX = "ht.pcert.tour" as const;

export interface LearnerResumeState {
  currentStepId: string;
  stepsCompleted: string[];
  updatedAt: string; // ISO
}

interface StoredEntry extends LearnerResumeState {
  scriptVersion: string;
}

function opaqueSuffix(userId: string | null | undefined): string {
  if (!userId) return "anon";
  const clean = userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return clean.length >= 8 ? clean.slice(-8) : clean;
}

function key(
  userId: string | null | undefined,
  scriptId: string,
  scriptVersion: string,
): string {
  return `${PREFIX}.${opaqueSuffix(userId)}.${scriptId}.${scriptVersion}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Read the cached learner state for (userId, scriptId, scriptVersion).
 * Returns null when the entry is absent OR the stored scriptVersion
 * differs (invalidated on version mismatch).
 */
export function readLearnerResume(
  userId: string | null | undefined,
  scriptId: string,
  scriptVersion: string,
): LearnerResumeState | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(key(userId, scriptId, scriptVersion));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredEntry;
    if (parsed.scriptVersion !== scriptVersion) return null;
    return {
      currentStepId: parsed.currentStepId,
      stepsCompleted: parsed.stepsCompleted ?? [],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Write the current step + completed-step ledger. Overwrites any prior
 * value.
 */
export function writeLearnerResume(
  userId: string | null | undefined,
  scriptId: string,
  scriptVersion: string,
  state: LearnerResumeState,
): void {
  if (!isBrowser()) return;
  const entry: StoredEntry = { ...state, scriptVersion };
  window.localStorage.setItem(
    key(userId, scriptId, scriptVersion),
    JSON.stringify(entry),
  );
}

/**
 * Clear the cache for a specific script + version. Called after a
 * confirmed completion write returns 200 from Vault.
 */
export function clearLearnerResume(
  userId: string | null | undefined,
  scriptId: string,
  scriptVersion: string,
): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key(userId, scriptId, scriptVersion));
}

/**
 * Clear ALL learner tour state for a given user. Intended for logout
 * hooks — Agent Portal's existing sign-out flow should call this.
 */
export function clearAllLearnerResumeForUser(
  userId: string | null | undefined,
): void {
  if (!isBrowser()) return;
  const prefix = `${PREFIX}.${opaqueSuffix(userId)}.`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(prefix)) keysToRemove.push(k);
  }
  for (const k of keysToRemove) window.localStorage.removeItem(k);
}
