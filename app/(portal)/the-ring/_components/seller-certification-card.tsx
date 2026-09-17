// ============================================================================
// COMM-1C — Seller Lead Certification card (Agent Portal)
// ============================================================================
// Reads the authoritative COMM-1 progress from Vault and renders each
// requirement. It NEVER asserts a pass client-side. The "Start Certification"
// CTA appears only when the Portal assessment flag is on (lockstep with Vault's
// RING_SELLER_CERT_ASSESSMENT_ENABLED); otherwise an honest "coming soon" note
// is shown so the surface is DARK-safe with no broken button.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { getCertificationProgress, startAssessment, RingApiError, type CertProgress } from "@/lib/ring/vault-ring-client";
import { assessmentEntryEnabled } from "../_lib/ring-flags";

const GOLD = "bg-[#C9A84C] text-[#0b0b10]";

export function SellerCertificationCard() {
  const [progress, setProgress] = useState<CertProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const canStart = assessmentEntryEnabled();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getCertificationProgress();
        if (!cancelled) setProgress(p);
      } catch (err) {
        if (cancelled) return;
        setMessage(
          err instanceof RingApiError && err.status === 401
            ? "Your session expired. Sign in again — your progress is saved."
            : "Your certification progress isn't available yet.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onStart() {
    setStarting(true);
    setStartNotice(null);
    try {
      const r = await startAssessment();
      const url = `/the-ring/certification/assessment?session=${encodeURIComponent(r.sessionId)}&req=${encodeURIComponent(r.requirementId)}&label=${encodeURIComponent(r.scenarioLabel)}`;
      window.location.href = url; // full navigation → RingExperience mounts on the new session
      return;
    } catch (err) {
      if (err instanceof RingApiError && err.code === "already_certified") {
        setStartNotice("You're already certified.");
      } else if (err instanceof RingApiError && err.notEnabled) {
        setStartNotice("Certification assessments aren't available yet.");
      } else {
        setStartNotice("Couldn't start an assessment right now.");
      }
    } finally {
      setStarting(false);
    }
  }

  if (message) return <p className="mt-4 text-sm text-[#A1A1AA]">{message}</p>;
  if (!progress) return <Loader2 className="mt-4 h-4 w-4 animate-spin text-[#C9A84C]" aria-hidden="true" />;

  const certified = progress.status === "requirements_met";

  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C9A84C]">Seller Lead Certification</p>
      <p className="mt-1 text-xs text-[#71717A]">Passed by a controlled certification assessment — not by practice.</p>

      <ul className="mt-4 space-y-2">
        {progress.requirements.map((r) => {
          const passed = r.status === "passed";
          return (
            <li key={r.requirementId} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[#A1A1AA]">{r.label}</span>
              <span className={passed ? "font-medium text-[#C9A84C]" : "text-[#71717A]"}>{passed ? "✓ Passed" : "○ Required"}</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 border-t border-[#1a1a2e] pt-4 text-sm text-[#A1A1AA]">
        {progress.completed} of {progress.total} certification assessments passed
      </p>
      <p className={`mt-1 text-sm font-semibold ${certified ? "text-[#C9A84C]" : "text-[#71717A]"}`}>
        {certified ? "SELLER LEAD CERTIFIED ✓" : "Not yet certified"}
      </p>

      {!certified && canStart && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className={`inline-flex min-h-[44px] items-center rounded-md px-4 text-sm font-semibold disabled:opacity-60 ${GOLD}`}
          >
            {starting ? "Starting…" : progress.completed > 0 ? "Continue Certification" : "Start Certification"}
          </button>
          {startNotice && <p className="mt-2 text-xs text-[#A1A1AA]">{startNotice}</p>}
        </div>
      )}

      {!certified && !canStart && (
        <p className="mt-3 text-xs text-[#71717A]">
          Certification assessments are coming soon. Keep practicing — practice sharpens your skills but doesn&rsquo;t
          count toward certification.
        </p>
      )}
    </section>
  );
}
