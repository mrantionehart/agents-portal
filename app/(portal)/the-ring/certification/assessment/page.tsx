// ============================================================================
// COMM-1C — The Ring · Certification Assessment runner (Agent Portal)
// ============================================================================
// Runs one certification assessment in the Ring conversation, entering the
// server-created mode='assessment' session identified by ?session=. On grading
// completion it reads the authoritative Vault progress to show pass/fail and the
// next step (Continue / Try Again / View). It NEVER claims a certification is
// "issued" — issuance is gated server-side and surfaced only by the cert page.
//
// The session id from the query is UNTRUSTED: Vault fails closed on a session
// that isn't the caller's own (the hook surfaces "This assessment isn't
// available."). We never send tenantId/learnerId/mode — Vault derives them.
// ============================================================================

"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { RingExperience } from "../../_components/ring-experience";
import { getCertificationProgress, startAssessment } from "@/lib/ring/vault-ring-client";

const CERT_HOME = "/the-ring/certification";
const GOLD = "bg-[#C9A84C] text-[#0b0b10]";
const OUTLINE = "border border-[#1a1a2e] text-[#F1F1F3]";

interface Params {
  readonly sessionId: string;
  readonly requirementId: string;
  readonly label: string;
}
interface Verdict {
  readonly passed: boolean;
  readonly allDone: boolean;
  readonly completed: number;
  readonly total: number;
}

function goToAssessment(sessionId: string, requirementId: string, label: string) {
  window.location.href = `${CERT_HOME}/assessment?session=${encodeURIComponent(sessionId)}&req=${encodeURIComponent(requirementId)}&label=${encodeURIComponent(label)}`;
}

export default function CertificationAssessmentPage() {
  const router = useRouter();
  const [params, setParams] = useState<Params | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);

  // Hydration-safe: read the query string inside an effect.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const sessionId = sp.get("session");
    if (!sessionId) {
      router.replace(CERT_HOME);
      return;
    }
    setParams({
      sessionId,
      requirementId: sp.get("req") ?? "",
      label: sp.get("label") || "Certification assessment",
    });
  }, [router]);

  const onComplete = useCallback(async () => {
    try {
      const p = await getCertificationProgress();
      const passed = params?.requirementId
        ? p.requirements.find((r) => r.requirementId === params.requirementId)?.status === "passed"
        : false;
      setVerdict({ passed, allDone: p.status === "requirements_met", completed: p.completed, total: p.total });
    } catch {
      /* leave verdict null → "scoring…" stays; learner can retry */
    }
  }, [params?.requirementId]);

  async function start(requirementId?: string) {
    setBusy(true);
    try {
      const r = await startAssessment(requirementId);
      goToAssessment(r.sessionId, r.requirementId, r.scenarioLabel);
    } catch {
      router.replace(CERT_HOME);
    } finally {
      setBusy(false);
    }
  }

  if (!params) return <div className="p-8 text-sm text-[#A1A1AA]">Loading…</div>;

  const btn = "inline-flex min-h-[44px] items-center justify-center rounded-md px-4 text-sm font-semibold disabled:opacity-60";
  const resultActions: ReactNode = verdict ? (
    <div className="w-full">
      <p className={`text-lg font-semibold ${verdict.passed ? "text-[#C9A84C]" : "text-[#71717A]"}`}>
        {verdict.passed ? "Assessment Passed" : "Not passed yet"}
      </p>
      <p className="mt-1 text-sm text-[#A1A1AA]">
        {verdict.allDone
          ? "All certification requirements passed."
          : `${verdict.completed} of ${verdict.total} certification assessments passed.`}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {verdict.allDone ? (
          <button type="button" className={`${btn} ${GOLD}`} onClick={() => router.push(CERT_HOME)}>
            View certification
          </button>
        ) : verdict.passed ? (
          <button type="button" className={`${btn} ${GOLD}`} disabled={busy} onClick={() => start()}>
            {busy ? "Starting…" : "Continue Certification"}
          </button>
        ) : (
          <button type="button" className={`${btn} ${GOLD}`} disabled={busy} onClick={() => start(params.requirementId)}>
            {busy ? "Starting…" : "Try Again"}
          </button>
        )}
        <button type="button" className={`${btn} ${OUTLINE}`} onClick={() => router.push(CERT_HOME)}>
          Back
        </button>
      </div>
    </div>
  ) : (
    <p className="text-sm text-[#A1A1AA]">Scoring your assessment…</p>
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <RingExperience
        certificationId="hartfelt-holdings-acquisition-certified"
        assessment={{ sessionId: params.sessionId, label: params.label, onComplete, resultActions }}
      />
    </div>
  );
}
