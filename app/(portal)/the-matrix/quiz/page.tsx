// ============================================================================
// Matrix Simulator — Knowledge Quiz page (Agent Portal)
// ============================================================================
"use client";

import { useSearchParams } from "next/navigation";
import { MatrixKnowledgeQuiz, MatrixQuizBackLink } from "../_components/matrix-quiz";

export default function MatrixQuizPage() {
  const preview = useSearchParams().get("preview") === "1";
  return (
    <div className="mx-auto w-full max-w-2xl">
      <MatrixQuizBackLink />
      <MatrixKnowledgeQuiz preview={preview} />
    </div>
  );
}
