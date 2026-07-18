// ============================================================================
// V4 TRAINING MODE — TrainingBanner
// ============================================================================
// The persistent indicator that renders above the wizard in training
// mode. Cannot be dismissed. Never rendered in production. Displays:
//
//   • the literal "TRAINING SESSION" label + amber accent (deliberately
//     NOT green/blue so it can never be confused with the production
//     Create-Transaction chrome);
//   • the lesson id + activity type (context so the learner knows
//     which practice they're doing);
//   • a live countdown to `expires_at` — updates every second on the
//     client only.
//
// The banner does NO API calls. It is pure presentation. The learner's
// session expiration is derived from a prop the training route hands
// down.
// ============================================================================

"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface TrainingBannerProps {
  lessonId: string;
  activityType: string;
  /** ISO 8601 timestamp. */
  expiresAt: string;
  /** Optional: called when the countdown reaches zero. Route uses this
   *  to redirect the learner to an "expired" screen. */
  onExpired?: () => void;
}

/**
 * Human-readable "N minutes left" (or "N seconds" if under a minute).
 * Returns null when the deadline has already passed.
 */
function formatRemaining(msRemaining: number): string {
  if (msRemaining <= 0) return "expired";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m remaining`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s remaining`;
  }
  return `${seconds}s remaining`;
}

export default function TrainingBanner({
  lessonId,
  activityType,
  expiresAt,
  onExpired,
}: TrainingBannerProps) {
  const [remaining, setRemaining] = useState<string>(() =>
    formatRemaining(Date.parse(expiresAt) - Date.now()),
  );
  // Ref so the tick closure always sees the latest "already fired" flag
  // without triggering effect re-runs. Prevents onExpired from firing
  // twice under a state-scheduling race.
  const hasFiredRef = useRef(false);

  useEffect(() => {
    hasFiredRef.current = false;
    const tick = () => {
      const ms = Date.parse(expiresAt) - Date.now();
      setRemaining(formatRemaining(ms));
      if (ms <= 0 && !hasFiredRef.current) {
        hasFiredRef.current = true;
        onExpired?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="training-session-banner"
      className="mx-auto mb-4 flex w-full max-w-[760px] items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <AlertCircle
        className="h-5 w-5 shrink-0 text-amber-400"
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Training session
          </span>
          <span className="text-xs text-amber-200/80">
            No real transaction is created.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-100/90">
          <span data-testid="training-banner-lesson">
            Lesson: <code className="font-mono">{lessonId}</code>
          </span>
          <span data-testid="training-banner-activity">
            Activity: <code className="font-mono">{activityType}</code>
          </span>
          <span data-testid="training-banner-countdown">{remaining}</span>
        </div>
      </div>
    </div>
  );
}
