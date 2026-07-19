// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — /training/quiz page (Gate C)
// ============================================================================
// The learner-safe quiz experience for all 8 quiz lessons. Params:
//   ?lesson=<pcert-lXX>
// Fetches Vault's projection (no correct-option markers), renders questions,
// submits attempts. Final exam (pcert-l32) additionally renders the
// certification-issuance envelope on a passing attempt.
// ============================================================================

import { Suspense } from "react";

import QuizPageClient from "@/src/portal/training/certified/quiz/QuizPageClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[640px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading quiz…
        </div>
      }
    >
      <QuizPageClient />
    </Suspense>
  );
}
