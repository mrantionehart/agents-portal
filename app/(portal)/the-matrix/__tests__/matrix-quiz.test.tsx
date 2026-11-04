/**
 * Matrix Knowledge Quiz — real rendering + authorization tests.
 * Runner: jest + @testing-library/react (AP standard).
 */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

// Mock only the two network functions; keep the REAL CertApiError so
// `instanceof` and `new CertApiError(...)` behave exactly as in production.
jest.mock("@/src/portal/training/certified/api", () => {
  const actual = jest.requireActual("@/src/portal/training/certified/api");
  return {
    ...actual,
    fetchLearnerSafeQuiz: jest.fn(),
    submitQuizAttempt: jest.fn(),
  };
});

// Control the feature flag per test.
jest.mock("../_lib/matrix-flags", () => ({
  matrixSimulatorEnabled: jest.fn(() => true),
}));

import {
  fetchLearnerSafeQuiz,
  submitQuizAttempt,
  CertApiError,
} from "@/src/portal/training/certified/api";
import { matrixSimulatorEnabled } from "../_lib/matrix-flags";
import { MatrixKnowledgeQuiz } from "../_components/matrix-quiz";

const mockedFetch = fetchLearnerSafeQuiz as jest.Mock;
const mockedSubmit = submitQuizAttempt as jest.Mock;
const mockedFlag = matrixSimulatorEnabled as jest.Mock;

function makeQuiz(nQuestions = 3) {
  return {
    quiz: {
      quizId: "hartfelt-matrix-rental.knowledge.v1",
      quizVersion: "1.0.0",
      title: "Matrix Rental — Knowledge",
      instructions: null,
      questions: Array.from({ length: nQuestions }, (_, i) => ({
        id: `q${String(i + 1).padStart(2, "0")}`,
        prompt: `Question ${i + 1} prompt?`,
        options: [
          { id: "a", label: `Option A for ${i + 1}` },
          { id: "b", label: `Option B for ${i + 1}` },
        ],
      })),
      passingRule: { kind: "threshold", thresholdPercent: 85 },
      retryPolicy: {
        maxAttempts: 3,
        attemptCountScope: "cert_version",
        passIsPermanentForCertVersion: true,
        revealAnswersAfterAttempt: false,
      },
    },
    mode: "learner",
    moduleStatus: "published",
  };
}

function result(overrides: Record<string, unknown> = {}, issuance: unknown = null) {
  return {
    result: {
      attempt_id: "att-1",
      quizId: "hartfelt-matrix-rental.knowledge.v1",
      quizVersion: "1.0.0",
      totalCount: 3,
      correctCount: 3,
      scorePercent: 100,
      passed: true,
      attemptNumber: 1,
      attemptsRemaining: 2,
      outcome: "passed",
      ...overrides,
    },
    status: "graded",
    certification_issuance: issuance,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedFlag.mockReturnValue(true);
});

describe("MatrixKnowledgeQuiz", () => {
  it("renders the 20-question-style assessment with options and a submit control (entry + primary action)", async () => {
    mockedFetch.mockResolvedValue(makeQuiz(3));
    render(<MatrixKnowledgeQuiz />);

    await screen.findByText("Matrix Rental — Knowledge");
    expect(screen.getByText(/Passing score: 85%/)).toBeInTheDocument();
    expect(document.querySelectorAll("[data-matrix-quiz-question]")).toHaveLength(3);
    // Primary action visible but DISABLED until all answered.
    const submitBtn = document.querySelector("[data-matrix-quiz-submit]") as HTMLButtonElement;
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn.disabled).toBe(true);
  });

  it("never renders an answer key in the DOM (options carry no correctness marker)", async () => {
    mockedFetch.mockResolvedValue(makeQuiz(2));
    render(<MatrixKnowledgeQuiz />);
    await screen.findByText("Matrix Rental — Knowledge");
    const opts = Array.from(document.querySelectorAll("[data-matrix-quiz-option]"));
    expect(opts.length).toBeGreaterThan(0);
    for (const el of opts) {
      // option id is present, but nothing marks correctness
      expect(el.getAttribute("data-correct")).toBeNull();
      expect(el.getAttribute("data-is-correct")).toBeNull();
    }
    // The learner-safe payload we got has no `correctOptionId` anywhere.
    expect(JSON.stringify(mockedFetch.mock.results)).not.toContain("correctOptionId");
  });

  it("enables submit once every question is answered, submits with the Matrix cert, and shows a pass result", async () => {
    mockedFetch.mockResolvedValue(makeQuiz(2));
    mockedSubmit.mockResolvedValue(result({ totalCount: 2, correctCount: 2 }));
    render(<MatrixKnowledgeQuiz />);
    await screen.findByText("Matrix Rental — Knowledge");

    for (const q of document.querySelectorAll("[data-matrix-quiz-question]")) {
      const firstRadio = q.querySelector("input[type=radio]") as HTMLInputElement;
      fireEvent.click(firstRadio);
    }
    const submitBtn = document.querySelector("[data-matrix-quiz-submit]") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(document.querySelector('[data-matrix-quiz-result="passed"]')).toBeInTheDocument(),
    );
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
    const arg = mockedSubmit.mock.calls[0][0];
    expect(arg.certificationId).toBe("hartfelt-matrix-rental-practical");
    expect(arg.lessonId).toBe("mr-l0101");
    expect(arg.submission.quiz_id).toBe("hartfelt-matrix-rental.knowledge.v1");
  });

  it("shows critical-error feedback when a high score still fails (critical miss), without naming the item", async () => {
    mockedFetch.mockResolvedValue(makeQuiz(2));
    mockedSubmit.mockResolvedValue(
      result({ passed: false, outcome: "failed", scorePercent: 95, correctCount: 19, totalCount: 20, attemptsRemaining: 1 }),
    );
    render(<MatrixKnowledgeQuiz />);
    await screen.findByText("Matrix Rental — Knowledge");
    for (const q of document.querySelectorAll("[data-matrix-quiz-question]")) {
      fireEvent.click(q.querySelector("input[type=radio]") as HTMLInputElement);
    }
    fireEvent.click(document.querySelector("[data-matrix-quiz-submit]") as HTMLButtonElement);

    const critical = await waitFor(() => {
      const el = document.querySelector("[data-matrix-quiz-critical]");
      if (!el) throw new Error("no critical panel yet");
      return el as HTMLElement;
    });
    expect(within(critical).getByText(/critical error fails the assessment/i)).toBeInTheDocument();
    // A retake is offered since attempts remain.
    expect(document.querySelector("[data-matrix-quiz-retake]")).toBeInTheDocument();
  });

  it("renders the issuance block when the attempt response carries a certification issuance", async () => {
    mockedFetch.mockResolvedValue(makeQuiz(1));
    mockedSubmit.mockResolvedValue(
      result({ totalCount: 1, correctCount: 1 }, {
        issuance_id: "iss-123",
        certification_id: "hartfelt-matrix-rental-practical",
        certification_version: "1.0.0",
        issued_at: new Date().toISOString(),
      }),
    );
    render(<MatrixKnowledgeQuiz />);
    await screen.findByText("Matrix Rental — Knowledge");
    fireEvent.click(document.querySelector("input[type=radio]") as HTMLInputElement);
    fireEvent.click(document.querySelector("[data-matrix-quiz-submit]") as HTMLButtonElement);
    await waitFor(() =>
      expect(document.querySelector("[data-matrix-quiz-issuance]")).toBeInTheDocument(),
    );
    expect(screen.getByText("iss-123")).toBeInTheDocument();
  });

  it("DENIED: an un-assigned learner (Vault 404) sees a no-access state, not the quiz", async () => {
    mockedFetch.mockRejectedValue(new CertApiError("Not found", 404, null, { error: "Not found" }));
    render(<MatrixKnowledgeQuiz />);
    await waitFor(() =>
      expect(document.querySelector("[data-matrix-quiz-no-access]")).toBeInTheDocument(),
    );
    expect(screen.getByText(/only to agents\s+assigned the Matrix Rental certification/i)).toBeInTheDocument();
    expect(document.querySelector("[data-matrix-quiz-active]")).toBeNull();
  });

  it("renders a coming-soon state (no network) when the feature flag is off", async () => {
    mockedFlag.mockReturnValue(false);
    render(<MatrixKnowledgeQuiz />);
    expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
