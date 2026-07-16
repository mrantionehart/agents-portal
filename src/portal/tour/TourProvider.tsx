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
  TourResponseShapeError,
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

  // Issue 4 — preserve the user's original preview intent throughout the
  // session. When the user starts with `opts.preview === true`, we anchor
  // completion-write gating to that intent, NOT to the server's response
  // mode. This prevents a publish-flip race where the server responds
  // `mode: "learner"` mid-preview and the client would otherwise POST a
  // real completion.
  const previewIntentRef = useRef<boolean>(false);

  // Issue 2 — track whether the most recent navigation was a Back
  // (rewind). The route_change auto-advance effect must NOT fire when
  // rewinding onto a completed route_change step whose expectedRoute
  // already matches the current pathname. If it did, Back would
  // immediately re-forward the user.
  //
  // The flag is set by `back()` and cleared by `next()`, `start()`,
  // `retry()`, `reset()`, and by the auto-advance effect itself (once
  // it's honored a rewind by skipping). This means: after a Back,
  // subsequent forward navigations (Next / start / retry) re-arm
  // auto-advance — the guard is per-rewind, not permanent.
  const justRewoundRef = useRef<boolean>(false);

  const start = useCallback(async (opts: StartOpts) => {
    userIdRef.current = opts.userId ?? null;
    previewIntentRef.current = opts.preview === true;
    justRewoundRef.current = false;
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
      let msg: string;
      if (e instanceof TourResponseShapeError) {
        // Issue 3 — a malformed response reaches this branch. Surface a
        // clear, non-crashing error to the user. TourRunner renders
        // nothing when `script` is null; the launcher / calling surface
        // should observe `tour.error` and display it.
        msg = "This tour cannot be loaded — the server returned an unexpected response. Please try again or contact support.";
      } else if (e instanceof TourApiError) {
        msg = `Unable to load tour (HTTP ${e.status}).`;
      } else {
        msg = "Unable to load tour.";
      }
      setState({ ...INITIAL_STATE, error: msg });
      return;
    }

    const script = response.script;
    const initialIndex = pickInitialIndex(
      script,
      response.mode,
      opts.userId ?? null,
    );

    // Issue 4 — user's `opts.preview` intent WINS over the server's
    // response.mode for state.mode. This governs UI (banner) AND is what
    // finish() gates writes on. If the caller opted into preview, the
    // session stays a preview regardless of what the server currently
    // thinks the module status is.
    const clientMode: TourClientMode = opts.preview ? "preview" : response.mode;

    setState({
      script,
      currentIndex: initialIndex,
      currentStep: script.steps[initialIndex] ?? null,
      mode: clientMode,
      loading: false,
      submitting: false,
      error: null,
      diagnostics: [],
      completed: false,
    });
  }, []);

  // Route-change auto-advance for `route_change` interactions.
  //
  // Fires when either the pathname changes OR the current step changes
  // to a `route_change` step whose expectedRoute already equals the
  // pathname (this covers "started with route already matched" AND
  // "advanced into route_change while pathname was already correct").
  //
  // Issue 2 — do NOT auto-advance when the current step change was
  // caused by `back()` and the expectedRoute already matches (Back onto
  // a completed route_change would immediately re-forward). The
  // `justRewoundRef` flag is set by `back()` and consumed here (once).
  // Subsequent forward navigations re-arm the auto-advance.
  useEffect(() => {
    setState((s) => {
      if (!s.script || !s.currentStep) return s;
      const step = s.currentStep;
      if (step.interaction.kind !== "route_change") return s;
      if (pathname !== step.interaction.expectedRoute) return s;
      if (justRewoundRef.current) {
        justRewoundRef.current = false;
        return s;
      }
      return advance(s);
    });
  }, [pathname, state.currentStep]);

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

  const next = useCallback(() => {
    justRewoundRef.current = false;
    setState((s) => advance(s));
  }, []);
  const back = useCallback(() => {
    justRewoundRef.current = true;
    setState((s) => rewind(s));
  }, []);

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
    justRewoundRef.current = false;
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
    justRewoundRef.current = false;
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
    // Issue 4 — gate on the persisted preview intent captured at start(),
    // NOT on state.mode (which may have been derived from the server's
    // response.mode). If the caller opted into preview, we NEVER submit
    // a completion write regardless of what the server thinks.
    // state.mode is a derived UI hint; previewIntentRef is the authority.
    if (previewIntentRef.current || s.mode === "preview") {
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
