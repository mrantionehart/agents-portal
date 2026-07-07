// ============================================================================
// TRANSACTION OS 3.3B.3A — Wizard Stepper (presentational navigation)
// ============================================================================
// Pure journey indicator. Renders the 7 wizard nodes, marks each
// complete / current / upcoming, and lets the agent jump BACK to any
// already-visited step (index ≤ current). Forward jumps are not allowed —
// the agent advances via the Next button (which validates). The terminal
// `package` node is always upcoming (reached only after create, in 3.3C).
//
// Inline Tailwind + design tokens, matching the (portal) TabStrip convention.
// No business logic, no state.
// ============================================================================

"use client";

import { Check } from "lucide-react";

import { WIZARD_STEPS, stepIndex, type StepId } from "./wizard-steps";

export interface StepperProps {
  current: StepId;
  /** Invoked when the agent clicks an already-visited (≤ current) step. */
  onStepSelect?: (step: StepId) => void;
  /** When provided, a visited step is only marked "complete" if it validates. */
  isComplete?: (step: StepId) => boolean;
}

export default function Stepper({
  current,
  onStepSelect,
  isComplete,
}: StepperProps) {
  const currentIdx = stepIndex(current);

  return (
    <nav
      aria-label="Transaction wizard progress"
      className="flex flex-wrap items-center gap-1.5 mb-6"
    >
      {WIZARD_STEPS.map((step, i) => {
        // `package` (navigable:false) has stepIndex -1 → always upcoming.
        const idx = stepIndex(step.id);
        const isCurrent = step.id === current;
        const positionallyPast = idx >= 0 && currentIdx >= 0 && idx < currentIdx;
        const complete =
          positionallyPast && (isComplete ? isComplete(step.id) : true);
        const canSelect =
          !!onStepSelect && step.navigable && idx >= 0 && idx <= currentIdx && !isCurrent;

        const tone = isCurrent
          ? "bg-[#C9A84C]/15 text-[#E8D5A3] border-[#C9A84C]/40"
          : complete
          ? "text-[#F1F1F3] border-[#252538] bg-white/[0.03]"
          : "text-[#71717A] border-transparent";

        const content = (
          <>
            <span
              aria-hidden
              className={`
                inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold
                ${isCurrent
                  ? "bg-[#C9A84C] text-[#0b0b10]"
                  : complete
                  ? "bg-[#C9A84C]/25 text-[#E8D5A3]"
                  : "bg-white/[0.06] text-[#71717A]"
                }
              `}
            >
              {complete ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            {step.label}
          </>
        );

        const base =
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors duration-[180ms]";

        if (canSelect) {
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepSelect!(step.id)}
              aria-label={`Go to ${step.label}`}
              className={`${base} ${tone} hover:text-[#F1F1F3] hover:border-[#252538]`}
            >
              {content}
            </button>
          );
        }

        return (
          <span
            key={step.id}
            aria-current={isCurrent ? "step" : undefined}
            className={`${base} ${tone}`}
          >
            {content}
          </span>
        );
      })}
    </nav>
  );
}
