// ============================================================================
// COMM-1C — The Ring · Overview (Agent Portal)
// ============================================================================
// Landing page for the agent's Ring learner surface. Summarizes Practice and
// Seller Lead Certification and links into each. Certification progress is read
// from the authoritative Vault endpoint; nothing here asserts a pass or fakes a
// metric. DARK-safe: if progress can't load, the summary degrades gracefully.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, History, Swords, Award } from "lucide-react";

import { getCertificationProgress, type CertProgress } from "@/lib/ring/vault-ring-client";

const CARD = "rounded-lg border border-[#1a1a2e] bg-[#11111a]";

export default function TheRingOverviewPage() {
  const [progress, setProgress] = useState<CertProgress | null>(null);
  const [progressError, setProgressError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getCertificationProgress();
        if (!cancelled) setProgress(p);
      } catch {
        if (!cancelled) setProgressError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-2xl font-semibold text-[#F1F1F3]">The Ring</h1>
      <p className="mt-1 text-sm text-[#A1A1AA]">
        Sharpen your seller conversations with realistic practice, then earn your Seller Lead Certification.
      </p>

      <div className="mt-6 space-y-4">
        {/* Practice */}
        <Link href="/the-ring/practice" className={`${CARD} block p-5 transition hover:border-[#2a2a40]`}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#C9A84C]/15 text-[#C9A84C]">
              <Swords className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#F1F1F3]">Practice</p>
              <p className="mt-0.5 text-sm text-[#A1A1AA]">Practice realistic seller conversations.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#71717A]" aria-hidden="true" />
          </div>
        </Link>

        {/* Certification */}
        <Link href="/the-ring/certification" className={`${CARD} block p-5 transition hover:border-[#2a2a40]`}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#C9A84C]/15 text-[#C9A84C]">
              <Award className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#F1F1F3]">Seller Lead Certification</p>
              <p className="mt-0.5 text-sm text-[#A1A1AA]">
                {progress
                  ? progress.status === "requirements_met"
                    ? "All requirements passed."
                    : `${progress.completed} of ${progress.total} certification assessments passed`
                  : progressError
                    ? "View your certification requirements."
                    : "Loading…"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#71717A]" aria-hidden="true" />
          </div>
        </Link>

        {/* History */}
        <Link href="/the-ring/history" className={`${CARD} block p-5 transition hover:border-[#2a2a40]`}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#C9A84C]/15 text-[#C9A84C]">
              <History className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#F1F1F3]">History</p>
              <p className="mt-0.5 text-sm text-[#A1A1AA]">Review your past rounds and coaching.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#71717A]" aria-hidden="true" />
          </div>
        </Link>
      </div>
    </div>
  );
}
