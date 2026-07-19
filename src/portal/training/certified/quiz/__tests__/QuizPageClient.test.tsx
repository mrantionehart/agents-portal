// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — QuizPageClient integration test
// ============================================================================
// Covers: learner-safe fetch → submit → graded / already_passed / attempt-cap;
// issuance envelope renders ONLY for pcert-l32; duplicate submission is
// disabled while a request is pending; the projection has no answer leakage;
// progress refresh happens via the return-to-lesson link (server owns the
// truth — this client never mutates progress locally).
// ============================================================================

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};
const mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/src/portal/training/certified/api", () => {
  class CertApiError extends Error {
    status: number;
    code: string | null;
    detail: unknown;
    constructor(message: string, status: number, code: string | null, detail: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.detail = detail;
    }
  }
  return {
    fetchCatalog: jest.fn(),
    fetchLearnerSafeQuiz: jest.fn(),
    submitQuizAttempt: jest.fn(),
    CertApiError,
  };
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import QuizPageClient from "../QuizPageClient";
import * as api from "@/src/portal/training/certified/api";
import type { CertifiedCatalog, QuizGetResponse } from "../../types";

const fetchCatalog = api.fetchCatalog as jest.MockedFunction<typeof api.fetchCatalog>;
const fetchLearnerSafeQuiz = api.fetchLearnerSafeQuiz as jest.MockedFunction<typeof api.fetchLearnerSafeQuiz>;
const submitQuizAttempt = api.submitQuizAttempt as jest.MockedFunction<typeof api.submitQuizAttempt>;
const { CertApiError } = api as unknown as { CertApiError: new (m: string, s: number, c: string | null, d: unknown) => Error & { status: number; code: string | null; detail: unknown } };

// ─── Fixtures ──────────────────────────────────────────────────────────────

function catalogWith(lessonId: string, trackId: string): CertifiedCatalog {
  return {
    certification_id: "hartfelt-platform-certified",
    version: "1.0.0",
    tracks: [
      {
        id: trackId,
        module_num: 6,
        sort_order: 406,
        title: "Certification",
        description: null,
        status: "published" as const,
        requires_recert: false,
        version: "1.0.0",
        lessons: [
          {
            id: lessonId,
            module_id: trackId,
            video_num: "1",
            sort_order: 1,
            title: `${lessonId} title`,
            description: null,
            objective_md: null,
            duration_seconds: null,
            practical_attestation_type: "none",
            requires_quiz: true,
            quiz_id: null,
            related_route: null,
            prerequisite_lesson_id: null,
            media_status: "ok",
            has_media: false,
            system: "portal",
            requirements: ["quiz"],
            session_ui_spec: null,
            practical_ui_spec: null,
          },
        ],
      },
    ],
  };
}

const learnerSafeQuiz: QuizGetResponse = {
  quiz: {
    quizId: "platform-cert.pcert-l32.final-exam",
    quizVersion: "1",
    title: "Final Certification Exam",
    passingScore: 85,
    attemptCap: 3,
    questions: [
      {
        id: "q1",
        prompt: "Which of these ships the projection?",
        options: [
          { id: "opt-a", text: "The Vault catalog" },
          { id: "opt-b", text: "The AP renderer" },
          { id: "opt-c", text: "The tour engine" },
        ],
      },
      {
        id: "q2",
        prompt: "When does issuance fire?",
        options: [
          { id: "opt-a", text: "On tour completion" },
          { id: "opt-b", text: "On a passing pcert-l32 attempt" },
          { id: "opt-c", text: "On lesson unlock" },
        ],
      },
    ],
  },
  mode: "learner",
  moduleStatus: "published",
};

function setSearchParams(params: Record<string, string>) {
  for (const key of Array.from(mockSearchParams.keys())) mockSearchParams.delete(key);
  for (const [k, v] of Object.entries(params)) mockSearchParams.set(k, v);
}

beforeEach(() => {
  fetchCatalog.mockReset();
  fetchLearnerSafeQuiz.mockReset();
  submitQuizAttempt.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.push.mockReset();
  for (const key of Array.from(mockSearchParams.keys())) mockSearchParams.delete(key);
});

// ─── Load learner-safe quiz ────────────────────────────────────────────────

describe("QuizPageClient — learner-safe fetch", () => {
  it("renders questions + options in the order the server returned", async () => {
    setSearchParams({ lesson: "pcert-l32" });
    fetchCatalog.mockResolvedValue(catalogWith("pcert-l32", "pcert-t06"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);

    render(<QuizPageClient />);

    await waitFor(() =>
      expect(document.querySelector("[data-cert-quiz-active]")).not.toBeNull(),
    );

    // Two questions rendered.
    const questions = document.querySelectorAll("[data-cert-quiz-question]");
    expect(questions.length).toBe(2);
    // Options rendered in server-returned order.
    const q1Options = questions[0].querySelectorAll("[data-cert-quiz-option]");
    expect(q1Options.length).toBe(3);
    expect(q1Options[0].getAttribute("data-cert-quiz-option")).toBe("opt-a");
    expect(q1Options[1].getAttribute("data-cert-quiz-option")).toBe("opt-b");
    expect(q1Options[2].getAttribute("data-cert-quiz-option")).toBe("opt-c");
  });

  it("verifies the projection has NO answer-key markers anywhere in the rendered DOM", async () => {
    setSearchParams({ lesson: "pcert-l32" });
    fetchCatalog.mockResolvedValue(catalogWith("pcert-l32", "pcert-t06"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);

    render(<QuizPageClient />);

    await waitFor(() =>
      expect(document.querySelector("[data-cert-quiz-active]")).not.toBeNull(),
    );

    const rendered = document.body.textContent ?? "";
    expect(rendered).not.toContain("correctOptionId");
    expect(rendered).not.toContain("correctChoiceId");
    expect(rendered).not.toContain("explanationOnSubmit");
    expect(rendered).not.toContain("answer_key");
    // The mocked projection had none — verify the projection surface itself.
    expect(JSON.stringify(learnerSafeQuiz)).not.toContain("correctOptionId");
  });

  it("labels the header 'Final Exam' when the lesson id is pcert-l32", async () => {
    setSearchParams({ lesson: "pcert-l32" });
    fetchCatalog.mockResolvedValue(catalogWith("pcert-l32", "pcert-t06"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);

    render(<QuizPageClient />);
    await waitFor(() =>
      expect(screen.getByText(/^Final Exam$/)).toBeInTheDocument(),
    );
  });
});

// ─── Submit ───────────────────────────────────────────────────────────────

describe("QuizPageClient — submit", () => {
  it("disables Submit until every question has an answer", async () => {
    setSearchParams({ lesson: "pcert-l32" });
    fetchCatalog.mockResolvedValue(catalogWith("pcert-l32", "pcert-t06"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);

    render(<QuizPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-quiz-active]")).not.toBeNull(),
    );

    const submit = document.querySelector<HTMLButtonElement>(
      "[data-cert-quiz-submit]",
    )!;
    expect(submit.disabled).toBe(true);

    // Answer only one question.
    const q1OptA = document.querySelector<HTMLInputElement>(
      '[data-cert-quiz-option="opt-a"]',
    )!;
    fireEvent.click(q1OptA);
    expect(submit.disabled).toBe(true);

    // Answer the second.
    const q2OptB = document.querySelectorAll<HTMLInputElement>(
      '[data-cert-quiz-option="opt-b"]',
    )[1]!; // second question's opt-b
    fireEvent.click(q2OptB);
    expect(submit.disabled).toBe(false);
  });

  it("prevents duplicate submission while a request is pending", async () => {
    setSearchParams({ lesson: "pcert-l32" });
    fetchCatalog.mockResolvedValue(catalogWith("pcert-l32", "pcert-t06"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);

    // Hold the submission promise open until we release it manually.
    let resolveSubmit: ((value: Awaited<ReturnType<typeof submitQuizAttempt>>) => void) | null = null;
    submitQuizAttempt.mockImplementation(
      () =>
        new Promise((res) => {
          resolveSubmit = res;
        }),
    );

    render(<QuizPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-quiz-active]")).not.toBeNull(),
    );

    // Answer both questions.
    const q1 = document.querySelector<HTMLInputElement>(
      '[data-cert-quiz-option="opt-a"]',
    )!;
    const q2 = document.querySelectorAll<HTMLInputElement>(
      '[data-cert-quiz-option="opt-b"]',
    )[1]!;
    fireEvent.click(q1);
    fireEvent.click(q2);

    const submit = document.querySelector<HTMLButtonElement>(
      "[data-cert-quiz-submit]",
    )!;
    await act(async () => {
      fireEvent.click(submit);
    });

    // Now submit should be disabled (busy state) and calling click again
    // should not trigger a second call.
    expect(submit.disabled).toBe(true);
    expect(submitQuizAttempt).toHaveBeenCalledTimes(1);
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(submitQuizAttempt).toHaveBeenCalledTimes(1);

    // Release the promise and let the test finish gracefully.
    if (resolveSubmit) {
      await act(async () => {
        resolveSubmit!({
          result: {
            attempt_id: "att-1",
            score: 100,
            passed: true,
            correct_count: 2,
            total_count: 2,
            retry_allowed_at: null,
          },
          status: "graded",
          certification_issuance: null,
        });
      });
    }
  });
});

// ─── Graded / already_passed ──────────────────────────────────────────────

describe("QuizPageClient — result envelope", () => {
  async function submitAll(lessonId: string, response: Awaited<ReturnType<typeof submitQuizAttempt>>) {
    setSearchParams({ lesson: lessonId });
    fetchCatalog.mockResolvedValue(catalogWith(lessonId, "pcert-t06"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);
    submitQuizAttempt.mockResolvedValue(response);

    render(<QuizPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-quiz-active]")).not.toBeNull(),
    );

    // Pick both answers + submit.
    const q1 = document.querySelector<HTMLInputElement>(
      '[data-cert-quiz-option="opt-a"]',
    )!;
    const q2 = document.querySelectorAll<HTMLInputElement>(
      '[data-cert-quiz-option="opt-b"]',
    )[1]!;
    fireEvent.click(q1);
    fireEvent.click(q2);

    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>(
        "[data-cert-quiz-submit]",
      )!);
    });
  }

  it("renders the passed score card on 'graded' + passed:true", async () => {
    await submitAll("pcert-l12", {
      result: {
        attempt_id: "att-1",
        score: 90,
        passed: true,
        correct_count: 9,
        total_count: 10,
        retry_allowed_at: null,
      },
      status: "graded",
      certification_issuance: null,
    });
    await waitFor(() =>
      expect(document.querySelector('[data-cert-quiz-result="passed"]')).not.toBeNull(),
    );
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("renders the failed card on 'graded' + passed:false and offers Retake", async () => {
    await submitAll("pcert-l12", {
      result: {
        attempt_id: "att-1",
        score: 60,
        passed: false,
        correct_count: 6,
        total_count: 10,
        retry_allowed_at: "2026-07-19T13:00:00Z",
      },
      status: "graded",
      certification_issuance: null,
    });
    await waitFor(() =>
      expect(document.querySelector('[data-cert-quiz-result="failed"]')).not.toBeNull(),
    );
    expect(screen.getByRole("button", { name: /retake quiz/i })).toBeInTheDocument();
  });

  it("renders the passed card on 'already_passed' (idempotent server response)", async () => {
    await submitAll("pcert-l12", {
      result: {
        attempt_id: "att-1",
        score: 100,
        passed: true,
        correct_count: 10,
        total_count: 10,
        retry_allowed_at: null,
      },
      status: "already_passed",
      certification_issuance: null,
    });
    await waitFor(() =>
      expect(document.querySelector('[data-cert-quiz-result="passed"]')).not.toBeNull(),
    );
    // Retake button is only for failed attempts.
    expect(screen.queryByRole("button", { name: /retake quiz/i })).toBeNull();
  });
});

// ─── Final-exam issuance ──────────────────────────────────────────────────

describe("QuizPageClient — final-exam issuance block", () => {
  const passedFinalPayload = {
    result: {
      attempt_id: "att-final",
      score: 100,
      passed: true,
      correct_count: 2,
      total_count: 2,
      retry_allowed_at: null,
    },
    status: "graded" as const,
    certification_issuance: {
      issuance_id: "iss-42",
      certification_id: "hartfelt-platform-certified",
      certification_version: "1.0.0",
      issued_at: "2026-07-19T12:00:00.000Z",
    },
  };

  async function submitAll(lessonId: string, response: Awaited<ReturnType<typeof submitQuizAttempt>>) {
    setSearchParams({ lesson: lessonId });
    fetchCatalog.mockResolvedValue(catalogWith(lessonId, "pcert-t06"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);
    submitQuizAttempt.mockResolvedValue(response);
    render(<QuizPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-quiz-active]")).not.toBeNull(),
    );
    const q1 = document.querySelector<HTMLInputElement>(
      '[data-cert-quiz-option="opt-a"]',
    )!;
    const q2 = document.querySelectorAll<HTMLInputElement>(
      '[data-cert-quiz-option="opt-b"]',
    )[1]!;
    fireEvent.click(q1);
    fireEvent.click(q2);
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>(
        "[data-cert-quiz-submit]",
      )!);
    });
  }

  it("renders the issuance envelope on a passing pcert-l32 attempt", async () => {
    await submitAll("pcert-l32", passedFinalPayload);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-issuance-block]")).not.toBeNull(),
    );
    expect(screen.getByText(/certification issued/i)).toBeInTheDocument();
    expect(screen.getByText("iss-42")).toBeInTheDocument();
  });

  it("does NOT render the issuance envelope for a NON-final-exam pass, even if server returns one", async () => {
    // Server would not normally do this, but defensively verify.
    await submitAll("pcert-l12", passedFinalPayload);
    await waitFor(() =>
      expect(document.querySelector('[data-cert-quiz-result="passed"]')).not.toBeNull(),
    );
    expect(document.querySelector("[data-cert-issuance-block]")).toBeNull();
  });

  it("does NOT render the issuance block when the final-exam response has null certification_issuance", async () => {
    await submitAll("pcert-l32", {
      ...passedFinalPayload,
      certification_issuance: null,
    });
    await waitFor(() =>
      expect(document.querySelector('[data-cert-quiz-result="passed"]')).not.toBeNull(),
    );
    expect(document.querySelector("[data-cert-issuance-block]")).toBeNull();
  });
});

// ─── Attempt cap ──────────────────────────────────────────────────────────

describe("QuizPageClient — attempt cap reached", () => {
  it("surfaces a friendly ceiling notice on 429 attempt_cap_reached", async () => {
    setSearchParams({ lesson: "pcert-l32" });
    fetchCatalog.mockResolvedValue(catalogWith("pcert-l32", "pcert-t06"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);
    submitQuizAttempt.mockRejectedValue(
      new CertApiError(
        "attempt cap reached",
        429,
        "attempt_cap_reached",
        null,
      ),
    );

    render(<QuizPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-quiz-active]")).not.toBeNull(),
    );

    const q1 = document.querySelector<HTMLInputElement>(
      '[data-cert-quiz-option="opt-a"]',
    )!;
    const q2 = document.querySelectorAll<HTMLInputElement>(
      '[data-cert-quiz-option="opt-b"]',
    )[1]!;
    fireEvent.click(q1);
    fireEvent.click(q2);
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>(
        "[data-cert-quiz-submit]",
      )!);
    });

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /used all attempts/i,
      ),
    );
  });
});

// ─── Progress refresh via return link ─────────────────────────────────────

describe("QuizPageClient — progress refresh + return", () => {
  it("provides a Return-to-lesson link back to the certified lesson page (progress refetch happens there)", async () => {
    setSearchParams({ lesson: "pcert-l12" });
    fetchCatalog.mockResolvedValue(catalogWith("pcert-l12", "pcert-t03"));
    fetchLearnerSafeQuiz.mockResolvedValue(learnerSafeQuiz);
    submitQuizAttempt.mockResolvedValue({
      result: {
        attempt_id: "att-1",
        score: 100,
        passed: true,
        correct_count: 2,
        total_count: 2,
        retry_allowed_at: null,
      },
      status: "graded",
      certification_issuance: null,
    });

    render(<QuizPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-quiz-active]")).not.toBeNull(),
    );
    const q1 = document.querySelector<HTMLInputElement>(
      '[data-cert-quiz-option="opt-a"]',
    )!;
    const q2 = document.querySelectorAll<HTMLInputElement>(
      '[data-cert-quiz-option="opt-b"]',
    )[1]!;
    fireEvent.click(q1);
    fireEvent.click(q2);
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>(
        "[data-cert-quiz-submit]",
      )!);
    });
    await waitFor(() =>
      expect(document.querySelector('[data-cert-quiz-submitted]')).not.toBeNull(),
    );
    const returnLink = screen.getByRole("link", { name: /return to lesson/i });
    expect(returnLink.getAttribute("href")).toBe(
      "/training/certified/pcert-t03/pcert-l12",
    );
  });
});
