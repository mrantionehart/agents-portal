// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Unified lesson page dispatcher
// ============================================================================
// Reads Vault's catalog + progress for the current caller, finds the lesson,
// checks the prerequisite, and renders one activity block per entry in
// `lesson.requirements`. Every completion state comes from Vault — the AP
// does not compute completion locally.
//
// Requirement → renderer map:
//   "tour"      → LearnerTourLauncher (reuses TourProvider)
//   "practical" → FamilyAGuidanceCard (Family A signals, pcert-l03)
//                 | WizardLaunchLink (transaction_wizard, pcert-l04)
//                 | ChecklistLauncher (scenario, 14 lessons — Gate B)
//   "quiz"      → QuizLauncher (Gate C)
//
// Unrecognized requirement kinds render a fail-closed notice instead of
// silently omitting the block.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/app/providers";

import { CertApiError, fetchCatalog, fetchProgress } from "./api";
import type {
  CertifiedCatalog,
  CertifiedLesson,
  CertifiedProgress,
  LessonProgress,
  LessonRequirementKind,
} from "./types";
import {
  findLessonProgress,
  isPrerequisiteUnlocked,
  lessonStatusLabel,
  prereqDisplayLabel,
} from "./progress-helpers";
import LearnerTourLauncher from "./activities/LearnerTourLauncher";
import FamilyAGuidanceCard from "./activities/FamilyAGuidanceCard";
import WizardLaunchLink from "./activities/WizardLaunchLink";
import ChecklistLauncher from "./activities/ChecklistLauncher";
import QuizLauncher from "./activities/QuizLauncher";

interface UnifiedLessonClientProps {
  trackId: string;
  lessonId: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found"; message: string }
  | { kind: "error"; message: string; retry: () => void }
  | {
      kind: "loaded";
      catalog: CertifiedCatalog;
      progress: CertifiedProgress;
      lesson: CertifiedLesson;
    };

export default function UnifiedLessonClient({
  trackId,
  lessonId,
}: UnifiedLessonClientProps) {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [catalog, progress] = await Promise.all([
        fetchCatalog(),
        fetchProgress(),
      ]);
      const track = catalog.tracks.find((t) => t.id === trackId);
      if (!track) {
        setState({ kind: "not_found", message: `Unknown track: ${trackId}` });
        return;
      }
      const lesson = track.lessons.find((l) => l.id === lessonId);
      if (!lesson) {
        setState({ kind: "not_found", message: `Unknown lesson: ${lessonId}` });
        return;
      }
      setState({ kind: "loaded", catalog, progress, lesson });
    } catch (e) {
      const msg =
        e instanceof CertApiError
          ? `${e.message} (HTTP ${e.status})`
          : e instanceof Error
          ? e.message
          : "Failed to load lesson.";
      setState({ kind: "error", message: msg, retry: () => void load() });
    }
  }, [trackId, lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") return <Loading />;
  if (state.kind === "not_found")
    return <NotFound message={state.message} trackId={trackId} />;
  if (state.kind === "error")
    return <ErrorPanel message={state.message} onRetry={state.retry} />;

  const { catalog, progress, lesson } = state;
  const lessonProgress = findLessonProgress(progress, lessonId);
  const unlocked = isPrerequisiteUnlocked(progress, lesson);
  const displayStatus = lessonStatusLabel(lessonProgress?.status ?? "not_started");

  return (
    <div className="max-w-[720px] mx-auto space-y-6">
      <div>
        <Link
          href={`/training/certified/${encodeURIComponent(trackId)}`}
          className="text-xs text-[#71717A] hover:text-[#F1F1F3]"
        >
          ← Back to track
        </Link>
      </div>

      <header>
        <div className="text-[11px] uppercase tracking-wide text-[#C9A84C]">
          {lesson.id}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-[#F1F1F3]">
          {lesson.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge label={displayStatus} />
          {lesson.requirements.map((r) => (
            <RequirementBadge key={r} kind={r} />
          ))}
          <span className="text-[#71717A]">system: {lesson.system}</span>
        </div>
        {lesson.objective_md && (
          <p className="mt-4 whitespace-pre-line text-sm text-[#A1A1AA]">
            {lesson.objective_md}
          </p>
        )}
      </header>

      {!unlocked && lesson.prerequisite_lesson_id && (
        <PrereqLocked
          prereqTitle={prereqDisplayLabel(catalog, lesson.prerequisite_lesson_id)}
          prereqId={lesson.prerequisite_lesson_id}
        />
      )}

      {unlocked && (
        <RequirementDispatcher
          lesson={lesson}
          lessonProgress={lessonProgress}
          userId={user?.id ?? null}
          onProgressChange={load}
        />
      )}
    </div>
  );
}

// ─── Requirement dispatcher ────────────────────────────────────────────────

function RequirementDispatcher({
  lesson,
  lessonProgress,
  userId,
  onProgressChange,
}: {
  lesson: CertifiedLesson;
  lessonProgress: LessonProgress | null;
  userId: string | null;
  onProgressChange: () => void;
}) {
  if (lesson.requirements.length === 0) {
    return (
      <section className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
        This lesson has no completable requirements configured yet. Please
        check back later.
      </section>
    );
  }
  const status = lessonProgress?.status ?? "not_started";
  // PILOT-D-009: consume Vault's kind-scoped attestation timestamps
  // (`tour_attested_at`, `practical_attested_at`) instead of the legacy
  // scalar `attested_at`. The scalar has always been driven by a Vault-
  // side `completionMode` ternary and — for V4 requirements-only lessons
  // (pcert-l04, l05, l11-l32) — falls back to the practical row's
  // timestamp, which this client historically misread as tour signal.
  //
  // Fail-closed rule: `undefined` (older Vault response without the new
  // fields) is treated as "not attested." Non-null string → attested.
  // This client never infers a kind-specific signal from the legacy
  // scalar; a stale Vault deployment yields "still needs to walk / do"
  // rather than falsely surfacing "completed."
  const tourAlreadyAttested =
    lessonProgress?.tour_attested_at !== null &&
    lessonProgress?.tour_attested_at !== undefined;
  const practicalAlreadyAttested =
    lessonProgress?.practical_attested_at !== null &&
    lessonProgress?.practical_attested_at !== undefined;
  const quizAlreadyPassed = lessonProgress?.quiz_passed === true;
  const overallCompleted = status === "completed";

  return (
    <div className="space-y-4" data-cert-requirement-blocks>
      {lesson.requirements.map((kind) => (
        <div key={kind} data-cert-requirement-kind={kind}>
          {renderRequirement({
            kind,
            lesson,
            userId,
            overallCompleted,
            tourAlreadyAttested,
            practicalAlreadyAttested,
            quizAlreadyPassed,
            onProgressChange,
          })}
        </div>
      ))}
    </div>
  );
}

function renderRequirement(args: {
  kind: LessonRequirementKind;
  lesson: CertifiedLesson;
  userId: string | null;
  overallCompleted: boolean;
  tourAlreadyAttested: boolean;
  practicalAlreadyAttested: boolean;
  quizAlreadyPassed: boolean;
  onProgressChange: () => void;
}) {
  const { kind, lesson, userId, overallCompleted, tourAlreadyAttested, practicalAlreadyAttested, quizAlreadyPassed, onProgressChange } = args;
  switch (kind) {
    case "tour":
      return (
        <div className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-5">
          <h3 className="text-sm font-semibold text-[#F1F1F3]">
            Guided tour
          </h3>
          <p className="mt-1 text-xs text-[#A1A1AA]">
            Follow the on-screen tour. Progress is saved automatically —
            you can resume where you left off.
          </p>
          <div className="mt-4">
            <LearnerTourLauncher
              lessonId={lesson.id}
              userId={userId}
              alreadyCompleted={overallCompleted || tourAlreadyAttested}
              onCompletion={onProgressChange}
            />
          </div>
        </div>
      );
    case "practical":
      // PILOT-D-009: practical block's `alreadyCompleted` prop is now
      // driven by BOTH the overall lesson status AND the kind-scoped
      // `practical_attested_at` signal. This lets a practical-satisfied-
      // but-tour-pending lesson (e.g. pcert-l04 mid-flow) render the
      // practical block as done independently of the tour block.
      if (lesson.practical_ui_spec !== null) {
        return (
          <FamilyAGuidanceCard
            lessonId={lesson.id}
            spec={lesson.practical_ui_spec}
            onVerified={onProgressChange}
            alreadyCompleted={overallCompleted || practicalAlreadyAttested}
          />
        );
      }
      if (lesson.session_ui_spec !== null) {
        if (lesson.session_ui_spec.activity_type === "transaction_wizard") {
          return (
            <WizardLaunchLink
              lessonId={lesson.id}
              spec={lesson.session_ui_spec}
              alreadyCompleted={overallCompleted || practicalAlreadyAttested}
            />
          );
        }
        if (lesson.session_ui_spec.activity_type === "scenario") {
          return (
            <ChecklistLauncher
              lessonId={lesson.id}
              spec={lesson.session_ui_spec}
              alreadyCompleted={overallCompleted || practicalAlreadyAttested}
            />
          );
        }
      }
      return (
        <section className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          This lesson&apos;s practical activity is not yet supported by the
          learner UI.
        </section>
      );
    case "quiz":
      return (
        <QuizLauncher lessonId={lesson.id} alreadyPassed={overallCompleted || quizAlreadyPassed} />
      );
    default: {
      const unknown: never = kind;
      void unknown;
      return (
        <section className="rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Unsupported requirement kind: {String(kind)}.
        </section>
      );
    }
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="max-w-[720px] mx-auto py-16 text-center text-sm text-[#71717A]">
      Loading lesson…
    </div>
  );
}

function NotFound({ message, trackId }: { message: string; trackId: string }) {
  return (
    <div className="max-w-[720px] mx-auto space-y-4">
      <Link
        href={`/training/certified/${encodeURIComponent(trackId)}`}
        className="text-xs text-[#71717A] hover:text-[#F1F1F3]"
      >
        ← Back to track
      </Link>
      <div className="rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {message}
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="max-w-[720px] mx-auto rounded border border-rose-500/30 bg-rose-500/10 p-5">
      <p className="text-sm text-rose-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30"
      >
        Retry
      </button>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const isDone = label === "Completed";
  const cls = isDone
    ? "border-green-500/30 bg-green-500/10 text-green-300"
    : "border-[#252538] bg-[#11111a] text-[#A1A1AA]";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] ${cls}`}
      data-cert-status-badge={label}
    >
      {label}
    </span>
  );
}

function RequirementBadge({ kind }: { kind: LessonRequirementKind }) {
  const copy =
    kind === "tour" ? "Tour" : kind === "practical" ? "Practical" : "Quiz";
  return (
    <span
      className="inline-flex items-center rounded border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-2 py-0.5 text-[11px] text-[#C9A84C]"
      data-cert-requirement-badge={kind}
    >
      {copy}
    </span>
  );
}

function PrereqLocked({
  prereqTitle,
  prereqId,
}: {
  prereqTitle: string;
  prereqId: string;
}) {
  return (
    <section
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5"
      data-cert-prereq-locked
    >
      <h3 className="text-sm font-semibold text-amber-200">Locked</h3>
      <p className="mt-1 text-xs text-amber-100">
        Finish <strong className="font-semibold">{prereqTitle}</strong>{" "}
        (<code className="text-[10px]">{prereqId}</code>) to unlock this lesson.
      </p>
    </section>
  );
}
