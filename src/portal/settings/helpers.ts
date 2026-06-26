// ============================================================================
// AGENT PORTAL 2.1 — R7 — Settings Hub helpers
// ============================================================================
// Pure helpers for the Settings Hub. Display labels + small derivations.
// ============================================================================

import type { SettingsProfile } from "./types";

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Agent";
  const r = role.toLowerCase();
  if (r === "broker") return "Broker";
  if (r === "admin") return "Admin";
  if (r === "office_manager") return "Office Manager";
  if (r === "agent") return "Agent";
  // Pass through any future roles, capitalized.
  return r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, " ");
}

/** Short display name. Falls back to email-local, then "—". */
export function displayName(p: SettingsProfile): string {
  if (p.full_name && p.full_name.trim()) return p.full_name.trim();
  if (p.email && p.email.includes("@")) {
    return p.email.split("@")[0];
  }
  return "—";
}

/** Initials for the avatar tile. */
export function initials(p: SettingsProfile): string {
  const name = displayName(p);
  if (name === "—") return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
