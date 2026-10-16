/**
 * @jest-environment node
 */
// HARTFELT-EXAM-REMEDIATION-P0 — POST /api/training/quiz for Volume 1
// Module 13, the submission path that turns a passed M13 quiz into the
// evidence HartFelt Ready counts.
//
// WHAT THE GATE ACTUALLY READS (Vault src/lib/onboarding/hartfelt-ready.ts,
// passedModuleKeys): rows of `training_quiz_results` with `passed = true`,
// `volume` in 1-3, AND `certification_id IS NULL AND quiz_id IS NULL` — the
// per-certification programmes write the same table with both set and are
// excluded. So "the gate recognises M13" is not a claim about the gate; it is
// a claim about THIS insert's shape, which is what the tests below pin.
//
// `volume_completed` is deliberately NOT expected to move: the route's
// VOLUME_MODULE_COUNTS[1] is [1..9], so passing 13 records the module without
// declaring the volume finished — and therefore without firing the
// broker/admin SendGrid fan-out. `fetch` is asserted untouched.
import { NextResponse } from "next/server";

const quizInserts: any[] = [];
const progressInserts: any[] = [];
const progressUpdates: any[] = [];

let attemptCount = 0;
let existingProgress: any = null;

function chain(table: string): any {
  const c: any = {};
  const self = () => c;
  c.select = jest.fn(self);
  c.eq = jest.fn(self);
  c.in = jest.fn(self);
  c.insert = jest.fn(async (payload: any) => {
    if (table === "training_quiz_results") quizInserts.push(payload);
    if (table === "training_progress") progressInserts.push(payload);
    return { data: null, error: null };
  });
  c.update = jest.fn((payload: any) => {
    if (table === "training_progress") progressUpdates.push(payload);
    return c;
  });
  c.maybeSingle = jest.fn(async () => ({ data: existingProgress, error: null }));
  c.single = jest.fn(async () => ({ data: null, error: null }));
  // The count query and the update are awaited on the chain itself.
  c.then = (res: any, rej: any) =>
    Promise.resolve(
      table === "training_quiz_results" ? { count: attemptCount, error: null } : { data: null, error: null },
    ).then(res, rej);
  return c;
}

const fakeClient = { from: jest.fn((t: string) => chain(t)) };

jest.mock("@/lib/security", () => ({
  requireAuth: jest.fn(async () => ({ user: { id: "agent-1", email: "a@example.com" } })),
  userClient: jest.fn(() => fakeClient),
  adminClient: jest.fn(() => fakeClient),
}));

import { POST } from "@/app/api/training/quiz/route";
import { requireAuth, userClient, adminClient } from "@/lib/security";
import { MODULE_QUIZZES } from "@/app/data/quizzes";

const ra = requireAuth as jest.Mock;
const uc = userClient as jest.Mock;
const ac = adminClient as jest.Mock;

const quiz = MODULE_QUIZZES["vol1_m13"];
const correct = Object.fromEntries(quiz.questions.map((q) => [q.id, q.correct]));
const wrong = Object.fromEntries(quiz.questions.map((q) => [q.id, "z"]));
/** 4 of 5 — the pass boundary. */
const boundary = (() => {
  const a = { ...correct };
  const q0 = quiz.questions[0];
  a[q0.id] = q0.options.find((o) => o.id !== q0.correct)!.id;
  return a;
})();

function req(body: unknown): any {
  return { json: async () => body, headers: { get: () => null } };
}

const fetchSpy = jest.fn();

beforeEach(() => {
  quizInserts.length = 0;
  progressInserts.length = 0;
  progressUpdates.length = 0;
  attemptCount = 0;
  existingProgress = null;
  ra.mockReset();
  ra.mockResolvedValue({ user: { id: "agent-1", email: "a@example.com" } });
  uc.mockClear();
  ac.mockClear();
  fetchSpy.mockReset();
  (global as any).fetch = fetchSpy;
  delete process.env.SENDGRID_API_KEY;
});

describe("POST /api/training/quiz — authorization", () => {
  it("refuses an unauthenticated submission and writes nothing", async () => {
    ra.mockResolvedValue({ response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    const res = await POST(req({ volume: 1, module_num: 13, answers: correct }));
    expect(res.status).toBe(401);
    expect(quizInserts).toHaveLength(0);
    expect(progressInserts).toHaveLength(0);
    expect(progressUpdates).toHaveLength(0);
  });

  it("writes own-row evidence under the USER JWT, never the service role", async () => {
    await POST(req({ volume: 1, module_num: 13, answers: correct }));
    expect(uc).toHaveBeenCalledTimes(1);
    // The service-role client is reserved for the volume-completion fan-out,
    // which M13 alone must not trigger.
    expect(ac).not.toHaveBeenCalled();
  });

  it("stamps the row with the authenticated user, not anything from the body", async () => {
    await POST(
      req({ volume: 1, module_num: 13, answers: correct, user_id: "someone-else", tenant_id: "t-x" }),
    );
    expect(quizInserts).toHaveLength(1);
    expect(quizInserts[0].user_id).toBe("agent-1");
    expect(quizInserts[0]).not.toHaveProperty("tenant_id");
  });
});

describe("POST /api/training/quiz — M13 passing evidence", () => {
  it("records a passing attempt in the exact shape HartFelt Ready counts", async () => {
    const res = await POST(req({ volume: 1, module_num: 13, answers: correct }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ score: 100, passed: true, correctCount: 5, totalQuestions: 5 });

    expect(quizInserts).toHaveLength(1);
    const row = quizInserts[0];
    expect(row.volume).toBe(1);
    expect(row.module_num).toBe(13);
    expect(row.passed).toBe(true);
    // The gate filters on `certification_id IS NULL AND quiz_id IS NULL`.
    // Setting either would make this row invisible to it.
    expect(row.certification_id).toBeUndefined();
    expect(row.quiz_id).toBeUndefined();
  });

  it("passes at the 80% boundary (4 of 5) and still records module 13", async () => {
    const res = await POST(req({ volume: 1, module_num: 13, answers: boundary }));
    const body = await res.json();
    expect(body.score).toBe(80);
    expect(body.passed).toBe(true);
    expect(quizInserts[0].passed).toBe(true);
    expect(progressInserts[0].completed_modules).toContain(13);
  });

  it("adds 13 to completed_modules and its score to test_scores without losing prior modules", async () => {
    existingProgress = {
      completed_modules: [1, 2, 3],
      test_scores: { m1: 100, m2: 90, m3: 85 },
      volume_completed: false,
    };
    await POST(req({ volume: 1, module_num: 13, answers: correct }));
    expect(progressUpdates).toHaveLength(1);
    expect(progressUpdates[0].completed_modules).toEqual([1, 2, 3, 13]);
    expect(progressUpdates[0].test_scores).toEqual({ m1: 100, m2: 90, m3: 85, m13: 100 });
  });

  it("does not declare Volume 1 complete on M13 alone, and sends no notification", async () => {
    existingProgress = {
      completed_modules: [1, 2, 3],
      test_scores: {},
      volume_completed: false,
    };
    const res = await POST(req({ volume: 1, module_num: 13, answers: correct }));
    const body = await res.json();
    expect(body.volumeCompleted).toBe(false);
    expect(progressUpdates[0].volume_completed).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/training/quiz — M13 failure and retakes", () => {
  it("a failing attempt is recorded but completes NOTHING", async () => {
    const res = await POST(req({ volume: 1, module_num: 13, answers: wrong }));
    const body = await res.json();
    expect(body.score).toBe(0);
    expect(body.passed).toBe(false);

    expect(quizInserts).toHaveLength(1);
    expect(quizInserts[0].passed).toBe(false);
    // The whole point: no progress row, no completed module, no score.
    expect(progressInserts).toHaveLength(0);
    expect(progressUpdates).toHaveLength(0);
  });

  it("3 of 5 fails and completes nothing", async () => {
    const a = { ...correct };
    for (const q of quiz.questions.slice(0, 2)) {
      a[q.id] = q.options.find((o) => o.id !== q.correct)!.id;
    }
    const body = await (await POST(req({ volume: 1, module_num: 13, answers: a }))).json();
    expect(body.score).toBe(60);
    expect(body.passed).toBe(false);
    expect(progressInserts).toHaveLength(0);
    expect(progressUpdates).toHaveLength(0);
  });

  it("retakes are appended with an incrementing attempt_num, never overwritten", async () => {
    attemptCount = 0;
    await POST(req({ volume: 1, module_num: 13, answers: wrong }));
    expect(quizInserts[0].attempt_num).toBe(1);

    attemptCount = 1;
    await POST(req({ volume: 1, module_num: 13, answers: wrong }));
    expect(quizInserts[1].attempt_num).toBe(2);

    attemptCount = 2;
    await POST(req({ volume: 1, module_num: 13, answers: correct }));
    expect(quizInserts[2].attempt_num).toBe(3);
    expect(quizInserts[2].passed).toBe(true);
    // The two failures remain on file — history is not rewritten by a pass.
    expect(quizInserts.map((r) => r.passed)).toEqual([false, false, true]);
  });

  it("stores the submitted answers with the attempt", async () => {
    await POST(req({ volume: 1, module_num: 13, answers: boundary }));
    expect(quizInserts[0].answers).toEqual(boundary);
  });
});

describe("POST /api/training/quiz — request validation", () => {
  it("rejects a submission with no answers", async () => {
    const res = await POST(req({ volume: 1, module_num: 13 }));
    expect(res.status).toBe(400);
    expect(quizInserts).toHaveLength(0);
  });

  it("404s for a module that genuinely has no quiz — the M13 state before this change", async () => {
    const res = await POST(req({ volume: 1, module_num: 11, answers: correct }));
    expect(res.status).toBe(404);
    expect(quizInserts).toHaveLength(0);
  });
});
