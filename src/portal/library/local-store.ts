// ============================================================================
// PAPERWORK UX-001 — Favorites + Recently Used (client-side, agent-personal)
// ============================================================================
// localStorage-backed so it adds ZERO Vault API surface (Vault APIs stay frozen).
// Favorites here are AGENT-PERSONAL. Broker-shared "pinned" favorites are a
// future enhancement that needs one new Vault endpoint — deliberately deferred
// while the API contract is frozen.
// ============================================================================

const RECENT_KEY = "hf.library.recent.v1";
const FAV_KEY = "hf.library.favorites.v1";
const RECENT_MAX = 5;

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, value: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

export function getRecent(): string[] {
  return read(RECENT_KEY);
}

/** Record a downloaded form_id at the front; dedupe; cap at RECENT_MAX. */
export function pushRecent(formId: string): string[] {
  const next = [formId, ...read(RECENT_KEY).filter((f) => f !== formId)].slice(0, RECENT_MAX);
  write(RECENT_KEY, next);
  return next;
}

export function getFavorites(): string[] {
  return read(FAV_KEY);
}

export function isFavorite(formId: string): boolean {
  return read(FAV_KEY).includes(formId);
}

/** Toggle a favorite; returns the new list. */
export function toggleFavorite(formId: string): string[] {
  const cur = read(FAV_KEY);
  const next = cur.includes(formId) ? cur.filter((f) => f !== formId) : [formId, ...cur];
  write(FAV_KEY, next);
  return next;
}
