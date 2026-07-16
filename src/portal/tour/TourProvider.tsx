// ============================================================================
// AP2 guided-training — TourProvider (context + orchestration)
// ============================================================================
// Owns the current tour's state. Consumers (TourRunner, launcher UIs,
// tests) subscribe via useTour(). Provider is mounted ONCE inside the
// AP2 (portal) layout.
//
// This module is a THIN renderer — every server-side authorization and
// completion decision lives in Vault. The client's job is:
//   1. Load a script via fetchTourScript().
//   2. Advance/rewind through steps according to the typed interaction.
//   3. On the final step in learner mode, POST completion.
//   4. In preview mode, NEVER POST — resetting clears preview state only.
// ============================================================================

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import {
  fetchTourScript,
  submitTourCompletion,
  TourApiError,
} from "./api";
import {
  clearLearnerResume,
  readLearnerResume,
  writeLearnerResume,
} from "./persistence-learner";
import {
  clearPreviewState,
  readPreviewState,
  writePreviewState,
} from "./persistence-preview";
import type {
  MissingTargetDiagnostic,
  TourClientMode,
  TourGetResponse,
  TourScript,
  TourStep,
} from "./types";

// ─── Context shape ──────────────────────────────────────────────────────────

interface StartOpts {
  certificationId: string;
  lessonId: string;
  preview?: boolean;
  userId?: string | null;
}

export interface TourState {
  script: TourScript | null;
  currentIndex: number;
  currentStep: TourStep | null;
  mode: TourClientMode;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  diagnostics: MissingTargetDiagnostic[];
  completed: boolean;
}

interface TourApi extends TourState {
  start(opts: StartOpts): Promise<void>;
  next(): void;
  back(): void;
  exit(): void;
  retry(): void;
  reset(): void;
  goToStep(stepId: string): void;
  registerMissingTarget(d: MissingTargetDiagnostic): void;
  finish(): Promise<void>;
}

const INITIAL_STATE: TourState = {
  script: null,
  currentIndex: 0,
  currentStep: null,
  mode: "learner",
  loading: false,
  submitting: false,
  error: null,
  diagnostics: [],
  completed: false,
};

const TourContext = createContext<TourApi | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<TourState>(INITIAL_STATE);
  const userIdRef = useRef<string | null>(null);

  const start = useCallback(async (opts: StartOpts) => {
    userIdRef.current = opts.userId ?? null;
    setState((s) => ({
      ...INITIAL_STATE,
      loading: true,
      mode: opts.preview ? "preview" : "learner",
      diagnostics: [],
    }));
    let response: TourGetResponse;
    try {
      response = await fetchTourScript({
        certificationId: opts.certificationId,
        lessonId: opts.lessonId,
        preview: opts.preview,
      });
    } catch (e) {
      const msg =
        e instanceof TourApiError
          ? `Unable to load tour (HTTP ${e.status}).`
          : "Unable to load tour.";
      setState({ ...INITIAL_STATE, error: msg });
      return;
    }

    const script = response.script;
    const initialIndex = pickInitialIndex(
      script,
      response.mode,
      opts.userId ?? null,
    );

    setState({
      script,
      currentIndex: initialIndex,
      currentStep: script.steps[initialIndex] ?? null,
      mode: response.mode,
      loading: false,
      submitting: false,
      error: null,
      diagnostics: [],
      completed: false,
    });
  }, []);

  // Route-change auto-advance for `route_change` interactions.
  useEffect(() => {
    setState((s) => {
      if (!s.script || !s.currentStep) return s;
      const step = s.currentStep;
      if (step.interaction.kind !== "route_change") return s;
      if (pathname !== step.interaction.expectedRoute) return s;
      return advance(s);
    });
  }, [pathname]);

  // Document-level click listener for `target_click` interactions.
  // Attached only while a target_click step is active.
  useEffect(() => {
    const step = state.currentStep;
    if (!step) return;
    if (step.interaction.kind !== "target_click") return;
    const targetId = step.interaction.targetId;

    const handler = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      const anchorEl = target.closest?.(`[data-training-id="${targetId}"]`);
      if (!anchorEl) return;
      setState((s) => advance(s));
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [state.currentStep]);

  // Persist resume state on every step change.
  useEffect(() => {
    if (!state.script || !state.currentStep) return;
    const step = state.currentStep;
    const script = state.script;

    if (state.mode === "learner") {
      writeLearnerResume(userIdRef.current, script.id, script.scriptVersion, {
        currentStepId: step.id,
        stepsCompleted: state.script.steps
          .slice(0, state.currentIndex)
          .map((st) => st.id),
        updatedAt: new Date().toISOString(),
      });
    } else {
      writePreviewState(script.id, script.scriptVersion, {
        currentStepId: step.id,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [state.script, state.currentStep, state.currentIndex, state.mode]);

  const next = useCallback(() => setState((s) => advance(s)), []);
  const back = useCallback(() => setState((s) => rewind(s)), []);

  const goToStep = useCallback((stepId: string) => {
    setState((s) => {
      if (!s.script) return s;
      const idx = s.script.steps.findIndex((st) => st.id === stepId);
      if (idx < 0) return s;
      return {
        ...s,
        currentIndex: idx,
        currentStep: s.script.steps[idx],
        completed: false,
      };
    });
  }, []);

  const exit = useCallback(() => {
    // Exit preserves learner resume state so the user can pick up later.
    // Preview mode wipes its own state, matching D — preview closing may
    // clear preview progress.
    setState((s) => {
      if (s.script && s.mode === "preview") {
        clearPreviewState(s.script.id, s.script.scriptVersion);
      }
      return { ...INITIAL_STATE };
    });
  }, []);

  const retry = useCallback(() => {
    setState((s) => {
      if (!s.script) return s;
      return {
        ...s,
        currentIndex: 0,
        currentStep: s.script.steps[0] ?? null,
        completed: false,
        error: null,
        diagnostics: [],
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState((s) => {
      if (!s.script) return s;
      if (s.mode === "preview") {
        clearPreviewState(s.script.id, s.script.scriptVersion);
      }
      return {
        ...s,
        currentIndex: 0,
        currentStep: s.script.steps[0] ?? null,
        completed: false,
        diagnostics: [],
      };
    });
  }, []);

  const registerMissingTarget = useCallback(
    (d: MissingTargetDiagnostic) => {
      setState((s) => ({
        ...s,
        diagnostics: [...s.diagnostics, d],
      }));
      // Structured console diagnostic — replaces silent stall. Portal's
      // real telemetry sink (posthog etc.) is out of scope for the pilot.
      // eslint-disable-next-line no-console
      console.warn("[tour] missing target", d);
    },
    [],
  );

  const finish = useCallback(async () => {
    const s = state;
    if (!s.script) return;
    if (s.mode === "preview") {
      // Preview never writes. Just mark completed for UI purposes.
      setState((prev) => ({ ...prev, completed: true }));
      return;
    }
    setState((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await submitTourCompletion({
        certificationId: s.script.certificationId,
        lessonId: s.script.lessonId,
      });
      clearLearnerResume(
        userIdRef.current,
        s.script.id,
        s.script.scriptVersion,
      );
      setState((prev) => ({ ...prev, submitting: false, completed: true }));
    } catch (e) {
      const msg =
        e instanceof TourApiError
          ? `Completion write failed (HTTP ${e.status}).`
          : "Completion write failed.";
      setState((prev) => ({ ...prev, submitting: false, error: msg }));
    }
  }, [state]);

  const value = useMemo<TourApi>(
    () => ({
      ...state,
      start,
      next,
      back,
      exit,
      retry,
      reset,
      goToStep,
      registerMissingTarget,
      finish,
    }),
    [state, start, next, back, exit, retry, reset, goToStep, registerMissingTarget, finish],
  );

  return (
    <TourContext.Provider value={value}>{children}</TourContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTour(): TourApi {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used inside <TourProvider>");
  }
  return ctx;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function advance(s: TourState): TourState {
  if (!s.script) return s;
  const next = s.currentIndex + 1;
  if (next >= s.script.steps.length) {
    // Past the final step: mark as ready to finish. `finish()` is what
    // performs the write.
    return { ...s, completed: true };
  }
  return {
    ...s,
    currentIndex: next,
    currentStep: s.script.steps[next],
  };
}

function rewind(s: TourState): TourState {
  if (!s.script) return s;
  const prev = Math.max(0, s.currentIndex - 1);
  return {
    ...s,
    currentIndex: prev,
    currentStep: s.script.steps[prev],
    completed: false,
  };
}

function pickInitialIndex(
  script: TourScript,
  mode: TourClientMode,
  userId: string | null,
): number {
  const resumeId =
    mode === "learner"
      ? readLearnerResume(userId, script.id, script.scriptVersion)?.currentStepId
      : readPreviewState(script.id, script.scriptVersion)?.currentStepId;
  if (!resumeId) return 0;
  const idx = script.steps.findIndex((s) => s.id === resumeId);
  return idx >= 0 ? idx : 0;
}
