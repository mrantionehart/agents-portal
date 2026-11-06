"use client";

// ============================================================================
// Matrix Simulator — learner practice hook
// ============================================================================
// Drives the rental-listing exercise: prepare a fictional draft from Vault,
// edit fields, save the working draft, and submit. The SERVER scores the
// submission — this hook never computes a pass; it only renders what Vault
// returns. Presentation lives in matrix-experience.tsx.
// ============================================================================

import { useCallback, useState } from "react";
import {
  prepareExercise,
  saveDraft as apiSaveDraft,
  submitAttempt,
  previewPrepareExercise,
  previewSubmit,
  MatrixApiError,
  type PreparedExercise,
  type SubmitResult,
  type PreviewSubmitResult,
  type PreviewFieldGrade,
  type MatrixFieldValue,
} from "@/lib/matrix/vault-matrix-client";

export type MatrixPhase = "idle" | "preparing" | "editing" | "submitting" | "done" | "error";

const UNAVAILABLE = "The Matrix simulator isn’t available yet.";
const GENERIC = "Something went wrong. Please try again.";

function messageFor(err: unknown): string {
  if (err instanceof MatrixApiError) {
    if (err.notEnabled) return UNAVAILABLE;
    if (err.code === "trial_expired") return "Your access has expired. Contact your broker.";
  }
  return GENERIC;
}

export interface MatrixPractice {
  readonly phase: MatrixPhase;
  readonly preview: boolean;
  readonly exercise: PreparedExercise | null;
  readonly values: Record<string, MatrixFieldValue | "">;
  readonly result: SubmitResult | PreviewSubmitResult | null;
  /** Broker-preview only: per-field expected-vs-actual answer review. */
  readonly review: readonly PreviewFieldGrade[] | null;
  readonly error: string | null;
  readonly fieldErrors: Record<string, string>;
  readonly saving: boolean;
  readonly savedAt: number | null;
  readonly enter: (scenarioId?: string) => Promise<void>;
  readonly setValue: (fieldId: string, value: MatrixFieldValue | "") => void;
  readonly saveDraft: () => Promise<void>;
  readonly submit: () => Promise<void>;
  readonly reset: () => void;
}

/**
 * Drives the practical. `opts.preview` switches the SAME flow onto the
 * broker-tier, write-nothing preview endpoints: prepare creates no attempt row,
 * there is no draft to persist (save is a local no-op), and submit scores
 * without recording anything. The learner path (default) is unchanged.
 */
export function useMatrixPractice(opts?: { preview?: boolean }): MatrixPractice {
  const preview = opts?.preview === true;
  const [phase, setPhase] = useState<MatrixPhase>("idle");
  const [exercise, setExercise] = useState<PreparedExercise | null>(null);
  const [values, setValues] = useState<Record<string, MatrixFieldValue | "">>({});
  const [result, setResult] = useState<SubmitResult | PreviewSubmitResult | null>(null);
  const [review, setReview] = useState<readonly PreviewFieldGrade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const enter = useCallback(async (scenarioId?: string) => {
    setError(null);
    setFieldErrors({});
    setResult(null);
    setReview(null);
    setPhase("preparing");
    try {
      const ex = await (preview ? previewPrepareExercise(scenarioId) : prepareExercise(scenarioId));
      setExercise(ex);
      setValues(ex.values);
      setPhase("editing");
    } catch (err) {
      setError(messageFor(err));
      setPhase("error");
    }
  }, [preview]);

  const setValue = useCallback((fieldId: string, value: MatrixFieldValue | "") => {
    setValues((v) => ({ ...v, [fieldId]: value }));
    setSavedAt(null); // dirty since last save
  }, []);

  const saveDraft = useCallback(async () => {
    if (!exercise) return;
    // Preview persists NOTHING — there is no attempt row to save a draft to.
    if (preview) { setSavedAt(Date.now()); return; }
    setSaving(true);
    try {
      await apiSaveDraft(exercise.attemptId, values);
      setSavedAt(Date.now());
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }, [exercise, values, preview]);

  const submit = useCallback(async () => {
    if (!exercise) return;
    setFieldErrors({});
    setError(null);
    setPhase("submitting");
    try {
      if (preview) {
        const r = await previewSubmit(exercise.scenarioId, values);
        setResult(r);
        setReview(r.review);
        setPhase("done");
        return;
      }
      // Persist the latest draft first so submit scores exactly what's on screen.
      await apiSaveDraft(exercise.attemptId, values);
      const r = await submitAttempt(exercise.attemptId);
      setResult(r);
      setPhase("done");
    } catch (err) {
      if (err instanceof MatrixApiError && err.code === "invalid" && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        setPhase("editing"); // send them back to fix the flagged fields
        return;
      }
      setError(messageFor(err));
      setPhase("error");
    }
  }, [exercise, values, preview]);

  const reset = useCallback(() => {
    setPhase("idle");
    setExercise(null);
    setValues({});
    setResult(null);
    setReview(null);
    setError(null);
    setFieldErrors({});
    setSavedAt(null);
  }, []);

  return {
    phase, preview, exercise, values, result, review, error, fieldErrors, saving, savedAt,
    enter, setValue, saveDraft, submit, reset,
  };
}
