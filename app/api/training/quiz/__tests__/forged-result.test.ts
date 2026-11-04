/**
 * @jest-environment node
 */
// HR-CERT-SECURITY D1 — a module result can only be what the SERVER graded.
//
// Production 2026-11-04: training_quiz_results accepted any INSERT where
// auth.uid() = user_id, and EASE graded on the phone and wrote `passed`
// itself. Vault's HartFelt Ready gate counts those rows. These tests pin the
// route side of the fix: the body's score/passed/attempt/user/certification
// fields are ignored, grading is done here, the row is written by the service
// role only after an eligibility check, and a failed write is reported as a
// failure. The database side (authenticated has no INSERT) is proven in
// Vault's training-results-lockdown.pg.test.ts.
import { moduleEligibility, parseSubmission } from "@/lib/training/quiz-submission";

const quizInserts: any[] = [];
const progressWrites: any[] = [];
let moduleRow: any = { required_role: null };
let callerRole: string | null = "agent";
let insertError: any = null;

function chain(table: string): any {
  const c: any = {};
  const self = () => c;
  for (const m of ["select", "eq", "in", "is", "order"]) c[m] = jest.fn(self);
  c.insert = jest.fn(async (p: any) => {
    if (table === "training_quiz_results") { quizInserts.push(p); return { data: null, error: insertError }; }
    progressWrites.push(p);
    return { data: null, error: null };
  });
  c.update = jest.fn((p: any) => { progressWrites.push(p); return c; });
  c.maybeSingle = jest.fn(async () => {
    if (table === "training_modules") return { data: moduleRow, error: null };
    if (table === "profiles") return { data: callerRole === null ? null : { role: callerRole }, error: null };
    return { data: null, error: null };
  });
  c.single = jest.fn(async () => ({ data: null, error: null }));
  c.then = (res: any, rej: any) => Promise.resolve({ count: 0, data: null, error: null }).then(res, rej);
  return c;
}
const client = { from: jest.fn((t: string) => chain(t)) };

jest.mock("@/lib/security", () => ({
  requireAuth: jest.fn(async () => ({ user: { id: "agent-1", email: "a@example.com" } })),
  userClient: jest.fn(() => client),
  adminClient: jest.fn(() => client),
}));

import { POST } from "@/app/api/training/quiz/route";
import { MODULE_QUIZZES } from "@/app/data/quizzes";

const quiz = MODULE_QUIZZES["vol1_m1"];
const wrong = Object.fromEntries(quiz.questions.map((q) => [q.id, "z"]));
const correct = Object.fromEntries(quiz.questions.map((q) => [q.id, q.correct]));
const req = (body: unknown): any => ({ json: async () => body, headers: { get: () => null } });

beforeEach(() => {
  quizInserts.length = 0;
  progressWrites.length = 0;
  moduleRow = { required_role: null };
  callerRole = "agent";
  insertError = null;
  (global as any).fetch = jest.fn();
  delete process.env.SENDGRID_API_KEY;
});

describe("forged client results are ignored", () => {
  it("wrong answers + a forged score/passed in the body are stored as a server-graded FAIL", async () => {
    const res = await POST(req({
      volume: 1, module_num: 1, answers: wrong,
      score: 100, passed: true, attempt_num: 1, user_id: "victim", certification_id: null, quiz_id: null,
    }));
    const body = await res.json();
    expect(body).toMatchObject({ score: 0, passed: false });
    expect(quizInserts).toHaveLength(1);
    expect(quizInserts[0]).toMatchObject({ user_id: "agent-1", score: 0, passed: false });
    expect(progressWrites).toHaveLength(0);
  });

  it("answers to questions outside this quiz are dropped before grading and storage", async () => {
    await POST(req({ volume: 1, module_num: 1, answers: { ...wrong, injected: "a", __proto__x: "b" } }));
    expect(Object.keys(quizInserts[0].answers).sort()).toEqual(quiz.questions.map((q) => q.id).sort());
  });

  it("a non-string answer value is rejected and nothing is written", async () => {
    const res = await POST(req({ volume: 1, module_num: 1, answers: { [quiz.questions[0].id]: { $ne: null } } }));
    expect(res.status).toBe(400);
    expect(quizInserts).toHaveLength(0);
  });

  it("a string volume or module number is rejected (no coercion)", async () => {
    const res = await POST(req({ volume: "1", module_num: 1, answers: correct }));
    expect(res.status).toBe(400);
    expect(quizInserts).toHaveLength(0);
  });
});

describe("module eligibility", () => {
  it("a module that is not in the HartFelt Ready curriculum is refused (404) and not written", async () => {
    moduleRow = null;
    const res = await POST(req({ volume: 1, module_num: 1, answers: correct }));
    expect(res.status).toBe(404);
    expect(quizInserts).toHaveLength(0);
  });

  it("a role-restricted module is refused (403) for a role it does not list", async () => {
    moduleRow = { required_role: ["admin", "office_manager"] };
    const res = await POST(req({ volume: 1, module_num: 1, answers: correct }));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("role_not_permitted");
    expect(quizInserts).toHaveLength(0);
  });

  it("pure rule mirrors Vault's roleMayTake", () => {
    expect(moduleEligibility({ required_role: null }, "agent")).toEqual({ ok: true });
    expect(moduleEligibility({ required_role: [] }, "new_agent")).toEqual({ ok: true });
    expect(moduleEligibility({ required_role: ["admin"] }, "admin")).toEqual({ ok: true });
    expect(moduleEligibility({ required_role: ["admin"] }, null)).toMatchObject({ ok: false, status: 403 });
    expect(moduleEligibility(null, "agent")).toMatchObject({ ok: false, status: 404 });
  });

  it("parseSubmission reads only volume, module_num and answers", () => {
    const p = parseSubmission({ volume: 2, module_num: 9, answers: { a: "b" }, passed: true, score: 100 });
    expect(p).toEqual({ ok: true, volume: 2, moduleNum: 9, answers: { a: "b" } });
  });
});

describe("legitimate completion", () => {
  it("a correct submission is stored as a server-graded pass and progress is recorded", async () => {
    const res = await POST(req({ volume: 1, module_num: 1, answers: correct }));
    expect(res.status).toBe(200);
    expect((await res.json())).toMatchObject({ score: 100, passed: true });
    expect(quizInserts[0]).toMatchObject({ volume: 1, module_num: 1, score: 100, passed: true });
    expect(quizInserts[0].certification_id).toBeUndefined();
    expect(quizInserts[0].quiz_id).toBeUndefined();
    expect(progressWrites.length).toBeGreaterThan(0);
  });

  it("a failed result write is a 500 — never a pass the database does not hold", async () => {
    insertError = { code: "42501", message: "permission denied" };
    const res = await POST(req({ volume: 1, module_num: 1, answers: correct }));
    expect(res.status).toBe(500);
    expect(progressWrites).toHaveLength(0);
  });
});
