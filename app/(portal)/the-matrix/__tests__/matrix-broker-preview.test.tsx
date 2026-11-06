// Broker PREVIEW mode for the Matrix simulator (jest + RTL). Proves the broker
// runs the SAME components against the write-nothing preview endpoints: the
// preview banner shows, the practical scores + shows a per-field answer review,
// the quiz scores + shows a per-question answer review, and the learner WRITE
// path (submitAttempt / saveDraft) is NEVER called in preview.

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const prepareExercise = jest.fn();
const saveDraft = jest.fn();
const submitAttempt = jest.fn();
const previewPrepareExercise = jest.fn();
const previewSubmit = jest.fn();
const previewFetchQuiz = jest.fn();
const previewSubmitQuiz = jest.fn();

jest.mock("@/lib/matrix/vault-matrix-client", () => ({
  __esModule: true,
  prepareExercise: (...a: unknown[]) => prepareExercise(...a),
  saveDraft: (...a: unknown[]) => saveDraft(...a),
  submitAttempt: (...a: unknown[]) => submitAttempt(...a),
  previewPrepareExercise: (...a: unknown[]) => previewPrepareExercise(...a),
  previewSubmit: (...a: unknown[]) => previewSubmit(...a),
  previewFetchQuiz: (...a: unknown[]) => previewFetchQuiz(...a),
  previewSubmitQuiz: (...a: unknown[]) => previewSubmitQuiz(...a),
  MatrixApiError: class MatrixApiError extends Error {
    notEnabled = false; code: string | null = null; fieldErrors?: Record<string, string>;
  },
}));

import { MatrixExperience } from "../_components/matrix-experience";
import { MatrixKnowledgeQuiz } from "../_components/matrix-quiz";

const F = "NEXT_PUBLIC_MATRIX_SIMULATOR_ENABLED";
const prev = process.env[F];
beforeEach(() => { process.env[F] = "true"; });
afterEach(() => { if (prev === undefined) delete process.env[F]; else process.env[F] = prev; jest.clearAllMocks(); });

const PREPARED = {
  attemptId: "preview:matrix-fl-rental-a1",
  scenarioId: "matrix-fl-rental-a1",
  scenarioLabel: "Miami-Dade Condo — Annual Lease",
  briefing: "Correct the prior agent's draft.",
  fields: [
    { id: "classification", label: "Classification", type: "enum", required: true, options: ["Residential Rental", "Residential Sale"] },
  ],
  values: { classification: "Residential Sale" },
  hints: [{ fieldId: "classification", hint: "This listing is an annual rental." }],
};

describe("MatrixExperience — broker preview (write-nothing)", () => {
  it("shows the preview banner, scores, shows the answer review, and NEVER calls the learner write path", async () => {
    previewPrepareExercise.mockResolvedValue(PREPARED);
    previewSubmit.mockResolvedValue({
      preview: true, scorePct: 50, passed: false, criticalErrorCount: 1,
      coaching: [{ fieldId: "classification", label: "Classification", critical: true }],
      review: [
        { fieldId: "classification", label: "Classification", expected: "Residential Rental", actual: "Residential Sale", correct: false, critical: true },
      ],
    });

    render(<MatrixExperience preview />);
    expect(screen.getByTestId("matrix-preview-banner")).toBeInTheDocument();

    // Start the rental module → preview prepare (not the learner prepare).
    fireEvent.click(screen.getByLabelText(/start module a/i));
    await waitFor(() => expect(screen.getByText(/annual lease/i)).toBeInTheDocument());
    expect(previewPrepareExercise).toHaveBeenCalled();
    expect(prepareExercise).not.toHaveBeenCalled();

    // Score (preview) — no "Submit for Review", no Save affordance.
    expect(screen.queryByRole("button", { name: /submit for review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save incomplete/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /score \(preview\)/i }));

    await waitFor(() => expect(screen.getByTestId("matrix-preview-result")).toBeInTheDocument());
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-preview-answer-review")).toHaveTextContent(/expected/i);
    expect(screen.getByRole("button", { name: /reset preview/i })).toBeInTheDocument();

    // The learner write path was never touched.
    expect(previewSubmit).toHaveBeenCalledWith("matrix-fl-rental-a1", expect.any(Object));
    expect(submitAttempt).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
  });
});

describe("MatrixKnowledgeQuiz — broker preview (write-nothing)", () => {
  const QUIZ = {
    quizId: "hartfelt-matrix-fl.knowledge.v1", quizVersion: "1.0.0", title: "Matrix Knowledge",
    questions: [
      { id: "q01", kind: "single", prompt: "Pass bar?", options: [{ id: "a", label: "Any critical errors ok" }, { id: "b", label: "85% and zero critical" }] },
    ],
  };
  it("shows the banner, scores via the preview endpoint, and shows a per-question answer review", async () => {
    previewFetchQuiz.mockResolvedValue({ quiz: QUIZ, mode: "preview" });
    previewSubmitQuiz.mockResolvedValue({
      preview: true,
      result: { quizId: QUIZ.quizId, quizVersion: "1.0.0", totalCount: 1, correctCount: 0, scorePercent: 0, passed: false },
      review: [{ id: "q01", prompt: "Pass bar?", correctOptionId: "b", chosenOptionId: "a", correct: false }],
      quiz: QUIZ,
    });

    render(<MatrixKnowledgeQuiz preview />);
    expect(screen.getByTestId("matrix-quiz-preview-banner")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("matrix-quiz-preview-active")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/any critical errors ok/i));
    fireEvent.click(screen.getByTestId("matrix-quiz-preview-submit"));

    await waitFor(() => expect(screen.getByTestId("matrix-quiz-preview-result")).toBeInTheDocument());
    expect(screen.getByText("0%")).toBeInTheDocument();
    const review = screen.getByTestId("matrix-quiz-preview-answer-review");
    expect(review).toHaveTextContent(/correct:/i);
    expect(review).toHaveTextContent(/85% and zero critical/i); // the correct option label is shown
  });
});
