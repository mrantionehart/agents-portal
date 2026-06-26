// ============================================================================
// AGENT PORTAL 2.1 — R7 — Settings Hub types
// ============================================================================
// Safe summary of the caller's profile. Surfaces ONLY the fields the
// Profile card needs to render — never returns sensitive columns
// (auth metadata, tokens, etc.).
// ============================================================================

export interface SettingsProfile {
  /** Display name, "—" when unset. */
  full_name: string | null;
  /** Auth email, "—" when somehow missing. */
  email: string | null;
  /** Profile role (broker | admin | office_manager | agent | …) or
   *  null when no profile row exists yet. */
  role: string | null;
}

export type SettingsProfileResult =
  | { kind: "ok"; profile: SettingsProfile }
  | { kind: "anonymous" };
