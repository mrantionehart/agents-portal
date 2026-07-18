// ============================================================================
// V4 TRAINING MODE — /training/wizard page
// ============================================================================
// The route the transaction-wizard practice activity mounts at. Thin
// server-agnostic wrapper — the whole lifecycle lives in the client
// component `TrainingWizardPage`.
//
// Query params expected on the FIRST arrival (creates a session):
//   ?lesson=<lessonId>&activity=<activityType>&evaluator_key=<key>
//   &criterion_version=<version>
//   (optional: &certification=<id>&version=<v> — defaults to
//    hartfelt-platform-certified / 1.0.0)
//
// After the session is created, the page router.replace()'s the URL to:
//   /training/wizard?session=<sessionId>
// so refresh + back/forward + share-a-link all resume that session.
// ============================================================================

import { Suspense } from "react";

import TrainingWizardPage from "../../../../src/portal/training/wizard/TrainingWizardPage";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[540px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading training session…
        </div>
      }
    >
      <TrainingWizardPage />
    </Suspense>
  );
}
