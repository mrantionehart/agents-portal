// ============================================================================
// Matrix Simulator — Knowledge Quiz (Agent Portal)
// ============================================================================
// The 20-question written knowledge check that gates (with the broker-approved
// practical) Matrix Rental certification issuance. Presentation only — it reuses
// the existing certified quiz API layer (`fetchLearnerSafeQuiz` /
// `submitQuizAttempt`), the learner-safe contract validator
// (`describeQuizContractProblem`) and the shared Vault quiz types, so the server
// stays the sole authority for correctness and NO answer key is ever present in
// the payload or the DOM. Deliberately does NOT modify the HartFelt Ready
// `QuizPageClient`; it targets the Matrix certification explicitly.
//
// Access requires a LIVE Matrix assignment — enforced by Vault (the lesson-quiz
// route 404s an un-assigned caller); this surface renders that as a friendly
// "no access" state. Dark by default behind `matrixSimulatorEnabled()`.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, GraduationCap, CheckCircle2, XCircle, AlertTriangle, Search } from "lucide-react";

import {
  fetchLearnerSafeQuiz,
  submitQuizAttempt,
  CertApiError,
} from "@/src/portal/training/certified/api";
import { describeQuizContractProblem } from "@/src/portal/training/certified/quiz/QuizPageClient";
import type { LearnerSafeQuiz, QuizAttemptResponse } from "@/src/portal/training/certified/types";
import { matrixSimulatorEnabled } from "../_lib/matrix-flags";

// Stable public certification + lesson ids (Vault is the source of truth).
export const MATRIX_CERTIFICATION_ID = "hartfelt-matrix-rental-practical";
export const MATRIX_KNOWLEDGE_LESSON_ID = "mr-l0101";

const CARD = "rounded-lg border border-[#13231a] bg-[#0b0f0c]";

type Phase =
  | { kind: "loading" }
  | { kind: "no_access" }
  | { kind: "unavailable"; reason: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; quiz: LearnerSafeQuiz }
  | { kind: "submitted"; quiz: LearnerSafeQuiz; result: QuizAttemptResponse };

export function MatrixKnowledgeQuiz() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const res = await fetchLearnerSafeQuiz({
        certificationId: MATRIX_CERTIFICATION_ID,
        lessonId: MATRIX_KNOWLEDGE_LESSON_ID,
      });
      const problem = describeQuizContractProblem(res.quiz);
      if (problem) {
        setPhase({ kind: "unavailable", reason: problem });
        return;
      }
      setAnswers({});
      setPhase({ kind: "ready", quiz: res.quiz });
    } catch (e) {
      // Vault returns a uniform 404 for an un-assigned caller (and for a dark
      // module). Treat it as "no access" rather than a system error.
      if (e instanceof CertApiError && e.status === 404) {
        setPhase({ kind: "no_access" });
        return;
      }
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "The quiz could not be loaded.",
      });
    }
  }, []);

  useEffect(() => {
    if (!matrixSimulatorEnabled()) return;
    void load();
  }, [load]);

  const submit = useCallback(
    async (quiz: LearnerSafeQuiz) => {
      if (!quiz.questions.every((q) => answers[q.id])) return;
      setBusy(true);
      setSubmitError(null);
      try {
        const submission = {
          quiz_id: quiz.quizId,
          quiz_version: quiz.quizVersion,
          answers: Object.fromEntries(quiz.questions.map((q) => [q.id, answers[q.id]])),
        };
        const result = await submitQuizAttempt({
          certificationId: MATRIX_CERTIFICATION_ID,
          lessonId: MATRIX_KNOWLEDGE_LESSON_ID,
          submission,
        });
        setPhase({ kind: "submitted", quiz, result });
      } catch (e) {
        const msg =
          e instanceof CertApiError && e.code === "attempt_cap_reached"
            ? "You've used all attempts for this quiz."
            : e instanceof Error
              ? e.message
              : "Submission failed.";
        setSubmitError(msg);
      } finally {
        setBusy(false);
      }
    },
    [answers],
  );

  if (!matrixSimulatorEnabled()) {
    return (
      <div className={`${CARD} p-6`} data-matrix-quiz-disabled>
        <h2 className="text-base font-semibold text-[#E6F5EC]">Matrix Knowledge Quiz</h2>
        <p className="mt-2 text-sm text-[#9db3a6]">Coming soon — the written knowledge check.</p>
      </div>
    );
  }

  if (phase.kind === "loading") {
    return (
      <div className={`${CARD} flex items-center gap-3 p-6`} data-matrix-quiz-loading>
        <Loader2 className="h-5 w-5 animate-spin text-[#22c55e]" aria-hidden="true" />
        <p className="text-sm text-[#9db3a6]">Loading the knowledge quiz…</p>
      </div>
    );
  }

  if (phase.kind === "no_access") {
    return (
      <div className={`${CARD} p-6`} role="alert" data-matrix-quiz-no-access>
        <h2 className="text-base font-semibold text-[#E6F5EC]">Not assigned</h2>
        <p className="mt-2 text-sm text-[#9db3a6]">
          You don&apos;t have access to the Matrix knowledge quiz. It&apos;s available only to agents
          assigned the Matrix Rental certification. If it was recently assigned, sign out and back in,
          or contact your broker.
        </p>
      </div>
    );
  }

  if (phase.kind === "unavailable") {
    return (
      <div className={`${CARD} p-6`} role="alert" data-matrix-quiz-unavailable>
        <h2 className="text-base font-semibold text-[#E6F5EC]">Quiz unavailable</h2>
        <p className="mt-2 text-sm text-[#9db3a6]">
          This quiz can&apos;t be started right now — {phase.reason} Nothing has been recorded against
          your certification.
        </p>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className={`${CARD} p-6`} role="alert" data-matrix-quiz-error>
        <h2 className="text-base font-semibold text-[#E6F5EC]">Something went wrong</h2>
        <p className="mt-2 text-sm text-[#9db3a6]">{phase.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#04120a] hover:bg-[#16a34a]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase.kind === "submitted") {
    return <ResultView quiz={phase.quiz} result={phase.result} onRetake={() => void load()} />;
  }

  // ready
  const { quiz } = phase;
  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  return (
    <div className="space-y-6" data-matrix-quiz-active>
      <header className={`${CARD} p-5`}>
        <div className="flex items-center gap-2 text-[#4ade80]">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-wide">Knowledge Quiz</span>
        </div>
        <h2 className="mt-1 text-lg font-semibold text-[#E6F5EC]">{quiz.title}</h2>
        <p className="mt-1 text-xs text-[#9db3a6]">
          Passing score: {quiz.passingRule.thresholdPercent}% · {quiz.questions.length} questions ·
          Attempt limit: {quiz.retryPolicy.maxAttempts}
        </p>
        <p className="mt-1 text-xs text-[#6b8577]">
          A single critical-field error fails the attempt regardless of your overall score.
        </p>
      </header>

      <ol className="space-y-4" data-matrix-quiz-questions>
        {quiz.questions.map((q, idx) => (
          <li key={q.id} className={`${CARD} p-4`} data-matrix-quiz-question={q.id}>
            <div className="text-[11px] uppercase tracking-wide text-[#6b8577]">Question {idx + 1}</div>
            <div className="mt-1 text-sm font-medium text-[#E6F5EC]">{q.prompt}</div>
            <ul className="mt-3 space-y-2">
              {q.options.map((opt) => (
                <li key={opt.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded border border-[#13231a] bg-[#070b08] p-2 hover:border-[#22c55e]/40">
                    <input
                      type="radio"
                      name={`mq-${q.id}`}
                      value={opt.id}
                      checked={answers[q.id] === opt.id}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                      disabled={busy}
                      className="mt-1 h-4 w-4 accent-[#22c55e]"
                      data-matrix-quiz-option={opt.id}
                    />
                    <span className="text-sm text-[#E6F5EC]">{opt.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {submitError && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200" role="alert">
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[#6b8577]">
          {quiz.questions.filter((q) => answers[q.id]).length}/{quiz.questions.length} answered
        </span>
        <button
          type="button"
          onClick={() => void submit(quiz)}
          disabled={busy || !allAnswered}
          className="rounded bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#04120a] hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
          data-matrix-quiz-submit
        >
          {busy ? "Submitting…" : "Submit quiz"}
        </button>
      </div>
    </div>
  );
}

function ResultView({
  quiz,
  result,
  onRetake,
}: {
  quiz: LearnerSafeQuiz;
  result: QuizAttemptResponse;
  onRetake: () => void;
}) {
  const r = result.result;
  const issuance = result.certification_issuance;
  const reviewRequired = r.outcome === "review_required";
  // Critical-error feedback WITHOUT disclosing which item or the answer key:
  // a non-pass at or above the score threshold can only be a critical miss.
  const criticalMiss = !r.passed && !reviewRequired && r.scorePercent >= quiz.passingRule.thresholdPercent;
  const canRetake = !r.passed && !reviewRequired && r.attemptsRemaining > 0;

  const tone = r.passed
    ? "border-green-500/30 bg-green-500/10"
    : reviewRequired
      ? "border-sky-500/30 bg-sky-500/10"
      : "border-amber-500/30 bg-amber-500/10";

  return (
    <div className="space-y-5" data-matrix-quiz-submitted>
      <div
        className={`rounded-lg border p-5 ${tone}`}
        data-matrix-quiz-result={r.passed ? "passed" : reviewRequired ? "review_required" : "failed"}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#E6F5EC]">
          {r.passed ? (
            <CheckCircle2 className="h-4 w-4 text-[#4ade80]" aria-hidden="true" />
          ) : reviewRequired ? (
            <Search className="h-4 w-4 text-sky-300" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4 text-amber-300" aria-hidden="true" />
          )}
          {r.passed ? "Quiz passed" : reviewRequired ? "Additional review required" : "Quiz not passed"}
        </div>
        <div className="mt-1 text-2xl font-semibold text-[#E6F5EC]">{r.scorePercent}%</div>
        <p className="mt-1 text-xs text-[#9db3a6]">
          {r.correctCount} of {r.totalCount} correct · attempt {r.attemptNumber}
          {r.attemptsRemaining > 0
            ? ` · ${r.attemptsRemaining} attempt${r.attemptsRemaining === 1 ? "" : "s"} remaining`
            : " · no attempts remaining"}
        </p>
      </div>

      {criticalMiss && (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
          role="alert"
          data-matrix-quiz-critical
        >
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Critical error
          </div>
          <p className="mt-1 text-sm text-[#E6F5EC]">
            Your score met the {quiz.passingRule.thresholdPercent}% bar, but a critical field was
            answered incorrectly — a single critical error fails the assessment. Review the critical
            MLS fields and retake.
          </p>
        </div>
      )}

      {issuance && (
        <div className="rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 p-5" data-matrix-quiz-issuance>
          <div className="text-[11px] uppercase tracking-wide text-[#4ade80]">🏁 Certification issued</div>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[#6b8577]">Issuance id</dt>
              <dd className="mt-0.5 break-all font-mono text-[#E6F5EC]">{issuance.issuance_id}</dd>
            </div>
            <div>
              <dt className="text-[#6b8577]">Version</dt>
              <dd className="mt-0.5 text-[#E6F5EC]">{issuance.certification_version}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[#6b8577]">Issued at</dt>
              <dd className="mt-0.5 text-[#E6F5EC]">{new Date(issuance.issued_at).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}

      {!issuance && r.passed && (
        <div className={`${CARD} p-4`}>
          <p className="text-sm text-[#9db3a6]">
            Knowledge quiz passed. Your certification issues once your Broker of Record approves the
            Rental Listing Practical.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {canRetake && (
          <button
            type="button"
            onClick={onRetake}
            className="rounded border border-[#22c55e]/60 bg-[#22c55e]/10 px-4 py-2 text-sm font-medium text-[#4ade80] hover:bg-[#22c55e]/20"
            data-matrix-quiz-retake
          >
            Retake quiz
          </button>
        )}
        <Link
          href="/the-matrix"
          className="rounded bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#04120a] hover:bg-[#16a34a]"
        >
          Back to Matrix Simulator
        </Link>
      </div>
    </div>
  );
}

export function MatrixQuizBackLink() {
  return (
    <Link
      href="/the-matrix"
      className="mb-4 inline-flex items-center gap-1 text-sm text-[#6b8577] hover:text-[#9db3a6]"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Matrix Simulator
    </Link>
  );
}
