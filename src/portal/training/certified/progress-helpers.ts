// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Progress derivation helpers
// ============================================================================
// Pure functions that project Vault's `CertifiedProgress` shape into
// UI-friendly aggregates. NEVER computes completion — the server engine
// owns that. These helpers only READ what Vault returned.
// ============================================================================

import type {
  CertifiedCatalog,
  CertifiedLesson,
  CertifiedProgress,
  LessonProgress,
  LessonStatus,
} from "./types";

/** Look up the caller-owned progress record for a lesson. Null when the
 *  progress projection does not include a row for it (fresh learner). */
export function findLessonProgress(
  progress: CertifiedProgress,
  lessonId: string,
): LessonProgress | null {
  for (const track of progress.tracks) {
    for (const lesson of track.lessons) {
      if (lesson.lesson_id === lessonId) return lesson;
    }
  }
  return null;
}

/** Aggregate track progress percent, from Vault's projection. */
export function findTrackProgressPct(
  progress: CertifiedProgress,
  trackId: string,
): number {
  const track = progress.tracks.find((t) => t.module_id === trackId);
  return track?.pct ?? 0;
}

/**
 * Is the lesson's prerequisite chain unlocked? True when there is no
 * prerequisite OR when the direct prerequisite lesson's status is
 * "completed" in the progress projection.
 *
 * We only check the DIRECT prerequisite — Vault's completion engine
 * cascades locking through the chain, so a locked direct prereq implies
 * everything upstream is also locked.
 */
export function isPrerequisiteUnlocked(
  progress: CertifiedProgress,
  lesson: CertifiedLesson,
): boolean {
  if (lesson.prerequisite_lesson_id === null) return true;
  const prereq = findLessonProgress(progress, lesson.prerequisite_lesson_id);
  return prereq?.status === "completed";
}

/**
 * Human-readable status label. Server LessonStatus is the source of truth;
 * we render a fixed copy string per status so UI doesn't drift from server
 * semantics.
 */
export function lessonStatusLabel(status: LessonStatus | "not_started"): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "awaiting_quiz":
      return "Ready for quiz";
    case "needs_retake":
      return "Retake required";
    case "failed_assessment":
      return "Assessment not passed";
    case "not_started":
      return "Not started";
  }
}

/** Resolve the human-readable prereq label (`Complete lesson X first`). */
export function prereqDisplayLabel(
  catalog: CertifiedCatalog,
  prereqLessonId: string,
): string {
  for (const track of catalog.tracks) {
    for (const lesson of track.lessons) {
      if (lesson.id === prereqLessonId) return lesson.title;
    }
  }
  return prereqLessonId;
}
