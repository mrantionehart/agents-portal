// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Quiz page client (Gate C)
// ============================================================================
// Fetches the learner-safe quiz projection, renders questions + options,
// submits attempts. Server is the sole authority for correctness. The client
// never receives or infers a `correctOptionId`; it forwards the learner's
// choice map + the quizId/version to Vault, which grades and persists.
//
// Special case: pcert-l32 is the final exam. On a passing attempt the
// response envelope carries `certification_issuance` (issuance_id +
// certification_id + version + issued_at). We render that as an issuance
// success block; issuance rows come from the writer (`issuePlatformCertification`)
// server-side — the AP never writes certification.
// ============================================================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  CertApiError,
  fetchCatalog,
  fetchLearnerSafeQuiz,
  submitQuizAttempt,
} from "@/src/portal/training/certified/api";
import type {
  CertifiedCatalog,
  CertifiedLesson,
  LearnerSafeQuiz,
  QuizAttemptResponse,
} from "../types";
import { FINAL_EXAM_LESSON_ID } from "../types";

type PhaseState =
  | { kind: "loading" }
  | { kind: "invalid_params"; message: string }
  | { kind: "error"; message: string; code?: string | null; retry?: () => void }
  | {
      kind: "ready";
      quiz: LearnerSafeQuiz;
      lesson: CertifiedLesson;
      trackId: string | null;
      lessonId: string;
    }
  | {
      kind: "submitted";
      result: QuizAttemptResponse;
      lesson: CertifiedLesson;
      trackId: string | null;
      quiz: LearnerSafeQuiz;
      lessonId: string;
    };

function findLesson(
  catalog: CertifiedCatalog,
  lessonId: string,
): { lesson: CertifiedLesson; trackId: string } | null {
  for (const track of catalog.tracks) {
    for (const lesson of track.lessons) {
      if (lesson.id === lessonId) return { lesson, trackId: track.id };
    }
  }
  return null;
}

export default function QuizPageClient() {
  const search = useSearchParams();
  const [phase, setPhase] = useState<PhaseState>({ kind: "loading" });

  const bootstrap = useCallback(async () => {
    const lessonId = search?.get("lesson") ?? "";
    if (!lessonId) {
      setPhase({
        kind: "invalid_params",
        message: "This link is missing a lesson id.",
      });
      return;
    }
    try {
      const [catalog, quizRes] = await Promise.all([
        fetchCatalog(),
        fetchLearnerSafeQuiz({ lessonId }),
      ]);
      const brief = findLesson(catalog, lessonId);
      if (!brief) {
        setPhase({
          kind: "error",
          message: `Lesson ${lessonId} not found in the catalog.`,
        });
        return;
      }
      setPhase({
        kind: "ready",
        quiz: quizRes.quiz,
        lesson: brief.lesson,
        trackId: brief.trackId,
        lessonId,
      });
    } catch (e) {
      const msg =
        e instanceof CertApiError
          ? `${e.message}${e.code ? ` (${e.code})` : ""}`
          : e instanceof Error
          ? e.message
          : "Failed to load quiz.";
      const code = e instanceof CertApiError ? e.code : null;
      setPhase({ kind: "error", message: msg, code, retry: () => void bootstrap() });
    }
  }, [search]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (phase.kind === "loading")
    return (
      <div className="max-w-[640px] mx-auto py-16 text-center text-sm text-[#71717A]">
        Loading quiz…
      </div>
    );
  if (phase.kind === "invalid_params")
    return (
      <FullPageMessage
        title="Missing parameters"
        message={phase.message}
        homeHref="/training"
      />
    );
  if (phase.kind === "error")
    return <ErrorPanel phase={phase} homeHref="/training" />;

  if (phase.kind === "submitted")
    return (
      <SubmittedView
        phase={phase}
        onRetake={() =>
          setPhase({
            kind: "ready",
            quiz: phase.quiz,
            lesson: phase.lesson,
            trackId: phase.trackId,
            lessonId: phase.lessonId,
          })
        }
      />
    );

  return (
    <ActiveQuiz
      phase={phase}
      onSubmitted={(result) =>
        setPhase({
          kind: "submitted",
          result,
          lesson: phase.lesson,
          trackId: phase.trackId,
          quiz: phase.quiz,
          lessonId: phase.lessonId,
        })
      }
    />
  );
}


// ── Contract validation ─────────────────────────────────────────────────────
// Returns a learner-readable reason when Vault's payload cannot support a real
// attempt, or null when it can. This is the guard that would have caught the
// AP/Vault drift immediately instead of at submit time.
export function describeQuizContractProblem(
  quiz: LearnerSafeQuiz | null | undefined,
): string | null {
  if (!quiz) return "the quiz could not be loaded.";
  if (!quiz.quizId) return "it is missing its quiz identifier.";
  if (!quiz.quizVersion) return "it is missing its quiz version.";
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return "it has no questions.";
  }
  if (
    !quiz.passingRule ||
    typeof quiz.passingRule.thresholdPercent !== "number"
  ) {
    return "its passing score is missing.";
  }
  if (!quiz.retryPolicy || typeof quiz.retryPolicy.maxAttempts !== "number") {
    return "its attempt policy is missing.";
  }
  for (const q of quiz.questions) {
    if (!q.id || !Array.isArray(q.options) || q.options.length === 0) {
      return "one of its questions has no answer options.";
    }
    if (q.options.some((o) => !o.id || typeof o.label !== "string")) {
      return "one of its answer options is missing its text.";
    }
  }
  return null;
}

// ─── Active quiz UI ────────────────────────────────────────────────────────

function ActiveQuiz({
  phase,
  onSubmitted,
}: {
  phase: Extract<PhaseState, { kind: "ready" }>;
  onSubmitted: (r: QuizAttemptResponse) => void;
}) {
  const { quiz, lesson, trackId, lessonId } = phase;

  // ── FAIL CLOSED ON AN INCOMPLETE PAYLOAD ────────────────────────────────
  // Do not let a learner answer ten questions and only discover at submit
  // that the quiz had no identity. If Vault's learner-safe payload is
  // structurally incomplete, this surface refuses to start.
  const contractProblem = describeQuizContractProblem(quiz);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string | null } | null>(null);

  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  if (contractProblem) {
    return (
      <div className="space-y-4" data-cert-quiz-unavailable>
        <div className="text-[11px] uppercase tracking-wide text-[#C9A84C]">
          {lesson.id}
        </div>
        <div
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-5"
          role="alert"
        >
          <div className="text-[11px] uppercase tracking-wide">
            Quiz unavailable
          </div>
          <p className="mt-2 text-sm text-[#F1F1F3]">
            This quiz can&apos;t be started right now — {contractProblem}
          </p>
          <p className="mt-2 text-xs text-[#A1A1AA]">
            Nothing has been recorded against your certification. Please try
            again, or contact support if it keeps happening.
          </p>
        </div>
        <Link
          href={`/training/certified/${trackId}/${lessonId}`}
          className="inline-block text-sm text-[#C9A84C] hover:underline"
        >
          ← Back to lesson
        </Link>
      </div>
    );
  }

  const submit = useCallback(async () => {
    if (!allAnswered) return;
    setBusy(true);
    setError(null);
    try {
      // Vault's attempt route validates snake_case identity and an answers
      // OBJECT keyed questionId → optionId. Sending camelCase / an array is
      // what produced "quiz_id required" for every submission.
      const submission = {
        quiz_id: quiz.quizId,
        quiz_version: quiz.quizVersion,
        answers: Object.fromEntries(
          quiz.questions.map((q) => [q.id, answers[q.id]]),
        ),
      };
      const result = await submitQuizAttempt({ lessonId, submission });
      onSubmitted(result);
    } catch (e) {
      if (e instanceof CertApiError) {
        const friendly =
          e.code === "attempt_cap_reached"
            ? "You've used all attempts for this quiz."
            : e.code === "prerequisite_not_complete"
            ? "Complete the prerequisite lesson first."
            : e.message;
        setError({ message: friendly, code: e.code });
      } else if (e instanceof Error) {
        setError({ message: e.message });
      } else {
        setError({ message: "Submission failed." });
      }
    } finally {
      setBusy(false);
    }
  }, [allAnswered, quiz.quizId, quiz.quizVersion, quiz.questions, answers, lessonId, onSubmitted]);

  const backHref = trackId
    ? `/training/certified/${trackId}/${lesson.id}`
    : "/training";

  return (
    <div className="max-w-[720px] mx-auto space-y-6" data-cert-quiz-active>
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="text-xs text-[#71717A] hover:text-[#F1F1F3]"
        >
          ← Back to lesson
        </Link>
        {lesson.id === FINAL_EXAM_LESSON_ID && (
          <span className="rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#C9A84C]">
            Final Exam
          </span>
        )}
      </div>
      <header>
        <div className="text-[11px] uppercase tracking-wide text-[#C9A84C]">
          {lesson.id}
        </div>
        <h1 className="mt-1 text-xl font-semibold text-[#F1F1F3]">
          {quiz.title}
        </h1>
        <p className="mt-1 text-xs text-[#A1A1AA]">
          Passing score: {quiz.passingRule.thresholdPercent}% ·{" "}
          {quiz.questions.length} questions · Attempt limit:{" "}
          {quiz.retryPolicy.maxAttempts}
        </p>
      </header>
      <ol className="space-y-4" data-cert-quiz-questions>
        {quiz.questions.map((q, idx) => (
          <li
            key={q.id}
            className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-4"
            data-cert-quiz-question={q.id}
          >
            <div className="text-[11px] uppercase tracking-wide text-[#71717A]">
              Question {idx + 1}
            </div>
            <div className="mt-1 text-sm font-medium text-[#F1F1F3]">
              {q.prompt}
            </div>
            <ul className="mt-3 space-y-2">
              {q.options.map((opt) => (
                <li key={opt.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded border border-[#1a1a2e] bg-[#050507] p-2 hover:border-[#252538]">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt.id}
                      checked={answers[q.id] === opt.id}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                      }
                      disabled={busy}
                      className="mt-1 h-4 w-4 accent-[#C9A84C]"
                      data-cert-quiz-option={opt.id}
                    />
                    <span className="text-sm text-[#F1F1F3]">{opt.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {error && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200" role="alert">
          {error.message}
          {error.code && (
            <span className="ml-2 text-rose-300/70">({error.code})</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !allAnswered}
          className="rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f] disabled:cursor-not-allowed disabled:opacity-60"
          data-cert-quiz-submit
        >
          {busy ? "Submitting…" : "Submit quiz"}
        </button>
      </div>
    </div>
  );
}

// ─── Submitted result view ─────────────────────────────────────────────────

function SubmittedView({
  phase,
  onRetake,
}: {
  phase: Extract<PhaseState, { kind: "submitted" }>;
  onRetake: () => void;
}) {
  const { result, lesson, trackId, lessonId } = phase;
  const { result: r, certification_issuance } = result;
  const backHref = trackId
    ? `/training/certified/${trackId}/${lesson.id}`
    : "/training";
  const isFinalPass =
    lessonId === FINAL_EXAM_LESSON_ID && r.passed && certification_issuance;

  return (
    <div className="max-w-[640px] mx-auto space-y-5" data-cert-quiz-submitted>
      <div>
        <Link
          href={backHref}
          className="text-xs text-[#71717A] hover:text-[#F1F1F3]"
        >
          ← Back to lesson
        </Link>
      </div>
      {/* Tri-state. `review_required` is NOT a pass — Vault keeps `passed`
          false — but reporting it as a failure misstates both the result and
          the learner's next step, so it renders as its own state. Nothing here
          discloses which item triggered review. */}
      <div
        className={`rounded-lg border p-5 ${
          r.passed
            ? "border-green-500/30 bg-green-500/10"
            : r.outcome === "review_required"
              ? "border-sky-500/30 bg-sky-500/10"
              : "border-amber-500/30 bg-amber-500/10"
        }`}
        data-cert-quiz-result={
          r.passed ? "passed" : r.outcome === "review_required" ? "review_required" : "failed"
        }
      >
        <div className="text-[11px] uppercase tracking-wide">
          {r.passed
            ? "✅ Quiz passed"
            : r.outcome === "review_required"
              ? "🔎 Additional review required"
              : "❌ Quiz not passed"}
        </div>
        <div className="mt-1 text-2xl font-semibold text-[#F1F1F3]">
          {r.scorePercent}%
        </div>
        <p className="mt-1 text-xs text-[#A1A1AA]">
          {r.correctCount} of {r.totalCount} correct · attempt {r.attemptNumber}
          {r.attemptsRemaining > 0
            ? ` · ${r.attemptsRemaining} attempt${r.attemptsRemaining === 1 ? "" : "s"} remaining`
            : " · no attempts remaining"}
        </p>
        {r.outcome === "review_required" && (
          <p className="mt-2 text-xs text-[#A1A1AA]">
            Your score met the threshold. A compliance response is being reviewed
            with your supervisor before this lesson is marked complete.
          </p>
        )}
      </div>

      {isFinalPass && certification_issuance && (
        <div
          className="rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 p-5"
          data-cert-issuance-block
        >
          <div className="text-[11px] uppercase tracking-wide text-[#C9A84C]">
            🏁 Certification issued
          </div>
          <h2 className="mt-1 text-lg font-semibold text-[#F1F1F3]">
            HartFelt Platform Certified
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[#71717A]">Issuance id</dt>
              <dd className="mt-0.5 break-all font-mono text-[#F1F1F3]">
                {certification_issuance.issuance_id}
              </dd>
            </div>
            <div>
              <dt className="text-[#71717A]">Version</dt>
              <dd className="mt-0.5 text-[#F1F1F3]">
                {certification_issuance.certification_version}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[#71717A]">Issued at</dt>
              <dd className="mt-0.5 text-[#F1F1F3]">
                {new Date(certification_issuance.issued_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!r.passed && r.outcome !== "review_required" && r.attemptsRemaining > 0 && (
          <button
            type="button"
            onClick={onRetake}
            className="rounded border border-[#C9A84C]/60 bg-[#C9A84C]/10 px-4 py-2 text-sm font-medium text-[#C9A84C] hover:bg-[#C9A84C]/20"
          >
            Retake quiz
          </button>
        )}
        <Link
          href={backHref}
          className="rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f]"
        >
          Return to lesson
        </Link>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ErrorPanel({
  phase,
  homeHref,
}: {
  phase: Extract<PhaseState, { kind: "error" }>;
  homeHref: string;
}) {
  return (
    <div className="max-w-[640px] mx-auto space-y-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-5">
      <p className="text-sm text-rose-200">{phase.message}</p>
      {phase.code && (
        <p className="text-[11px] text-rose-300/70">Code: {phase.code}</p>
      )}
      {phase.retry && (
        <button
          type="button"
          onClick={phase.retry}
          className="rounded border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30"
        >
          Retry
        </button>
      )}
      <Link href={homeHref} className="inline-block text-xs text-rose-100/70 underline">
        Back to Training
      </Link>
    </div>
  );
}

function FullPageMessage({
  title,
  message,
  homeHref,
}: {
  title: string;
  message: string;
  homeHref: string;
}) {
  return (
    <div className="max-w-[560px] mx-auto py-20 text-center">
      <h1 className="text-lg font-semibold text-[#F1F1F3]">{title}</h1>
      <p className="mt-2 text-sm text-[#A1A1AA]">{message}</p>
      <Link
        href={homeHref}
        className="mt-6 inline-block rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f]"
      >
        Continue
      </Link>
    </div>
  );
}
