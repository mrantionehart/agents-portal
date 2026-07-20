// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Wizard launch link (Phase 6)
// ============================================================================
// The transaction wizard (pcert-l04) lives at `/training/wizard`. This
// component composes the launch URL with the query params that page
// expects (`?lesson=<id>&activity=<type>&evaluator_key=<key>&criterion_version=<v>`)
// and links the learner over. Return navigation is handled by the wizard
// page itself; the caller re-fetches progress when the learner returns.
//
// This component does NOT rewrite the wizard, duplicate its config, or
// intercept its submission. It's a link generator only.
// ============================================================================

"use client";

import Link from "next/link";

import type { LessonSessionUiSpec } from "../types";
import { HARTFELT_PLATFORM_CERTIFIED_ID } from "../types";

interface WizardLaunchLinkProps {
  lessonId: string;
  spec: LessonSessionUiSpec;
  alreadyCompleted?: boolean;
}

// Evaluator key for pcert-l04 is stable (see Vault `definition.ts:92`).
// Mirrored as a constant here so the query string is deterministic.
const WIZARD_EVALUATOR_KEY = "transaction_wizard.completed.v1" as const;
const WIZARD_CRITERION_VERSION = "1" as const;

export default function WizardLaunchLink({
  lessonId,
  spec,
  alreadyCompleted,
}: WizardLaunchLinkProps) {
  // Guard: only the wizard activity type belongs here. The unified lesson
  // page dispatcher gates on activity_type before rendering this
  // component, but a defensive check prevents a misconfigured lesson from
  // silently routing to the wrong activity.
  if (spec.activity_type !== "transaction_wizard") {
    return (
      <section className="rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        Wizard link requires activity_type = &quot;transaction_wizard&quot;;
        received &quot;{spec.activity_type}&quot;.
      </section>
    );
  }

  const params = new URLSearchParams({
    lesson: lessonId,
    activity: "transaction_wizard",
    evaluator_key: WIZARD_EVALUATOR_KEY,
    criterion_version: WIZARD_CRITERION_VERSION,
    certification: HARTFELT_PLATFORM_CERTIFIED_ID,
    version: "1.0.0",
  });
  const href = `/training/wizard?${params.toString()}`;

  return (
    <section
      className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-5"
      data-cert-activity="wizard-link"
    >
      <h3 className="text-sm font-semibold text-[#F1F1F3]">
        Practical — practice the transaction wizard
      </h3>
      <p className="mt-1 text-xs text-[#A1A1AA]">
        You&apos;ll open a training-mode copy of the transaction wizard.
        Nothing you enter creates a real transaction, and nothing you type
        is stored on your training record.
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
          <>
            <div className="rounded border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300">
              ✅ Wizard practice completed
            </div>
            {/*
              The completion pill is the primary signal — the practical is done
              and the learner does NOT need to repeat it. Alongside it we keep a
              visually secondary navigation link to the wizard so the learner
              can still reach `/training/wizard` if they want to look again (a
              natural review affordance) and so any downstream flow that
              observes a route change to `/training/wizard` can still function.
              The href + `data-cert-wizard-launch` attribute are unchanged
              across both states so the anchor + route target stay stable
              regardless of completion. Wizard start is idempotent server-side
              (the practical attestation upsert is protected by a 5-column
              unique constraint), so a repeat launch cannot introduce a
              duplicate practical attestation.
            */}
            <Link
              href={href}
              className="text-xs text-[#71717A] underline hover:text-[#F1F1F3]"
              data-cert-wizard-launch
            >
              Reopen wizard
            </Link>
          </>
        ) : (
          <Link
            href={href}
            className="inline-flex items-center rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f]"
            data-cert-wizard-launch
          >
            Open the training wizard
          </Link>
        )}
      </div>
    </section>
  );
}
