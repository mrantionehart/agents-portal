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

import { useRef, useState, type ReactNode } from "react";

import type { SubmitAdapter } from "../../training/wizard/submit-adapter";
import { productionSubmitAdapter } from "../../training/wizard/submit-adapter";

import WizardLayout from "./WizardLayout";
import { useWizardSession } from "./useWizardSession";
import type { UseWizardSessionConfig } from "./useWizardSession";
import { prevStep, WIZARD_STEPS, type StepId } from "./wizard-steps";
import {
  stepValidators,
  validateStep,
  isStepComplete,
  firstInvalidStep,
  type StepValidator,
  type StepValidation,
  type WizardFieldErrors,
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

/** The terminal `create` step. The Create button (footer) runs the submit
 *  orchestration; this body confirms + surfaces any submit error with a retry. */
function CreateStep({
  submitting,
  submitError,
}: {
  submitting: boolean;
  submitError: string | null;
}) {
  return (
    <div data-testid="wizard-step-create" className="py-6 text-center">
      <p className="text-sm font-medium text-[#F1F1F3]">Ready to create</p>
      <p className="mt-1 text-xs text-[#71717A]">
        {submitting
          ? "Creating your transaction and adding parties…"
          : "Select Create to save this transaction and continue to Package Review."}
      </p>
      {submitError && (
        <p
          role="alert"
          className="mx-auto mt-4 max-w-sm rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {submitError}
        </p>
      )}
    </div>
  );
}

/** Dispatch the current step to its component, threading the current step's
 *  field errors. `package` is terminal and never a current step. */
function StepBody({
  current,
  wiz,
  fieldErrors,
  submitting,
  submitError,
}: {
  current: StepId;
  wiz: UseWizardSession;
  fieldErrors: WizardFieldErrors;
  submitting: boolean;
  submitError: string | null;
}) {
  const { session } = wiz;
  switch (current) {
    case "type":
      return (
        <div data-testid="wizard-step-type">
          <TransactionTypeStep
            value={session.transaction_type}
            onSelect={wiz.setType}
            error={fieldErrors.transaction_type}
          />
        </div>
      );
    case "property":
      return (
        <div data-testid="wizard-step-property">
          <PropertyStep
            property={session.property}
            onChange={wiz.patchProperty}
            errors={fieldErrors.property}
          />
        </div>
      );
    case "parties":
      return (
        <div data-testid="wizard-step-parties">
          <ClientsPartiesStep
            parties={session.parties}
            onChange={wiz.replaceParties}
            errors={fieldErrors.parties}
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
            errors={fieldErrors.dates}
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
      return <CreateStep submitting={submitting} submitError={submitError} />;
    default:
      return null;
  }
}

export interface WizardShellProps {
  /** Injectable per-step validators (defaults to the real registry). */
  validators?: Record<StepId, StepValidator>;
  /**
   * Persistence + navigation config forwarded to `useWizardSession`.
   * When omitted, the wizard uses production defaults (localStorage +
   * `/workspace/new` step URLs + `/workspace` exit).
   * Injected by the training-mode route (V4 Training Mode).
   */
  wizardConfig?: UseWizardSessionConfig;
  /**
   * Terminal-action swap. When omitted the wizard runs the production
   * submit orchestrator (create transaction + add parties). Training
   * mode injects `createTrainingSubmitAdapter(...)` which POSTs to
   * `/api/activity-sessions/[id]/complete` and NEVER creates a
   * transaction row.
   */
  submitAdapter?: SubmitAdapter;
  /**
   * Optional banner rendered above the wizard layout. Training mode
   * uses this to display the "TRAINING SESSION" indicator + lesson +
   * countdown. Production leaves it null.
   */
  banner?: ReactNode;
}

export default function WizardShell({
  validators = stepValidators,
  wizardConfig,
  submitAdapter = productionSubmitAdapter,
  banner = null,
}: WizardShellProps) {
  const wiz = useWizardSession(wizardConfig);
  // Structured validation result for the CURRENT step (null until a failed Next).
  const [validation, setValidation] = useState<StepValidation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Synchronous re-entrancy lock. `submitting` is React state (async), so a
  // same-frame double-click could pass the state guard twice; this ref blocks
  // the second call immediately. Released only on failure (success unmounts).
  const submitLock = useRef(false);

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

  // Submit orchestration for the terminal `create` step (3.3B.3D). Composes the
  // existing create + party endpoints; idempotency lives in the session anchors.
  const handleCreate = async () => {
    // Re-entrancy guard — block a second submit synchronously (double-click /
    // in-flight). The disabled button also prevents this, but the ref closes
    // the same-frame race the async `submitting` state cannot.
    if (submitLock.current) return;

    // Pre-submit guard: never create a transaction from invalid data.
    const bad = firstInvalidStep(wiz.session, validators);
    if (bad) {
      setValidation(validateStep(bad, wiz.session, validators));
      wiz.goToStep(bad);
      return;
    }
    submitLock.current = true;
    setSubmitError(null);
    setSubmitting(true);
    const result = await submitAdapter(wiz.session, {
      onTransactionCreated: wiz.setDraftTransactionId,
      onPartyCreated: wiz.addCreatedPartyId,
    });
    if (!result.ok) {
      // Reset ONLY on failure so the agent can retry.
      submitLock.current = false;
      setSubmitting(false);
      setSubmitError(result.error ?? "Something went wrong. Please retry.");
      return;
    }
    // Success — hand off to Package Review (owned by 3.3C). Keep `submitting`
    // TRUE and the lock held: the button stays disabled and the step keeps
    // showing "Creating…" straight through the route transition (the wizard
    // unmounts on navigation). Do NOT reset submitting here — that competing
    // re-render races router.push in the App Router and can DROP the
    // navigation, stranding the user on an active Create button (the
    // duplicate-transaction hazard this fixes).
    wiz.finish(result.redirectTo ?? `/workspace/${result.transactionId}`);
  };

  const handleNext = () => {
    if (isCreateStep) {
      void handleCreate();
      return;
    }
    const result = validateStep(current, wiz.session, validators);
    if (!result.valid) {
      setValidation(result);
      return;
    }
    setValidation(null);
    wiz.goNext();
  };

  const clearAndGo = (fn: () => void) => {
    if (submitting) return; // don't navigate mid-submit
    // Back / step-select NEVER validate.
    setValidation(null);
    setSubmitError(null);
    fn();
  };

  const handleBack = () => clearAndGo(wiz.goBack);
  const handleStepSelect = (step: StepId) => clearAndGo(() => wiz.goToStep(step));
  const handleCancel = () => {
    if (submitting) return;
    wiz.cancel();
  };

  const fieldErrors: WizardFieldErrors = validation?.fieldErrors ?? {};

  return (
    <>
      {banner}
      <WizardLayout
        current={current}
        stepLabel={stepLabel(current)}
        onStepSelect={handleStepSelect}
        isStepComplete={(step) => isStepComplete(step, wiz.session, validators)}
        onBack={handleBack}
        onNext={handleNext}
        onCancel={handleCancel}
        canBack={canBack}
        nextLabel={isCreateStep ? "Create" : "Next"}
        messages={validation?.messages ?? []}
        busy={submitting}
      >
        <StepBody
          current={current}
          wiz={wiz}
          fieldErrors={fieldErrors}
          submitting={submitting}
          submitError={submitError}
        />
      </WizardLayout>
    </>
  );
}
