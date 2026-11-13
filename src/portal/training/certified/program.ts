// ============================================================================
// Which certification program the certified-track pages render.
// ============================================================================
// The track, lesson and quiz pages were written for the HartFelt Platform
// Certification. They now also render CTM, selected by a `?program=` query
// parameter. ALLOWLISTED: an unknown value never falls back to another
// program — it resolves to `null` and the page renders not-found. No parameter
// keeps the platform certification, so every existing link is unchanged.
//
// Access is NOT decided here. Vault's learner gate decides it for every call
// (CTM: program ACTIVE + live assignment; broker-only read preview).
// ============================================================================

import { CTM_CERTIFICATION_ID, HARTFELT_PLATFORM_CERTIFIED_ID } from "./types";

export const CERTIFIED_TRACK_PROGRAMS = [HARTFELT_PLATFORM_CERTIFIED_ID, CTM_CERTIFICATION_ID] as const;
export type CertifiedTrackProgram = (typeof CERTIFIED_TRACK_PROGRAMS)[number];

export function resolveProgramParam(raw: string | null | undefined): CertifiedTrackProgram | null {
  if (raw === null || raw === undefined || raw === "") return HARTFELT_PLATFORM_CERTIFIED_ID;
  return (CERTIFIED_TRACK_PROGRAMS as readonly string[]).includes(raw) ? (raw as CertifiedTrackProgram) : null;
}

/** Append `program=` for non-default programs; platform links stay byte-identical. */
export function withProgram(href: string, program: string): string {
  if (program === HARTFELT_PLATFORM_CERTIFIED_ID) return href;
  return `${href}${href.includes("?") ? "&" : "?"}program=${encodeURIComponent(program)}`;
}

export function trackHref(program: string, trackId: string): string {
  return withProgram(`/training/certified/${encodeURIComponent(trackId)}`, program);
}

export function lessonHref(program: string, trackId: string, lessonId: string): string {
  return withProgram(`/training/certified/${encodeURIComponent(trackId)}/${encodeURIComponent(lessonId)}`, program);
}
