// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Quiz launcher (Gate C)
// ============================================================================
// The 8 quiz lessons open a `/training/quiz?lesson=<id>` page where the
// learner answers questions and submits. Final exam (pcert-l32) shows an
// additional issuance card after a passing attempt. This component links
// to that page; the quiz page owns fetching + rendering + submission.
// ============================================================================

"use client";

import Link from "next/link";

import { FINAL_EXAM_LESSON_ID } from "../types";

interface QuizLauncherProps {
  lessonId: string;
  alreadyPassed?: boolean;
}

export default function QuizLauncher({
  lessonId,
  alreadyPassed,
}: QuizLauncherProps) {
  const isFinal = lessonId === FINAL_EXAM_LESSON_ID;

  const params = new URLSearchParams({ lesson: lessonId });
  const href = `/training/quiz?${params.toString()}`;

  return (
    <section
      className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-5"
      data-cert-activity="quiz-link"
    >
      <h3 className="text-sm font-semibold text-[#F1F1F3]">
        {isFinal ? "Final Certification Exam" : "Knowledge quiz"}
      </h3>
      <p className="mt-1 text-xs text-[#A1A1AA]">
        {isFinal
          ? "Passing this exam issues your HartFelt Platform Certified credential."
          : "Answer the questions. Server scores each attempt; passing status is permanent."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {alreadyPassed ? (
          <div className="rounded border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300">
            {isFinal ? "🏁 Certification issued" : "✅ Quiz passed"}
          </div>
        ) : (
          <Link
            href={href}
            className="inline-flex items-center rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f]"
            data-cert-quiz-launch
          >
            {isFinal ? "Take the final exam" : "Take the quiz"}
          </Link>
        )}
      </div>
    </section>
  );
}
