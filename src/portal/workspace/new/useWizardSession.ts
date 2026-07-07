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
  addCreatedPartyId,
  clearSession,
  emptySession,
  loadSession,
  mergeDates,
  mergeProperty,
  saveSession,
  setDraftTransactionId,
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
  /** Idempotency anchors set by the submit orchestrator (3.3B.3D). */
  setDraftTransactionId: (id: string) => void;
  addCreatedPartyId: (id: string) => void;
  /** Clear the draft (localStorage) and navigate to a target (submit success). */
  finish: (href: string) => void;
}

export function useWizardSession(): UseWizardSession {
  const router = useRouter();
  const searchParams = useSearchParams();

  // SSR-safe: start empty so server and first client render match; the real
  // restore happens in the mount effect below.
  const [session, setSession] = useState<WizardSession>(() => emptySession());
  const [hydrated, setHydrated] = useState(false);
  const didRestore = useRef(false);
  // Once finished (submit success), stop persisting so the cleared draft stays
  // cleared even as trailing state updates flush.
  const finished = useRef(false);

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

  // Persist every change after the initial restore (but never after finish()).
  useEffect(() => {
    if (hydrated && !finished.current) saveSession(session);
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
    finished.current = true;
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

  const setDraftId = useCallback(
    (id: string) => setSession((s) => setDraftTransactionId(s, id)),
    []
  );
  const addPartyId = useCallback(
    (id: string) => setSession((s) => addCreatedPartyId(s, id)),
    []
  );
  const finish = useCallback(
    (href: string) => {
      finished.current = true;
      clearSession();
      router.push(href);
    },
    [router]
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
    setDraftTransactionId: setDraftId,
    addCreatedPartyId: addPartyId,
    finish,
  };
}
