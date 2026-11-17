// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — /training/certified/[trackId]/[lessonId]
// ============================================================================
// Server shell that renders the unified lesson page. The client component
// fetches catalog + progress from Vault and dispatches activity components
// per the lesson's requirement configuration.
// ============================================================================

import { Suspense } from "react";

import UnifiedLessonClient from "@/src/portal/training/certified/UnifiedLessonClient";
import { resolveProgramParam } from "@/src/portal/training/certified/program";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ trackId: string; lessonId: string }>;
  searchParams?: Promise<{ program?: string | string[] }>;
}) {
  // Allowlisted program selector. Unknown → not found (never another program).
  const rawProgram = (await searchParams)?.program;
  const certificationId = resolveProgramParam(Array.isArray(rawProgram) ? rawProgram[0] : rawProgram);
  if (!certificationId) {
    return (
      <div className="max-w-[720px] mx-auto rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300" data-cert-unknown-program>
        This training is not available.
      </div>
    );
  }
  const { trackId, lessonId } = await params;
  return (
    <Suspense
      fallback={
        <div className="max-w-[720px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading lesson…
        </div>
      }
    >
      <UnifiedLessonClient certificationId={certificationId} trackId={trackId} lessonId={lessonId} />
    </Suspense>
  );
}
