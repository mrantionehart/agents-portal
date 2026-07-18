// ============================================================================
// TRANSACTION OS 3.3B.3A — useWizardSession hook
// ============================================================================
// Binds the pure WizardSession model to React state, a pluggable
// persistence store, and `?step=` URL sync. Owns navigation (next / back /
// goto / cancel) and the mount-time refresh-restore reconciliation. NO
// API, NO transaction creation — navigation and state only.
//
// PLUGGABLE PERSISTENCE (V4 Training Mode / 2026-07):
//   • Default: `productionLocalStorageStore` — wraps the legacy sync
//     load/save/clear from `wizard-session.ts`. Byte-for-byte identical
//     to the pre-Training-Mode behavior when no config is supplied.
//   • Injected: any `WizardSessionStore` (e.g. `TrainingSessionApiStore`
//     from `src/portal/training/wizard/training-store.ts`).
//
// Restore precedence on mount:
//   1. a valid `?step=` in the URL wins (deep-link / refresh on a step)
//   2. else the persisted session.current_step
//   3. else the first step
// If the URL lacks a valid step, it is normalised (router.replace) to
// the effective step.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { productionLocalStorageStore } from "../../training/wizard/production-store";
import type {
  StoreErrorCode,
  WizardSessionStore,
} from "../../training/wizard/session-store";

import {
  isValidStep,
  nextStep,
  prevStep,
  stepHref as defaultStepHref,
  type StepId,
} from "./wizard-steps";
import {
  addCreatedPartyId,
  emptySession,
  mergeDates,
  mergeProperty,
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
  /** False until the mount-time restore has run (avoids flash). */
  hydrated: boolean;
  goToStep: (step: StepId) => void;
  goNext: () => void;
  goBack: () => void;
  /** Discard the draft (clear the store) and leave the wizard. */
  cancel: () => void;
  setType: (type: string | null) => void;
  patchProperty: (patch: Partial<WizardPropertyDraft>) => void;
  replaceParties: (parties: WizardPartyDraft[]) => void;
  patchDates: (patch: Partial<WizardDatesDraft>) => void;
  /** Idempotency anchors set by the submit orchestrator (3.3B.3D). */
  setDraftTransactionId: (id: string) => void;
  addCreatedPartyId: (id: string) => void;
  /** Clear the draft (store) and navigate to a target (submit success). */
  finish: (href: string) => void;
}

export interface UseWizardSessionConfig {
  /**
   * Persistence backend. Defaults to `productionLocalStorageStore` — the
   * exact legacy localStorage wiring; used by `/workspace/new`.
   */
  store?: WizardSessionStore;
  /**
   * URL builder per step. Defaults to the production
   * `stepHref` (which builds `/workspace/new?step=X`). Training mode
   * injects a builder that keeps its own base path + session token.
   */
  stepHref?: (step: StepId) => string;
  /**
   * Href to send the caller to on Cancel. Defaults to WIZARD_EXIT_HREF
   * (`/workspace`). Training mode uses a training-index href.
   */
  exitHref?: string;
  /**
   * Notified when the store fails to load. Training mode uses this to
   * render an expired / not-found error state.
   */
  onLoadError?: (code: StoreErrorCode, detail?: string) => void;
  /**
   * Notified when a save write fails. Training mode uses this to render
   * a "changes not saved" toast without blocking optimistic UI.
   */
  onSaveError?: (code: StoreErrorCode, detail?: string) => void;
}

export function useWizardSession(
  config?: UseWizardSessionConfig,
): UseWizardSession {
  const router = useRouter();
  const searchParams = useSearchParams();

  const store = config?.store ?? productionLocalStorageStore;
  const stepHrefFn = config?.stepHref ?? defaultStepHref;
  const exitHref = config?.exitHref ?? WIZARD_EXIT_HREF;
  const onLoadError = config?.onLoadError;
  const onSaveError = config?.onSaveError;

  // Refs so the effect closures always see the latest handlers without
  // re-triggering the load-once effect.
  const storeRef = useRef(store);
  const stepHrefRef = useRef(stepHrefFn);
  const onLoadErrorRef = useRef(onLoadError);
  const onSaveErrorRef = useRef(onSaveError);
  storeRef.current = store;
  stepHrefRef.current = stepHrefFn;
  onLoadErrorRef.current = onLoadError;
  onSaveErrorRef.current = onSaveError;

  // SSR-safe: start empty so server and first client render match; the
  // real restore happens in the mount effect below.
  const [session, setSession] = useState<WizardSession>(() => emptySession());
  const [hydrated, setHydrated] = useState(false);
  const didRestore = useRef(false);
  // Once finished (submit success), stop persisting so the cleared draft
  // stays cleared even as trailing state updates flush.
  const finished = useRef(false);

  // Mount: restore from the store + reconcile with the URL step (once).
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;

    void (async () => {
      const result = await storeRef.current.load();

      if (result.kind === "error") {
        onLoadErrorRef.current?.(result.code, result.detail);
        setHydrated(true);
        return;
      }

      const restored = result.session ?? emptySession();
      const urlRaw = searchParams?.get("step") ?? null;
      const urlValid = isValidStep(urlRaw);
      const effectiveStep: StepId = urlValid
        ? (urlRaw as StepId)
        : restored.current_step;

      setSession(setStep(restored, effectiveStep));
      setHydrated(true);

      if (!urlValid) router.replace(stepHrefRef.current(effectiveStep));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist every change after the initial restore (but never after
  // finish()). Best-effort — errors surface via `onSaveError` but do
  // not block optimistic UI.
  useEffect(() => {
    if (!hydrated || finished.current) return;
    void storeRef.current.save(session).then((r) => {
      if (r.kind === "error") {
        onSaveErrorRef.current?.(r.code, r.detail);
      }
    });
  }, [session, hydrated]);

  const goToStep = useCallback(
    (step: StepId) => {
      setSession((s) => setStep(s, step));
      router.replace(stepHrefRef.current(step));
    },
    [router],
  );

  const goNext = useCallback(() => {
    setSession((s) => {
      const n = nextStep(s.current_step);
      if (!n) return s;
      router.replace(stepHrefRef.current(n));
      return setStep(s, n);
    });
  }, [router]);

  const goBack = useCallback(() => {
    setSession((s) => {
      const p = prevStep(s.current_step);
      if (!p) return s;
      router.replace(stepHrefRef.current(p));
      return setStep(s, p);
    });
  }, [router]);

  const cancel = useCallback(() => {
    finished.current = true;
    void storeRef.current.clear();
    router.push(exitHref);
  }, [router, exitHref]);

  const setType = useCallback(
    (type: string | null) => setSession((s) => setTransactionType(s, type)),
    [],
  );
  const patchProperty = useCallback(
    (patch: Partial<WizardPropertyDraft>) =>
      setSession((s) => mergeProperty(s, patch)),
    [],
  );
  const replaceParties = useCallback(
    (parties: WizardPartyDraft[]) => setSession((s) => setParties(s, parties)),
    [],
  );
  const patchDates = useCallback(
    (patch: Partial<WizardDatesDraft>) =>
      setSession((s) => mergeDates(s, patch)),
    [],
  );

  const setDraftId = useCallback(
    (id: string) => setSession((s) => setDraftTransactionId(s, id)),
    [],
  );
  const addPartyId = useCallback(
    (id: string) => setSession((s) => addCreatedPartyId(s, id)),
    [],
  );
  const finish = useCallback(
    (href: string) => {
      finished.current = true;
      void storeRef.current.clear();
      router.push(href);
    },
    [router],
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
