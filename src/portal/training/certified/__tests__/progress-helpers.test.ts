// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — progress-helpers pure-function tests
// ============================================================================
// The helpers read Vault's progress projection; they never compute
// completion. These tests lock the read behavior against server truth.
// ============================================================================

import {
  findLessonProgress,
  findTrackProgressPct,
  isPrerequisiteUnlocked,
  lessonStatusLabel,
  prereqDisplayLabel,
} from "../progress-helpers";
import type {
  CertifiedCatalog,
  CertifiedLesson,
  CertifiedProgress,
  LessonProgress,
  LessonStatus,
} from "../types";

// ─── Test fixtures ─────────────────────────────────────────────────────────

function lessonProgress(overrides: Partial<LessonProgress> & { lesson_id: string; status: LessonStatus }): LessonProgress {
  return {
    lesson_id: overrides.lesson_id,
    status: overrides.status,
    watched_seconds: overrides.watched_seconds ?? 0,
    watched_pct: overrides.watched_pct ?? 0,
    quiz_passed: overrides.quiz_passed ?? null,
    attested_at: overrides.attested_at ?? null,
  };
}

function progress(tracks: Array<{ module_id: string; pct?: number; lessons: LessonProgress[] }>): CertifiedProgress {
  return {
    certification_id: "hartfelt-platform-certified",
    version: "1.0.0",
    status: "in_progress",
    tracks: tracks.map((t) => ({
      module_id: t.module_id,
      status: "in_progress",
      pct: t.pct ?? 0,
      lessons: t.lessons,
    })),
    next_lesson: null,
    blocked_reason: null,
    assessment_attempts: 0,
    issuance: null,
    last_updated_at: "2026-07-18T00:00:00.000Z",
  };
}

function lesson(overrides: Partial<CertifiedLesson> & { id: string }): CertifiedLesson {
  return {
    id: overrides.id,
    module_id: overrides.module_id ?? "pcert-t01",
    video_num: overrides.video_num ?? "1",
    sort_order: overrides.sort_order ?? 1,
    title: overrides.title ?? overrides.id,
    description: null,
    objective_md: null,
    duration_seconds: null,
    practical_attestation_type: "none",
    requires_quiz: false,
    quiz_id: null,
    related_route: null,
    prerequisite_lesson_id: overrides.prerequisite_lesson_id ?? null,
    media_status: "ok",
    has_media: false,
    system: "portal",
    requirements: overrides.requirements ?? ["tour"],
    session_ui_spec: null,
    practical_ui_spec: null,
  };
}

function catalog(lessons: CertifiedLesson[]): CertifiedCatalog {
  // Group by module_id for the projection shape.
  const byModule = new Map<string, CertifiedLesson[]>();
  for (const l of lessons) {
    const arr = byModule.get(l.module_id) ?? [];
    arr.push(l);
    byModule.set(l.module_id, arr);
  }
  return {
    certification_id: "hartfelt-platform-certified",
    version: "1.0.0",
    tracks: Array.from(byModule.entries()).map(([id, ls], idx) => ({
      id,
      module_num: idx + 1,
      sort_order: 400 + idx + 1,
      title: id,
      description: null,
      status: "published" as const,
      requires_recert: false,
      version: "1.0.0",
      lessons: ls,
    })),
  };
}

// ─── findLessonProgress ────────────────────────────────────────────────────

describe("findLessonProgress", () => {
  it("returns null when the lesson has no progress row (fresh learner)", () => {
    const p = progress([]);
    expect(findLessonProgress(p, "pcert-l01")).toBeNull();
  });

  it("returns the matching row when the lesson is in the projection", () => {
    const p = progress([
      {
        module_id: "pcert-t01",
        lessons: [lessonProgress({ lesson_id: "pcert-l01", status: "completed" })],
      },
    ]);
    expect(findLessonProgress(p, "pcert-l01")?.status).toBe("completed");
  });
});

// ─── findTrackProgressPct ──────────────────────────────────────────────────

describe("findTrackProgressPct", () => {
  it("returns 0 when the track is absent from the projection", () => {
    expect(findTrackProgressPct(progress([]), "pcert-t01")).toBe(0);
  });
  it("returns the pct value the server projected", () => {
    const p = progress([{ module_id: "pcert-t02", pct: 42, lessons: [] }]);
    expect(findTrackProgressPct(p, "pcert-t02")).toBe(42);
  });
});

// ─── isPrerequisiteUnlocked ────────────────────────────────────────────────

describe("isPrerequisiteUnlocked", () => {
  const l01: CertifiedLesson = lesson({ id: "pcert-l01", prerequisite_lesson_id: null });
  const l02: CertifiedLesson = lesson({ id: "pcert-l02", prerequisite_lesson_id: "pcert-l01" });

  it("lessons with no prerequisite are always unlocked", () => {
    expect(isPrerequisiteUnlocked(progress([]), l01)).toBe(true);
  });

  it("locks a lesson when its direct prereq has no progress row", () => {
    expect(isPrerequisiteUnlocked(progress([]), l02)).toBe(false);
  });

  it("locks a lesson when its direct prereq is in_progress", () => {
    const p = progress([
      {
        module_id: "pcert-t01",
        lessons: [lessonProgress({ lesson_id: "pcert-l01", status: "in_progress" })],
      },
    ]);
    expect(isPrerequisiteUnlocked(p, l02)).toBe(false);
  });

  it("locks a lesson when its direct prereq is awaiting_quiz / needs_retake / failed", () => {
    for (const status of ["awaiting_quiz", "needs_retake", "failed_assessment"] as const) {
      const p = progress([
        {
          module_id: "pcert-t01",
          lessons: [lessonProgress({ lesson_id: "pcert-l01", status })],
        },
      ]);
      expect(isPrerequisiteUnlocked(p, l02)).toBe(false);
    }
  });

  it("unlocks a lesson when its direct prereq is completed", () => {
    const p = progress([
      {
        module_id: "pcert-t01",
        lessons: [lessonProgress({ lesson_id: "pcert-l01", status: "completed" })],
      },
    ]);
    expect(isPrerequisiteUnlocked(p, l02)).toBe(true);
  });
});

// ─── lessonStatusLabel ─────────────────────────────────────────────────────

describe("lessonStatusLabel", () => {
  it("maps each server LessonStatus to a stable copy string", () => {
    const cases: Array<[LessonStatus | "not_started", string]> = [
      ["not_started", "Not started"],
      ["in_progress", "In progress"],
      ["awaiting_quiz", "Ready for quiz"],
      ["needs_retake", "Retake required"],
      ["failed_assessment", "Assessment not passed"],
      ["completed", "Completed"],
    ];
    for (const [status, label] of cases) {
      expect(lessonStatusLabel(status)).toBe(label);
    }
  });
});

// ─── prereqDisplayLabel ────────────────────────────────────────────────────

describe("prereqDisplayLabel", () => {
  it("returns the title from the catalog for a known prereq id", () => {
    const cat = catalog([lesson({ id: "pcert-l01", title: "Welcome to the HartFelt Platform" })]);
    expect(prereqDisplayLabel(cat, "pcert-l01")).toBe(
      "Welcome to the HartFelt Platform",
    );
  });

  it("falls back to the id when the prereq is unknown", () => {
    const cat = catalog([]);
    expect(prereqDisplayLabel(cat, "pcert-l99")).toBe("pcert-l99");
  });
});
