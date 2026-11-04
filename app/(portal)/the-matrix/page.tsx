// ============================================================================
// Matrix Simulator — overview (Agent Portal)
// ============================================================================
"use client";

import Link from "next/link";
import { Table2, ClipboardCheck, GraduationCap } from "lucide-react";
import { matrixSimulatorEnabled } from "./_lib/matrix-flags";

const CARD = "rounded-lg border border-[#13231a] bg-[#0b0f0c]";

export default function MatrixOverviewPage() {
  const enabled = matrixSimulatorEnabled();
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-xl font-semibold text-[#E6F5EC]">Matrix Simulator</h1>
      <p className="mt-1 text-sm text-[#9db3a6]">
        Practice completing fictional MLS listings, correct injected errors, and submit for Broker of
        Record review. Nothing here touches a live MLS.
      </p>

      {!enabled ? (
        <div className={`${CARD} mt-5 p-6`}>
          <p className="text-sm text-[#9db3a6]">Coming soon — rental listing practice.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link href="/the-matrix/quiz" className={`${CARD} flex flex-col items-start gap-2 p-5 transition hover:border-[#22c55e]/50`} data-matrix-quiz-card>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#22c55e]/15 text-[#22c55e]"><GraduationCap className="h-4 w-4" aria-hidden="true" /></span>
            <span className="text-sm font-semibold text-[#E6F5EC]">Knowledge Quiz</span>
            <span className="text-xs text-[#9db3a6]">20-question written check. 85% with zero critical errors to pass.</span>
          </Link>
          <Link href="/the-matrix/practice" className={`${CARD} flex flex-col items-start gap-2 p-5 transition hover:border-[#22c55e]/50`}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#22c55e]/15 text-[#22c55e]"><Table2 className="h-4 w-4" aria-hidden="true" /></span>
            <span className="text-sm font-semibold text-[#E6F5EC]">Rental Listing Practical</span>
            <span className="text-xs text-[#9db3a6]">Residential rental entry, error correction, and submission.</span>
          </Link>
          <Link href="/the-matrix/review" className={`${CARD} flex flex-col items-start gap-2 p-5 transition hover:border-[#22c55e]/50`}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#22c55e]/15 text-[#22c55e]"><ClipboardCheck className="h-4 w-4" aria-hidden="true" /></span>
            <span className="text-sm font-semibold text-[#E6F5EC]">Broker Review</span>
            <span className="text-xs text-[#9db3a6]">Broker of Record: review and certify submitted exercises.</span>
          </Link>
        </div>
      )}
    </div>
  );
}
