// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — /training/checklist page (Gate B)
// ============================================================================
// The checklist reflection activity for all 14 Family B checklist lessons.
// Query params:
//   ?lesson=<pcert-lXX>&activity=scenario&evaluator_key=<key>&criterion_version=<v>
// After the session is created, the URL is rewritten to `?session=<id>`.
// ============================================================================

import { Suspense } from "react";

import ChecklistPageClient from "@/src/portal/training/certified/checklist/ChecklistPageClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[640px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading checklist…
        </div>
      }
    >
      <ChecklistPageClient />
    </Suspense>
  );
}
