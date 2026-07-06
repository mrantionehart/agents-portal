// ============================================================================
// TRANSACTION OS 3.3B.3A — useWizardSession hook
// ============================================================================
// Binds the pure WizardSession model to React state, localStorage persistence,
// and `?step=` URL sync. Owns navigation (next / back / goto / cancel) and the
// mount-time refresh-restore reconciliation. NO API, NO transaction creation —
// navigation and state only.
//
// Restore precedence on mount:
//   1. a valid `?step=` in the URL wins (deep-link / refresh on a step)
//   2. else the persisted session.current_step (localStorage)
//   3. else the first step
// Field data is always restored from localStorage. If the URL lacks a valid
// step, it is normalised (router.replace) to the effective step.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  isValidStep,
  nextStep,
  prevStep,
  stepHref,
  type StepId,
} from "./wizard-steps";
import {
  clearSession,
  emptySession,
  loadSession,
  mergeDates,
  mergeProperty,
  saveSession,
  setParties,
  setStep,
  setTransactionType,
  type WizardDatesDraft,
  type WizardPartyDraft,
  type WizardPropertyDraft,
  type WizardSession,
} from "./wizard-session";

/** Where Cancel returns to (discarding the draft). */
export const WIZARD_EXIT_HREF = "/workspace";

export interface UseWizardSession {
  session: WizardSession;
  /** False until the mount-time localStorage restore has run (avoids flash). */
  hydrated: boolean;
  goToStep: (step: StepId) => void;
  goNext: () => void;
  goBack: () => void;
  /** Discard the draft (clear localStorage) and leave the wizard. */
  cancel: () => void;
  setType: (type: string | null) => void;
  patchProperty: (patch: Partial<WizardPropertyDraft>) => void;
  replaceParties: (parties: WizardPartyDraft[]) => void;
  patchDates: (patch: Partial<WizardDatesDraft>) => void;
}

export function useWizardSession(): UseWizardSession {
  const router = useRouter();
  const searchParams = useSearchParams();

  // SSR-safe: start empty so server and first client render match; the real
  // restore happens in the mount effect below.
  const [session, setSession] = useState<WizardSession>(() => emptySession());
  const [hydrated, setHydrated] = useState(false);
  const didRestore = useRef(false);

  // Mount: restore from localStorage + reconcile with the URL step (once).
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;

    const restored = loadSession();
    const urlRaw = searchParams?.get("step") ?? null;
    const urlValid = isValidStep(urlRaw);
    const effectiveStep: StepId = urlValid
      ? (urlRaw as StepId)
      : restored.current_step;

    setSession(setStep(restored, effectiveStep));
    setHydrated(true);

    if (!urlValid) router.replace(stepHref(effectiveStep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist every change after the initial restore.
  useEffect(() => {
    if (hydrated) saveSession(session);
  }, [session, hydrated]);

  const goToStep = useCallback(
    (step: StepId) => {
      setSession((s) => setStep(s, step));
      router.replace(stepHref(step));
    },
    [router]
  );

  const goNext = useCallback(() => {
    setSession((s) => {
      const n = nextStep(s.current_step);
      if (!n) return s;
      router.replace(stepHref(n));
      return setStep(s, n);
    });
  }, [router]);

  const goBack = useCallback(() => {
    setSession((s) => {
      const p = prevStep(s.current_step);
      if (!p) return s;
      router.replace(stepHref(p));
      return setStep(s, p);
    });
  }, [router]);

  const cancel = useCallback(() => {
    clearSession();
    router.push(WIZARD_EXIT_HREF);
  }, [router]);

  const setType = useCallback(
    (type: string | null) => setSession((s) => setTransactionType(s, type)),
    []
  );
  const patchProperty = useCallback(
    (patch: Partial<WizardPropertyDraft>) =>
      setSession((s) => mergeProperty(s, patch)),
    []
  );
  const replaceParties = useCallback(
    (parties: WizardPartyDraft[]) => setSession((s) => setParties(s, parties)),
    []
  );
  const patchDates = useCallback(
    (patch: Partial<WizardDatesDraft>) => setSession((s) => mergeDates(s, patch)),
    []
  );

  return {
    session,
    hydrated,
    goToStep,
    goNext,
    goBack,
    cancel,
    setType,
    patchProperty,
    replaceParties,
    patchDates,
  };
}
