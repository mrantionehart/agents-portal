// ============================================================================
// Matrix Simulator — Knowledge Quiz page (Agent Portal)
// ============================================================================
"use client";

import { useSearchParams } from "next/navigation";
import { MatrixKnowledgeQuiz, MatrixQuizBackLink } from "../_components/matrix-quiz";
import { MatrixPreviewGate } from "../_components/matrix-preview-gate";

export default function MatrixQuizPage() {
  const preview = useSearchParams().get("preview") === "1";
  return (
    <div className="mx-auto w-full max-w-2xl">
      <MatrixQuizBackLink />
      {preview ? (
        <MatrixPreviewGate>
          <MatrixKnowledgeQuiz preview />
        </MatrixPreviewGate>
      ) : (
        <MatrixKnowledgeQuiz />
      )}
    </div>
  );
}
