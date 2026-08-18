/**
 * @jest-environment node
 */
// ============================================================================
// AP-QUIZ-CONTRACT — the Agent Portal is pinned to Vault's real quiz contract
// ============================================================================
// The V4 quiz was never submittable in production: the portal's type invented
// `passingScore` / `attemptCap` (Vault sends `passingRule.thresholdPercent` and
// `retryPolicy.maxAttempts`), read `option.text` (Vault sends `label`), and
// submitted camelCase identity with an answers ARRAY (Vault validates
// snake_case with an answers MAP). Every submission was rejected with
// "quiz_id required".
//
// It went unnoticed because the portal's own tests asserted against a fixture
// the portal invented. THIS file uses a fixture transcribed from Vault's actual
// LearnerSafeQuiz projection, so the two cannot drift apart silently again.
//
// Vault source of truth:
//   src/lib/platform-certification/quiz-contracts.ts  (LearnerSafeQuiz,
//     QuizPassingRule, QuizRetryPolicy, LearnerSafeQuizResult)
//   src/app/api/platform/certifications/[c]/lessons/[l]/quiz/attempt/route.ts
//     (validates body.quiz_id / body.quiz_version / body.answers as an object)
// ============================================================================
import { describeQuizContractProblem } from "@/src/portal/training/certified/quiz/QuizPageClient";
import type {
  LearnerSafeQuiz,
  QuizAttemptSubmission,
  QuizAttemptResult,
} from "@/src/portal/training/certified/types";

/** Transcribed from Vault's projectLearnerSafeQuiz() output. */
const VAULT_QUIZ_PAYLOAD = {
  quiz: {
    quizId: "platform-cert.pcert-l12.required-optional-blocked",
    quizVersion: "1",
    title: "Required, Optional, and Blocked Forms",
    instructions: null,
    questions: [
      {
        id: "q1",
        kind: "single_choice",
        prompt: "A form is marked required. What does that tell you?",
        options: [
          { id: "cannot-advance-without", label: "The deal cannot advance without it" },
          { id: "nice-to-have", label: "It is nice to have" },
        ],
      },
    ],
    passingRule: { kind: "percentage_threshold", thresholdPercent: 80 },
    retryPolicy: {
      maxAttempts: 3,
      attemptCountScope: "per_certification_version",
      passIsPermanentForCertVersion: true,
      revealAnswersAfterAttempt: false,
    },
  },
  mode: "learner",
  moduleStatus: "published",
} as const;

describe("GET — the portal type accepts Vault's real payload", () => {
  it("assigns without widening or casting", () => {
    const quiz: LearnerSafeQuiz = VAULT_QUIZ_PAYLOAD.quiz;
    expect(quiz.quizId).toBe("platform-cert.pcert-l12.required-optional-blocked");
    expect(quiz.quizVersion).toBe("1");
  });

  it("reads the threshold from passingRule, not a legacy passingScore", () => {
    const quiz: LearnerSafeQuiz = VAULT_QUIZ_PAYLOAD.quiz;
    expect(quiz.passingRule.thresholdPercent).toBe(80);
    expect(quiz as unknown as Record<string, unknown>).not.toHaveProperty("passingScore");
  });

  it("reads the attempt cap from retryPolicy, not a legacy attemptCap", () => {
    const quiz: LearnerSafeQuiz = VAULT_QUIZ_PAYLOAD.quiz;
    expect(quiz.retryPolicy.maxAttempts).toBe(3);
    expect(quiz as unknown as Record<string, unknown>).not.toHaveProperty("attemptCap");
  });

  it("reads option text from `label` — `text` is not part of the contract", () => {
    const opt = VAULT_QUIZ_PAYLOAD.quiz.questions[0].options[0];
    expect(opt.label).toBe("The deal cannot advance without it");
    expect(opt as unknown as Record<string, unknown>).not.toHaveProperty("text");
  });
});

describe("SUBMIT — snake_case identity and an answers MAP", () => {
  it("matches what Vault's attempt route validates", () => {
    const submission: QuizAttemptSubmission = {
      quiz_id: VAULT_QUIZ_PAYLOAD.quiz.quizId,
      quiz_version: VAULT_QUIZ_PAYLOAD.quiz.quizVersion,
      answers: { q1: "cannot-advance-without" },
    };
    expect(submission.quiz_id).toBeTruthy();
    expect(submission.quiz_version).toBeTruthy();
    expect(Array.isArray(submission.answers)).toBe(false);
    expect(submission.answers.q1).toBe("cannot-advance-without");
  });

  it("the quiz identifier can never be undefined for a valid payload", () => {
    const submission: QuizAttemptSubmission = {
      quiz_id: VAULT_QUIZ_PAYLOAD.quiz.quizId,
      quiz_version: VAULT_QUIZ_PAYLOAD.quiz.quizVersion,
      answers: {},
    };
    expect(submission.quiz_id).not.toBeUndefined();
    expect(submission.quiz_id).not.toBe("");
  });
});

describe("RESULT — tri-state survives", () => {
  const base = {
    attempt_id: "att-1",
    quizId: "q",
    quizVersion: "1",
    totalCount: 10,
    correctCount: 9,
    scorePercent: 90,
    attemptNumber: 1,
    attemptsRemaining: 2,
  };

  it("passed", () => {
    const r: QuizAttemptResult = { ...base, passed: true, outcome: "passed" };
    expect(r.passed).toBe(true);
  });

  it("failed", () => {
    const r: QuizAttemptResult = { ...base, passed: false, outcome: "failed" };
    expect(r.outcome).toBe("failed");
  });

  it("review_required is NOT collapsed into failed, and passed stays false", () => {
    const r: QuizAttemptResult = { ...base, passed: false, outcome: "review_required" };
    expect(r.outcome).toBe("review_required");
    expect(r.passed).toBe(false);
  });

  it("an older attempt with no outcome still type-checks", () => {
    const r: QuizAttemptResult = { ...base, passed: true };
    expect(r.outcome).toBeUndefined();
  });

  it("carries no hidden critical-item configuration", () => {
    const r = { ...base, passed: false, outcome: "review_required" } as Record<string, unknown>;
    expect(r).not.toHaveProperty("criticalQuestionIds");
    expect(r).not.toHaveProperty("criticalDetail");
  });
});

describe("FAIL CLOSED — an incomplete payload never renders a usable quiz", () => {
  const ok = VAULT_QUIZ_PAYLOAD.quiz as LearnerSafeQuiz;

  it("accepts the real Vault payload", () => {
    expect(describeQuizContractProblem(ok)).toBeNull();
  });

  it.each([
    ["quizId", { ...ok, quizId: "" }],
    ["quizVersion", { ...ok, quizVersion: "" }],
    ["questions", { ...ok, questions: [] }],
    ["passingRule", { ...ok, passingRule: undefined as never }],
    ["retryPolicy", { ...ok, retryPolicy: undefined as never }],
  ])("refuses to start when %s is missing", (_label, broken) => {
    expect(describeQuizContractProblem(broken as LearnerSafeQuiz)).not.toBeNull();
  });

  it("refuses a legacy-shaped payload outright", () => {
    const legacy = {
      quizId: "q",
      quizVersion: "1",
      title: "t",
      passingScore: 80,
      attemptCap: 3,
      questions: [{ id: "q1", prompt: "p", options: [{ id: "a", text: "A" }] }],
    } as unknown as LearnerSafeQuiz;
    expect(describeQuizContractProblem(legacy)).not.toBeNull();
  });
});
