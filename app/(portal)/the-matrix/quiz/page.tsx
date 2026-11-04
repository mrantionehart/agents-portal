// ============================================================================
// Matrix Simulator — Knowledge Quiz page (Agent Portal)
// ============================================================================
"use client";

import { MatrixKnowledgeQuiz, MatrixQuizBackLink } from "../_components/matrix-quiz";

export default function MatrixQuizPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <MatrixQuizBackLink />
      <MatrixKnowledgeQuiz />
    </div>
  );
}
