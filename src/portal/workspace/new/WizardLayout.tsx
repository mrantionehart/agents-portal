// ============================================================================
// TRANSACTION OS 3.3B.3A — WizardLayout (shell chrome)
// ============================================================================
// The wizard's frame: page heading, the Stepper, a content card for the
// current step's body, an inline error banner, and the footer navigation
// (Cancel · Back · Next). Presentational only — all handlers are injected by
// WizardShell. Inline Tailwind + design tokens, matching the (portal) surface.
// ============================================================================

"use client";

import { ArrowLeft, ArrowRight, X, AlertCircle } from "lucide-react";

import Stepper from "./Stepper";
import { stepPositionLabel, type StepId } from "./wizard-steps";

export interface WizardLayoutProps {
  current: StepId;
  stepLabel: string;
  onStepSelect: (step: StepId) => void;
  /** Predicate for stepper "completed" display (visited AND valid). */
  isStepComplete?: (step: StepId) => boolean;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  canBack: boolean;
  nextLabel: string;
  /** Flattened banner messages for the current step's validation. */
  messages: string[];
  children: React.ReactNode;
}

export default function WizardLayout({
  current,
  stepLabel,
  onStepSelect,
  isStepComplete,
  onBack,
  onNext,
  onCancel,
  canBack,
  nextLabel,
  messages,
  children,
}: WizardLayoutProps) {
  return (
    <div className="max-w-[760px] mx-auto">
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-[#71717A]">
          {stepPositionLabel(current)}
        </p>
        <h1 className="text-2xl font-semibold text-[#F1F1F3] mt-1">
          New Transaction
        </h1>
        <p className="text-sm text-[#A1A1AA] mt-1">{stepLabel}</p>
      </header>

      <Stepper
        current={current}
        onStepSelect={onStepSelect}
        isComplete={isStepComplete}
      />

      <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-6">
        {messages.length > 0 && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" />
            <ul className="text-sm text-red-400 space-y-0.5">
              {messages.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {children}
      </section>

      <footer className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-sm text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#F1F1F3] transition-colors duration-[180ms]"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={!canBack}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#252538] px-3 py-1.5 text-sm text-[#F1F1F3] hover:bg-white/[0.04] transition-colors duration-[180ms] disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-3 py-1.5 text-sm font-medium text-[#E8D5A3] hover:bg-[#C9A84C]/25 transition-colors duration-[180ms]"
          >
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
