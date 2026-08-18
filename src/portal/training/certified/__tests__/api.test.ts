// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — api client behavior
// ============================================================================
// Locks the Bearer-authed HTTP client that fronts Vault's V4 endpoints.
// Every call:
//   - reads the Supabase access token via `getAccessToken()`
//   - sends `Authorization: Bearer <token>` (server is the auth boundary)
//   - throws CertApiError on !res.ok, preserving the server envelope's `code`
// ============================================================================

// Mock @/lib/supabase — the AP-wide Supabase helper — so the api client
// picks up a controllable access token.
jest.mock("@/lib/supabase", () => ({
  getAccessToken: jest.fn(),
}));

import { getAccessToken } from "@/lib/supabase";
import {
  CertApiError,
  fetchCatalog,
  fetchLearnerSafeQuiz,
  fetchProgress,
  requestPracticalCompletion,
  submitQuizAttempt,
} from "../api";

const mockedGetAccessToken = getAccessToken as jest.MockedFunction<
  typeof getAccessToken
>;

function jsonRes(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  mockedGetAccessToken.mockResolvedValue("test-access-token");
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── fetchCatalog ──────────────────────────────────────────────────────────

describe("fetchCatalog", () => {
  it("GETs the certification catalog with a Bearer token", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes({ certification_id: "hartfelt-platform-certified", tracks: [] }),
    );
    await fetchCatalog();
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain(
      "/platform/certifications/hartfelt-platform-certified/catalog",
    );
    expect(init.headers.Authorization).toBe("Bearer test-access-token");
  });

  it("throws CertApiError with the server code on non-2xx", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes({ error: "Not authorized", code: "cross_tenant" }, 403),
    );
    try {
      await fetchCatalog();
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CertApiError);
      const err = e as CertApiError;
      expect(err.status).toBe(403);
      expect(err.code).toBe("cross_tenant");
    }
  });

  it("throws no_session CertApiError when no token is available", async () => {
    mockedGetAccessToken.mockResolvedValueOnce(null);
    await expect(fetchCatalog()).rejects.toMatchObject({
      status: 401,
      code: "no_session",
    });
  });
});

// ─── fetchProgress ─────────────────────────────────────────────────────────

describe("fetchProgress", () => {
  it("GETs the progress endpoint scoped to the caller (never sends userId)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes({
        certification_id: "hartfelt-platform-certified",
        tracks: [],
        next_lesson: null,
        blocked_reason: null,
        assessment_attempts: 0,
        issuance: null,
        last_updated_at: "2026-07-18T00:00:00Z",
      }),
    );
    await fetchProgress();
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/platform/certifications/hartfelt-platform-certified/progress");
    expect(url).not.toContain("userId=");
    expect(init.method).toBeUndefined(); // default GET
  });
});

// ─── requestPracticalCompletion ────────────────────────────────────────────

describe("requestPracticalCompletion", () => {
  // Regression: PILOT-D-004. The Vault route's practical-verification branch
  // ONLY runs when the request body contains { practical_completion: true }.
  // An empty body falls through to a read-only eligibility recompute that
  // never invokes the evaluator and always returns `attestation_missing`.
  it("POSTs { practical_completion: true } to trigger the Vault practical branch", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes({ ok: true, lesson_id: "pcert-l03", status: "completed" }),
    );
    const res = await requestPracticalCompletion({ lessonId: "pcert-l03" });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/lessons/pcert-l03/complete");
    expect(init.method).toBe("POST");
    const parsed = JSON.parse(init.body as string);
    expect(parsed).toEqual({ practical_completion: true });
    expect(res.lesson_id).toBe("pcert-l03");
  });

  it("surfaces the attestation_missing envelope code", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes({ error: "Signals missing", code: "attestation_missing" }, 409),
    );
    try {
      await requestPracticalCompletion({ lessonId: "pcert-l03" });
      fail("should have thrown");
    } catch (e) {
      expect((e as CertApiError).code).toBe("attestation_missing");
    }
  });
});

// ─── fetchLearnerSafeQuiz ──────────────────────────────────────────────────

describe("fetchLearnerSafeQuiz", () => {
  it("returns the projection unchanged; NEVER receives correctOptionId", async () => {
    const projection = {
      quiz: {
        quizId: "platform-cert.pcert-l12.required-optional-blocked",
        quizVersion: "1",
        title: "pcert-l12 quiz",
        passingRule: { kind: "percentage_threshold", thresholdPercent: 80 },
        retryPolicy: {
          maxAttempts: 3,
          attemptCountScope: "per_certification_version",
          passIsPermanentForCertVersion: true,
          revealAnswersAfterAttempt: false,
        },
        instructions: null,
        questions: [
          {
            id: "q1",
            prompt: "Which is which?",
            options: [
              { id: "opt-a", label: "Option A" },
              { id: "opt-b", label: "Option B" },
            ],
          },
        ],
      },
      mode: "learner",
      moduleStatus: "published",
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonRes(projection));
    const res = await fetchLearnerSafeQuiz({ lessonId: "pcert-l12" });
    // Structural check: no correctOptionId leaks into the questions.
    const asString = JSON.stringify(res);
    expect(asString).not.toContain("correctOptionId");
    expect(asString).not.toContain("correctChoiceId");
    expect(asString).not.toContain("explanationOnSubmit");
    expect(res.quiz.questions[0].options.length).toBe(2);
  });

  it("returns 404 Not found for unpublished / no-binding lessons", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes({ error: "Not found" }, 404),
    );
    try {
      await fetchLearnerSafeQuiz({ lessonId: "pcert-l24" });
      fail("should have thrown");
    } catch (e) {
      expect((e as CertApiError).status).toBe(404);
    }
  });
});

// ─── submitQuizAttempt ─────────────────────────────────────────────────────

describe("submitQuizAttempt", () => {
  it("POSTs the submission body; NEVER includes user_id / tenant_id / passed / score", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes({
        result: {
          attempt_id: "att-1",
          score: 100,
          passed: true,
          quizId: "platform-cert.pcert-l12.required-optional-blocked",
          quizVersion: "1",
          scorePercent: 100,
          correctCount: 1,
          totalCount: 1,
          attemptNumber: 1,
          attemptsRemaining: 2,
        },
        status: "graded",
        certification_issuance: null,
      }),
    );
    const submission = {
      quiz_id: "platform-cert.pcert-l12.required-optional-blocked",
      quiz_version: "1",
      answers: { q1: "opt-a" },
    };
    await submitQuizAttempt({ lessonId: "pcert-l12", submission });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual(submission);
    // Guard: the client body must not smuggle server-owned fields.
    expect(body).not.toHaveProperty("user_id");
    expect(body).not.toHaveProperty("tenant_id");
    expect(body).not.toHaveProperty("passed");
    expect(body).not.toHaveProperty("score");
    expect(body).not.toHaveProperty("attempt_num");
    expect(body).not.toHaveProperty("attempt_id");
    expect(body).not.toHaveProperty("issuance_id");
  });

  it("surfaces attempt_cap_reached with 429", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes(
        { error: "attempt_cap_reached", code: "attempt_cap_reached", attempt_cap: 3, attempts_used: 3 },
        429,
      ),
    );
    try {
      await submitQuizAttempt({
        lessonId: "pcert-l32",
        submission: { quiz_id: "q", quiz_version: "1", answers: {} },
      });
      fail("should have thrown");
    } catch (e) {
      const err = e as CertApiError;
      expect(err.status).toBe(429);
      expect(err.code).toBe("attempt_cap_reached");
    }
  });

  it("returns the certification_issuance envelope on a passing final-exam attempt", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonRes({
        result: {
          attempt_id: "att-final",
          score: 100,
          passed: true,
          correct_count: 12,
          total_count: 12,
          retry_allowed_at: null,
        },
        status: "graded",
        certification_issuance: {
          issuance_id: "iss-1",
          certification_id: "hartfelt-platform-certified",
          certification_version: "1.0.0",
          issued_at: "2026-07-18T12:34:56.000Z",
        },
      }),
    );
    const res = await submitQuizAttempt({
      lessonId: "pcert-l32",
      submission: { quiz_id: "q", quiz_version: "1", answers: {} },
    });
    expect(res.certification_issuance?.issuance_id).toBe("iss-1");
  });
});
