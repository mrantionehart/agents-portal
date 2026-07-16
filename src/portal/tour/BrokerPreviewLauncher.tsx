// ============================================================================
// AP2 guided-training — Broker preview launcher
// ============================================================================
// Broker-only affordance to launch a draft-lesson tour in preview mode.
//
// This component performs NO client-side authorization. If a non-broker
// somehow renders it, the Vault GET route returns 404 and the tour
// fails gracefully with "unable to load tour". Client checks are UI
// affordances only — the server is the boundary.
// ============================================================================

"use client";

import { useCallback } from "react";

import { useTour } from "./TourProvider";

interface BrokerPreviewLauncherProps {
  /** Rendered role. If provided and NOT a broker/admin/office_manager,
   *  the button is hidden as a UI courtesy. */
  role?: string | null;
  certificationId: string;
  lessonId: string;
  /** Opaque user id to key learner-mode resume — for preview this is
   *  informational only (preview uses sessionStorage under a different
   *  key). */
  userId?: string | null;
  label?: string;
  className?: string;
}

const BROKER_ROLES = new Set(["broker", "admin", "office_manager"]);

export function BrokerPreviewLauncher(props: BrokerPreviewLauncherProps) {
  const { role, certificationId, lessonId, userId, label, className } = props;
  const tour = useTour();

  const eligible = role != null && BROKER_ROLES.has(role);

  const handleStart = useCallback(async () => {
    await tour.start({
      certificationId,
      lessonId,
      preview: true,
      userId,
    });
  }, [tour, certificationId, lessonId, userId]);

  if (!eligible) return null;

  return (
    <button
      type="button"
      onClick={handleStart}
      className={
        className ??
        "text-[12px] px-3 py-1 rounded border border-[#C9A84C]/60 text-[#C9A84C] hover:bg-[#C9A84C]/10"
      }
      data-tour-preview-launcher
      aria-label={
        label ?? `Preview lesson ${lessonId} in draft mode`
      }
    >
      {label ?? `Preview ${lessonId}`}
    </button>
  );
}
