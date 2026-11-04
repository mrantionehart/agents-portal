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
  MatrixApiError,
  type PreparedExercise,
  type SubmitResult,
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
  readonly exercise: PreparedExercise | null;
  readonly values: Record<string, MatrixFieldValue | "">;
  readonly result: SubmitResult | null;
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

export function useMatrixPractice(): MatrixPractice {
  const [phase, setPhase] = useState<MatrixPhase>("idle");
  const [exercise, setExercise] = useState<PreparedExercise | null>(null);
  const [values, setValues] = useState<Record<string, MatrixFieldValue | "">>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const enter = useCallback(async (scenarioId?: string) => {
    setError(null);
    setFieldErrors({});
    setResult(null);
    setPhase("preparing");
    try {
      const ex = await prepareExercise(scenarioId);
      setExercise(ex);
      setValues(ex.values);
      setPhase("editing");
    } catch (err) {
      setError(messageFor(err));
      setPhase("error");
    }
  }, []);

  const setValue = useCallback((fieldId: string, value: MatrixFieldValue | "") => {
    setValues((v) => ({ ...v, [fieldId]: value }));
    setSavedAt(null); // dirty since last save
  }, []);

  const saveDraft = useCallback(async () => {
    if (!exercise) return;
    setSaving(true);
    try {
      await apiSaveDraft(exercise.attemptId, values);
      setSavedAt(Date.now());
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }, [exercise, values]);

  const submit = useCallback(async () => {
    if (!exercise) return;
    setFieldErrors({});
    setError(null);
    setPhase("submitting");
    try {
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
  }, [exercise, values]);

  const reset = useCallback(() => {
    setPhase("idle");
    setExercise(null);
    setValues({});
    setResult(null);
    setError(null);
    setFieldErrors({});
    setSavedAt(null);
  }, []);

  return {
    phase, exercise, values, result, error, fieldErrors, saving, savedAt,
    enter, setValue, saveDraft, submit, reset,
  };
}
