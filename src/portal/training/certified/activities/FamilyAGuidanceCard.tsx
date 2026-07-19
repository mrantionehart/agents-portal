// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Family A guidance card (Phase 5)
// ============================================================================
// Renders instructional copy for the two allowlisted portal signals
// (`notification_read`, `profile_phone_set`) that the pcert-l03 evaluator
// verifies server-side. Provides a Verify Completion action that POSTs
// to `/api/platform/certifications/.../lessons/pcert-l03/complete` (empty
// body); Vault re-reads the signals server-side and returns success or an
// unmet-requirement envelope.
//
// PII rules (mirror the evaluator's discipline):
//   * We NEVER display the learner's phone number, notification content,
//     or evidence timestamps here.
//   * The learner performs the actions on their existing Portal pages
//     (Notifications + Profile). We link to those; we do NOT show what
//     they typed.
//   * A client-side "checkbox" is UI ONLY. The server verifies for real.
// ============================================================================

"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { CertApiError, requestPracticalCompletion } from "../api";
import type { LessonExternalSignal, LessonPracticalUiSpec } from "../types";

interface FamilyAGuidanceCardProps {
  lessonId: string;
  spec: LessonPracticalUiSpec;
  /** Progress refetch trigger after a successful verification. */
  onVerified?: () => void;
  /** Already-completed lessons render a passive summary — no submit UI. */
  alreadyCompleted?: boolean;
}

// Signal-specific display copy + destination route. New signal kinds must
// be added HERE and to the evaluator's allowlist in one atomic PR.
const SIGNAL_INFO: Record<
  LessonExternalSignal,
  { label: string; description: string; ctaHref: string; ctaText: string }
> = {
  notification_read: {
    label: "Mark a notification as read",
    description:
      "Open your Notifications inbox and open at least one notification. HartFelt records the timestamp — you never share the message content here.",
    ctaHref: "/notifications",
    ctaText: "Open Notifications",
  },
  profile_phone_set: {
    label: "Save your phone number",
    description:
      "Go to Settings → Profile and confirm a phone number is saved on your account. Your number is never displayed on this page or in any training record.",
    ctaHref: "/settings",
    ctaText: "Open Settings",
  },
};

export default function FamilyAGuidanceCard({
  lessonId,
  spec,
  onVerified,
  alreadyCompleted,
}: FamilyAGuidanceCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string; code: string | null }
  >({ kind: "idle" });

  const handleVerify = useCallback(async () => {
    setSubmitting(true);
    setResult({ kind: "idle" });
    try {
      const res = await requestPracticalCompletion({ lessonId });
      if (res.status === "completed") {
        setResult({ kind: "success", message: "Signals verified. Lesson complete." });
        onVerified?.();
      } else {
        setResult({
          kind: "success",
          message: `Signals verified. Lesson is ${res.status.replace("_", " ")}.`,
        });
        onVerified?.();
      }
    } catch (e) {
      if (e instanceof CertApiError) {
        const friendly =
          e.code === "attestation_missing"
            ? "Not all required signals are recorded yet. Perform the actions above, then try again."
            : e.code === "prerequisite_not_complete"
            ? "Complete the prerequisite lesson before verifying."
            : e.message;
        setResult({ kind: "error", message: friendly, code: e.code });
      } else {
        setResult({ kind: "error", message: "Verification failed.", code: null });
      }
    } finally {
      setSubmitting(false);
    }
  }, [lessonId, onVerified]);

  return (
    <section
      className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-5"
      data-cert-activity="family-a-guidance"
      aria-labelledby={`family-a-${lessonId}-heading`}
    >
      <h3 id={`family-a-${lessonId}-heading`} className="text-sm font-semibold text-[#F1F1F3]">
        Practical — complete these two actions in the Portal
      </h3>
      <p className="mt-1 text-xs text-[#A1A1AA]">
        The Portal records that you performed each action; HartFelt never
        exposes the content of your notifications or your phone number here.
      </p>
      <ul className="mt-4 space-y-3">
        {spec.required_signals.map((signal) => {
          const info = SIGNAL_INFO[signal];
          if (!info) return null;
          return (
            <li
              key={signal}
              className="flex items-start gap-3 rounded border border-[#1a1a2e] bg-[#050507] p-3"
              data-cert-signal={signal}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[#F1F1F3]">{info.label}</div>
                <p className="mt-0.5 text-xs text-[#A1A1AA]">{info.description}</p>
              </div>
              <Link
                href={info.ctaHref}
                className="shrink-0 rounded border border-[#1a1a2e] bg-[#11111a] px-3 py-1.5 text-xs text-[#F1F1F3] hover:border-[#252538]"
              >
                {info.ctaText}
              </Link>
            </li>
          );
        })}
      </ul>

      {alreadyCompleted ? (
        <div className="mt-4 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300">
          ✅ Signals previously verified.
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleVerify}
            disabled={submitting}
            className="inline-flex items-center rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f] disabled:cursor-not-allowed disabled:opacity-60"
            data-cert-verify-completion
          >
            {submitting ? "Verifying…" : "Verify completion"}
          </button>
          {result.kind === "success" && (
            <span className="text-xs text-green-300" role="status">
              {result.message}
            </span>
          )}
          {result.kind === "error" && (
            <span className="text-xs text-rose-400" role="alert">
              {result.message}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
