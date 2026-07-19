// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Checklist reflection launcher (Gate B)
// ============================================================================
// The 14 checklist lessons open a `/training/checklist?session=<id>` page
// where the learner ticks steps + writes reflections and submits. This
// component composes the launch URL and links there. Return navigation
// is handled by the checklist page.
//
// Like the wizard link, this file generates a URL — it does NOT duplicate
// step lists, reflection rules, or session state. All of that lives in
// Vault-driven params via the checklist page.
// ============================================================================

"use client";

import Link from "next/link";

import type { LessonSessionUiSpec } from "../types";

interface ChecklistLauncherProps {
  lessonId: string;
  spec: LessonSessionUiSpec;
  alreadyCompleted?: boolean;
}

const CHECKLIST_EVALUATOR_KEY = "checklist-reflection.completed.v1" as const;
const CHECKLIST_CRITERION_VERSION = "1" as const;

export default function ChecklistLauncher({
  lessonId,
  spec,
  alreadyCompleted,
}: ChecklistLauncherProps) {
  if (spec.activity_type !== "scenario") {
    return (
      <section className="rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        Checklist launcher requires activity_type = &quot;scenario&quot;;
        received &quot;{spec.activity_type}&quot;.
      </section>
    );
  }

  const params = new URLSearchParams({
    lesson: lessonId,
    activity: "scenario",
    evaluator_key: CHECKLIST_EVALUATOR_KEY,
    criterion_version: CHECKLIST_CRITERION_VERSION,
  });
  const href = `/training/checklist?${params.toString()}`;

  const stepCount = spec.required_steps.length;
  const reflectionRequirement = spec.requires_reflection
    ? `Each step needs a reflection of at least ${spec.minimum_reflection_length} characters.`
    : "No written reflection required.";

  return (
    <section
      className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-5"
      data-cert-activity="checklist-link"
    >
      <h3 className="text-sm font-semibold text-[#F1F1F3]">
        Practical — walk through the checklist
      </h3>
      <p className="mt-1 text-xs text-[#A1A1AA]">
        {stepCount} steps · {reflectionRequirement}
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-[#71717A]">
        {spec.required_steps.map((step) => (
          <li key={step} className="rounded bg-[#050507] px-2 py-0.5">
            {step}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {alreadyCompleted ? (
          <div className="rounded border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300">
            ✅ Checklist completed
          </div>
        ) : (
          <Link
            href={href}
            className="inline-flex items-center rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f]"
            data-cert-checklist-launch
          >
            Open the checklist
          </Link>
        )}
      </div>
    </section>
  );
}
