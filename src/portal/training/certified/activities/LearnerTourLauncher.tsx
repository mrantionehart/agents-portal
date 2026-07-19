// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Learner tour launcher (Phase 4)
// ============================================================================
// Reuses the existing TourProvider by starting a tour with `preview: false`.
// The tour engine handles rendering the overlay (TourRunner is mounted in
// the portal layout) + persistence + completion write. This launcher does
// NOT fork the tour engine, duplicate scripts, or interpret tour steps.
//
// Broker preview and learner completion use the SAME start() call — the
// preview boolean is the discriminator, mirroring the server contract.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef } from "react";

import { useTour } from "@/src/portal/tour/TourProvider";
import { HARTFELT_PLATFORM_CERTIFIED_ID } from "../types";

interface LearnerTourLauncherProps {
  lessonId: string;
  /** Fires after `state.completed` transitions to true so the parent can
   *  refetch progress. Called at most once per mount + start cycle. */
  onCompletion?: () => void;
  className?: string;
  label?: string;
  /** Opaque user id for the learner-mode resume persistence key. */
  userId?: string | null;
  /** When the lesson's server status is already "completed", the launcher
   *  renders a passive success chip rather than a Start button. */
  alreadyCompleted?: boolean;
}

export default function LearnerTourLauncher({
  lessonId,
  onCompletion,
  className,
  label,
  userId,
  alreadyCompleted,
}: LearnerTourLauncherProps) {
  const tour = useTour();
  const isMineRef = useRef<boolean>(false);
  const completedFiredRef = useRef<boolean>(false);

  const handleStart = useCallback(async () => {
    isMineRef.current = true;
    completedFiredRef.current = false;
    await tour.start({
      certificationId: HARTFELT_PLATFORM_CERTIFIED_ID,
      lessonId,
      preview: false,
      userId: userId ?? null,
    });
  }, [tour, lessonId, userId]);

  // When the tour engine transitions to completed AND this launcher owns
  // the active tour, notify the parent so it re-fetches progress. We gate
  // on `isMineRef` so a completion from a different launcher on the same
  // page (unlikely but defensible) doesn't cross-fire.
  useEffect(() => {
    if (!isMineRef.current) return;
    if (tour.completed && !tour.submitting && !completedFiredRef.current) {
      completedFiredRef.current = true;
      onCompletion?.();
    }
  }, [tour.completed, tour.submitting, onCompletion]);

  if (alreadyCompleted) {
    return (
      <div
        className={
          className ??
          "inline-flex items-center gap-2 rounded border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300"
        }
        data-cert-tour-launcher="learner-completed"
      >
        ✅ Tour completed
      </div>
    );
  }

  const busy = tour.loading || tour.submitting;
  const activeMine = isMineRef.current && tour.script?.lessonId === lessonId;
  const buttonLabel = label ?? "Start tour";
  const activeLabel = activeMine ? "Tour running…" : buttonLabel;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleStart}
        disabled={busy || activeMine}
        className={
          className ??
          "inline-flex items-center gap-2 rounded border border-[#C9A84C]/60 bg-[#C9A84C]/10 px-4 py-2 text-sm font-medium text-[#C9A84C] hover:bg-[#C9A84C]/20 disabled:cursor-not-allowed disabled:opacity-60"
        }
        data-cert-tour-launcher="learner"
        aria-label={`Start guided tour for ${lessonId}`}
      >
        {busy ? "Loading…" : activeLabel}
      </button>
      {tour.error && isMineRef.current && (
        <p className="text-xs text-rose-400" role="alert">
          {tour.error}
        </p>
      )}
    </div>
  );
}
