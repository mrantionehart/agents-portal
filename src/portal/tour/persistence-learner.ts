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
//
// Storage failure policy
// ----------------------
//   Every localStorage read/write/delete is wrapped in try/catch. The
//   tour must NEVER crash because localStorage is unavailable
//   (SecurityError in sandboxed frames, QuotaExceededError on a full
//   store, private-browsing modes on certain iOS/Safari builds, or a
//   feature-detected empty implementation). All failures are swallowed
//   silently — the caller's active tour continues in memory. A single
//   `console.warn` is emitted with a structured tag so telemetry can
//   pick up "storage unavailable" without user-visible breakage.
// ============================================================================

const PREFIX = "ht.pcert.tour" as const;

export interface LearnerResumeState {
  currentStepId: string;
  stepsCompleted: string[];
  updatedAt: string; // ISO
  // Track 2 mount-fix: identifiers needed to rehydrate a learner-mode
  // tour on a fresh mount (URL-bar / refresh / deep-link scenarios that
  // reset React state). Optional for backward compatibility with older
  // entries.
  certificationId?: string;
  lessonId?: string;
}

interface StoredEntry extends LearnerResumeState {
  scriptVersion: string;
}

/** Rehydration record surfaced by `findActiveLearnerResume()`. */
export interface ActiveLearnerLocator {
  scriptId: string;
  scriptVersion: string;
  currentStepId: string;
  stepsCompleted: string[];
  updatedAt: string;
  certificationId: string;
  lessonId: string;
}

const KEY_SUFFIX_RE = /^(.+)\.(\d+\.\d+\.\d+)$/;

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
 * Whether the ambient `localStorage` implementation is actually usable.
 * Some private-mode + sandboxed-frame environments expose the object
 * but throw on setItem. Feature-detect once per call, quietly.
 */
function isStorageUsable(): boolean {
  if (!isBrowser()) return false;
  try {
    const probeKey = "__ht_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function warn(operation: string, err: unknown): void {
  // Structured diagnostic. Downstream telemetry can key on the tag.
  // eslint-disable-next-line no-console
  console.warn("[tour.storage.learner]", { operation, error: describe(err) });
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown";
  }
}

/**
 * Read the cached learner state for (userId, scriptId, scriptVersion).
 * Returns null when the entry is absent, corrupted, or the stored
 * scriptVersion differs. Always returns null on storage failure.
 */
export function readLearnerResume(
  userId: string | null | undefined,
  scriptId: string,
  scriptVersion: string,
): LearnerResumeState | null {
  if (!isBrowser()) return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key(userId, scriptId, scriptVersion));
  } catch (err) {
    warn("getItem", err);
    return null;
  }
  if (!raw) return null;
  let parsed: StoredEntry;
  try {
    const candidate = JSON.parse(raw) as unknown;
    if (!isStoredEntry(candidate)) {
      warn("shape", "malformed stored value shape");
      // Try to clean it up so we don't keep re-hitting the same corrupted
      // record. Best-effort; ignored if it fails.
      try {
        window.localStorage.removeItem(key(userId, scriptId, scriptVersion));
      } catch {
        // no-op
      }
      return null;
    }
    parsed = candidate;
  } catch (err) {
    warn("parse", err);
    return null;
  }
  if (parsed.scriptVersion !== scriptVersion) return null;
  return {
    currentStepId: parsed.currentStepId,
    stepsCompleted: parsed.stepsCompleted ?? [],
    updatedAt: parsed.updatedAt,
    certificationId: parsed.certificationId,
    lessonId: parsed.lessonId,
  };
}

/**
 * Scan localStorage for the most-recently updated in-flight learner
 * tour for `userId` that carries the mount-fix identifiers
 * (`certificationId` + `lessonId`). Used exclusively by TourProvider's
 * mount effect to rehydrate after a hard navigation.
 *
 * Older entries that predate the mount-fix (no cert/lesson stored) are
 * silently skipped — they can still resume via the existing
 * readLearnerResume() path once a client-side session is active.
 *
 * Returns null when no rehydratable entry exists, localStorage is
 * unavailable, or a security/quota error occurs.
 */
export function findActiveLearnerResume(
  userId: string | null | undefined,
): ActiveLearnerLocator | null {
  if (!isBrowser()) return null;
  if (!isStorageUsable()) return null;
  const userPrefix = `${PREFIX}.${opaqueSuffix(userId)}.`;
  let best: ActiveLearnerLocator | null = null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(userPrefix)) continue;
      const suffix = k.slice(userPrefix.length);
      const m = suffix.match(KEY_SUFFIX_RE);
      if (!m) continue;
      const scriptId = m[1];
      const scriptVersion = m[2];
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(k);
      } catch {
        continue;
      }
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
          stepsCompleted: parsed.stepsCompleted ?? [],
          updatedAt: parsed.updatedAt,
          certificationId: parsed.certificationId,
          lessonId: parsed.lessonId,
        };
      }
    }
  } catch (err) {
    warn("enumerate", err);
    return null;
  }
  return best;
}

/**
 * Write the current step + completed-step ledger. Overwrites any prior
 * value. Silently swallows quota/security/unavailable errors so the
 * active tour never crashes.
 */
export function writeLearnerResume(
  userId: string | null | undefined,
  scriptId: string,
  scriptVersion: string,
  state: LearnerResumeState,
): void {
  if (!isBrowser()) return;
  const entry: StoredEntry = { ...state, scriptVersion };
  try {
    window.localStorage.setItem(
      key(userId, scriptId, scriptVersion),
      JSON.stringify(entry),
    );
  } catch (err) {
    warn("setItem", err);
  }
}

/**
 * Clear the cache for a specific script + version. Called after a
 * confirmed completion write returns 200 from Vault. Silent on failure.
 */
export function clearLearnerResume(
  userId: string | null | undefined,
  scriptId: string,
  scriptVersion: string,
): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key(userId, scriptId, scriptVersion));
  } catch (err) {
    warn("removeItem", err);
  }
}

/**
 * Clear ALL learner tour state for a given user. Intended for logout
 * hooks — Agent Portal's existing sign-out flow calls this via
 * AuthProvider.signOut. Silent on failure — a storage error must NOT
 * block a logout.
 */
export function clearAllLearnerResumeForUser(
  userId: string | null | undefined,
): void {
  if (!isBrowser()) return;
  if (!isStorageUsable()) return;
  const prefix = `${PREFIX}.${opaqueSuffix(userId)}.`;
  let keysToRemove: string[];
  try {
    keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) keysToRemove.push(k);
    }
  } catch (err) {
    warn("enumerate", err);
    return;
  }
  for (const k of keysToRemove) {
    try {
      window.localStorage.removeItem(k);
    } catch (err) {
      warn("removeItem(bulk)", err);
      // Continue with the rest.
    }
  }
}

function isStoredEntry(v: unknown): v is StoredEntry {
  if (!v || typeof v !== "object") return false;
  const c = v as Partial<StoredEntry>;
  return (
    typeof c.currentStepId === "string" &&
    typeof c.scriptVersion === "string" &&
    typeof c.updatedAt === "string" &&
    (c.stepsCompleted === undefined || Array.isArray(c.stepsCompleted))
  );
}
