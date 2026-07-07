// ============================================================================
// TRANSACTION OS 3.3B.3A — WizardShell
// ============================================================================
// Top-level client component for /workspace/new. Wires the session hook, the
// validation gate, and the layout chrome, and renders a per-step body. In
// 3.3B.3A the bodies are PLACEHOLDERS — the real step forms land in 3.3B.3B,
// and the create → parties → recompute → navigate orchestration lands in
// 3.3B.3D. NO API, NO transaction creation here.
//
// Gate rules (3.3B.3A contract):
//   • Next validates the CURRENT step, then advances on success.
//   • Back never validates.
//   • Cancel discards the draft (localStorage) and leaves the wizard.
// `validators` is injectable so the gate is testable without step UIs.
// ============================================================================

"use client";

import { useState } from "react";

import WizardLayout from "./WizardLayout";
import { useWizardSession } from "./useWizardSession";
import { prevStep, WIZARD_STEPS, type StepId } from "./wizard-steps";
import {
  stepValidators,
  validateStep,
  type StepValidator,
} from "./wizard-validation";
import TransactionTypeStep from "./TransactionTypeStep";
import PropertyStep from "./PropertyStep";
import ClientsPartiesStep from "./ClientsPartiesStep";
import ImportantDatesStep from "./ImportantDatesStep";
import ReviewStep from "./ReviewStep";
import type { UseWizardSession } from "./useWizardSession";

function stepLabel(step: StepId): string {
  return WIZARD_STEPS.find((s) => s.id === step)?.label ?? "";
}

/** Placeholder body for the terminal `create` step — the create → parties →
 *  recompute → navigate orchestration is wired in 3.3B.3D. */
function CreatePlaceholder() {
  return (
    <div data-testid="wizard-step-create" className="py-8 text-center">
      <p className="text-sm font-medium text-[#F1F1F3]">Ready to create</p>
      <p className="mt-1 text-xs text-[#71717A]">
        Transaction creation is wired in a later phase.
      </p>
    </div>
  );
}

/** Dispatch the current step to its component. `package` is terminal and never
 *  a current step, so it has no body here. */
function StepBody({ current, wiz }: { current: StepId; wiz: UseWizardSession }) {
  const { session } = wiz;
  switch (current) {
    case "type":
      return (
        <div data-testid="wizard-step-type">
          <TransactionTypeStep
            value={session.transaction_type}
            onSelect={wiz.setType}
          />
        </div>
      );
    case "property":
      return (
        <div data-testid="wizard-step-property">
          <PropertyStep property={session.property} onChange={wiz.patchProperty} />
        </div>
      );
    case "parties":
      return (
        <div data-testid="wizard-step-parties">
          <ClientsPartiesStep
            parties={session.parties}
            onChange={wiz.replaceParties}
          />
        </div>
      );
    case "dates":
      return (
        <div data-testid="wizard-step-dates">
          <ImportantDatesStep
            dates={session.dates}
            transactionType={session.transaction_type}
            onChange={wiz.patchDates}
          />
        </div>
      );
    case "review":
      return (
        <div data-testid="wizard-step-review">
          <ReviewStep session={session} />
        </div>
      );
    case "create":
      return <CreatePlaceholder />;
    default:
      return null;
  }
}

export interface WizardShellProps {
  /** Injectable per-step validators (defaults to the real registry). */
  validators?: Record<StepId, StepValidator>;
}

export default function WizardShell({
  validators = stepValidators,
}: WizardShellProps) {
  const wiz = useWizardSession();
  const [errors, setErrors] = useState<string[]>([]);

  // Avoid a flash of the wrong step before localStorage restore completes.
  if (!wiz.hydrated) {
    return (
      <div className="max-w-[760px] mx-auto py-16 text-center text-sm text-[#71717A]">
        Loading…
      </div>
    );
  }

  const current = wiz.session.current_step;
  const canBack = prevStep(current) !== null;
  const isCreateStep = current === "create";

  const handleNext = () => {
    const result = validateStep(current, wiz.session, validators);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    // On the terminal `create` step there is no next node; the create →
    // navigate orchestration is wired in 3.3B.3D. Here Next simply advances
    // through the data steps.
    wiz.goNext();
  };

  const handleBack = () => {
    // Back NEVER validates.
    setErrors([]);
    wiz.goBack();
  };

  const handleStepSelect = (step: StepId) => {
    // Stepper only offers already-visited steps → treated as Back (no validate).
    setErrors([]);
    wiz.goToStep(step);
  };

  const handleCancel = () => {
    wiz.cancel();
  };

  return (
    <WizardLayout
      current={current}
      stepLabel={stepLabel(current)}
      onStepSelect={handleStepSelect}
      onBack={handleBack}
      onNext={handleNext}
      onCancel={handleCancel}
      canBack={canBack}
      nextLabel={isCreateStep ? "Create" : "Next"}
      errors={errors}
    >
      <StepBody current={current} wiz={wiz} />
    </WizardLayout>
  );
}
