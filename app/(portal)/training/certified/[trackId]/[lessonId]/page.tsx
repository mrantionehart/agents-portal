// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — /training/certified/[trackId]/[lessonId]
// ============================================================================
// Server shell that renders the unified lesson page. The client component
// fetches catalog + progress from Vault and dispatches activity components
// per the lesson's requirement configuration.
// ============================================================================

import { Suspense } from "react";

import UnifiedLessonClient from "@/src/portal/training/certified/UnifiedLessonClient";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ trackId: string; lessonId: string }>;
}) {
  const { trackId, lessonId } = await params;
  return (
    <Suspense
      fallback={
        <div className="max-w-[720px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading lesson…
        </div>
      }
    >
      <UnifiedLessonClient trackId={trackId} lessonId={lessonId} />
    </Suspense>
  );
}
