/**
 * @jest-environment node
 */
// HARTFELT-EXAM-REMEDIATION-P0 — the Volume 1 Module 13 ("EASE Training —
// Agent") quiz.
//
// Why this suite exists: the exam audit found M13 mandatory for HartFelt
// Ready and simultaneously IMPOSSIBLE — `getQuizForModule(1, 13)` returned
// null, so POST /api/training/quiz answered 404 and no agent could ever
// produce passing evidence for it. Prod confirmed it: volume 1 has
// `training_quiz_results` rows for modules 1-10 and ZERO for 13.
//
// The pass boundary is the load-bearing case. Scoring is
// `round(correct / total * 100) >= passingScore`, so with five questions at
// 80 the boundary sits exactly on 4/5 = 80. At three or four questions an
// agent would need a perfect paper to pass a mandatory module; at five, one
// miss is survivable and two are not. Both sides are pinned below.
import { MODULE_QUIZZES, getQuizForModule, gradeQuiz } from "@/app/data/quizzes";
import type { Quiz } from "@/app/data/quizzes";

const KEY = "vol1_m13";

function allCorrect(quiz: Quiz): Record<string, string> {
  return Object.fromEntries(quiz.questions.map((q) => [q.id, q.correct]));
}

/** Answer every question correctly EXCEPT the first `n`, which get a wrong option. */
function missing(quiz: Quiz, n: number): Record<string, string> {
  const answers = allCorrect(quiz);
  for (const q of quiz.questions.slice(0, n)) {
    const wrong = q.options.find((o) => o.id !== q.correct);
    if (!wrong) throw new Error(`${q.id} has no incorrect option`);
    answers[q.id] = wrong.id;
  }
  return answers;
}

describe("vol1_m13 — reachable through the route's own lookup", () => {
  // The route resolves `vol${volume}_m${module_num}`. Asserting through
  // getQuizForModule (not MODULE_QUIZZES[KEY]) is what proves the key the
  // API builds for (1, 13) actually hits this quiz instead of 404-ing.
  it("getQuizForModule(1, 13) resolves the quiz", () => {
    const quiz = getQuizForModule(1, 13);
    expect(quiz).not.toBeNull();
    expect(quiz).toBe(MODULE_QUIZZES[KEY]);
    expect(quiz!.title).toBe("EASE Training — Agent Quiz");
  });

  it("is keyed under volume 1, not volume 4 (m_v4_agent is the module id, not its volume)", () => {
    expect(getQuizForModule(4, 13)).toBeNull();
    expect(getQuizForModule(1, 13)).not.toBeNull();
  });
});

describe("vol1_m13 — schema and scoring conventions", () => {
  const quiz = MODULE_QUIZZES[KEY];

  it("carries the same passing score as every other module quiz", () => {
    const others = Object.entries(MODULE_QUIZZES)
      .filter(([k]) => k !== KEY)
      .map(([, q]) => q.passingScore);
    expect(new Set(others).size).toBe(1);
    expect(quiz.passingScore).toBe(others[0]);
    expect(quiz.passingScore).toBe(80);
  });

  it("has five questions, so the 80% boundary is reachable with one miss", () => {
    expect(quiz.questions).toHaveLength(5);
    // Guard the arithmetic itself, not just the count: at 4 questions the
    // best non-perfect score is 75 and the module becomes perfect-or-fail.
    const total = quiz.questions.length;
    expect(Math.round(((total - 1) / total) * 100)).toBeGreaterThanOrEqual(quiz.passingScore);
    expect(Math.round(((total - 2) / total) * 100)).toBeLessThan(quiz.passingScore);
  });

  it("every question is well-formed: 4 unique options and a correct answer among them", () => {
    for (const q of quiz.questions) {
      expect(q.options).toHaveLength(4);
      const ids = q.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toContain(q.correct);
      expect(q.question.trim().length).toBeGreaterThan(0);
      for (const o of q.options) expect(o.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("question ids follow the v1m13q{n} convention and collide with nothing else", () => {
    expect(quiz.questions.map((q) => q.id)).toEqual([
      "v1m13q1",
      "v1m13q2",
      "v1m13q3",
      "v1m13q4",
      "v1m13q5",
    ]);
    const everyId = Object.values(MODULE_QUIZZES).flatMap((q) => q.questions.map((x) => x.id));
    expect(everyId.length).toBe(new Set(everyId).size);
  });

  // The answer KEY is the one thing the grading tests cannot check: they build
  // their answers FROM `correct`, so a wrong key grades itself right. Each
  // expectation below names the EASE source that settles it, so a reviewer can
  // check the key against the app rather than against this file.
  it("pins each correct answer to verified EASE behaviour", () => {
    const keyed = Object.fromEntries(
      quiz.questions.map((q) => [q.id, q.options.find((o) => o.id === q.correct)!.text]),
    );
    // AppNavigator.js ToolsMenuScreen.agentTools — 'commission' (Commission
    // Calculator), 'cma' (Manual CMA) and 'compliance' (Compliance Tracker)
    // are tiles on the Tools stack. None appear in MoreMenuScreen's items.
    expect(keyed["v1m13q1"]).toBe("Tools");
    // DealPipelineKanban.js PIPELINE_STAGES, in declaration order.
    expect(keyed["v1m13q2"]).toBe("Cultivate, Appointment, Active, Under Contract, Closed");
    // AddLeadScreen.js addLead(): `if (!name.trim())` is the only guard that
    // blocks the insert; phone and email fall back to null.
    expect(keyed["v1m13q3"]).toBe("The lead's name");
    // CommissionCalcScreen.js: listingSide = totalComm / 2, then
    // agentEarns = listingSide * (split / 100).
    expect(keyed["v1m13q4"]).toBe("One side of the commission (the listing side)");
    // ComplianceScreen.js STATUS_CONFIG: the `uploaded` status renders with
    // the label 'Pending'; 'Approved' is a separate, later status.
    expect(keyed["v1m13q5"]).toBe("Pending");
  });

  it("does not park the correct answer on one option id", () => {
    // A quiz whose answer is always 'b' is passable without reading it.
    expect(new Set(quiz.questions.map((q) => q.correct)).size).toBeGreaterThan(1);
  });
});

describe("vol1_m13 — grading", () => {
  const quiz = MODULE_QUIZZES[KEY];

  it("all five correct scores 100 and passes", () => {
    const r = gradeQuiz(quiz, allCorrect(quiz));
    expect(r.correctCount).toBe(5);
    expect(r.totalQuestions).toBe(5);
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("four of five scores exactly 80 and passes — the boundary", () => {
    const r = gradeQuiz(quiz, missing(quiz, 1));
    expect(r.correctCount).toBe(4);
    expect(r.score).toBe(80);
    expect(r.score).toBe(quiz.passingScore);
    expect(r.passed).toBe(true);
  });

  it("three of five scores 60 and FAILS", () => {
    const r = gradeQuiz(quiz, missing(quiz, 2));
    expect(r.correctCount).toBe(3);
    expect(r.score).toBe(60);
    expect(r.passed).toBe(false);
  });

  it("no answers at all scores 0 and fails", () => {
    const r = gradeQuiz(quiz, {});
    expect(r.correctCount).toBe(0);
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
  });

  it("an unknown option id is wrong, not ignored", () => {
    const answers = allCorrect(quiz);
    answers[quiz.questions[0].id] = "z";
    const r = gradeQuiz(quiz, answers);
    expect(r.correctCount).toBe(4);
    expect(r.passed).toBe(true);
    // ...and a submission of nothing but junk cannot pass.
    const junk = Object.fromEntries(quiz.questions.map((q) => [q.id, "z"]));
    expect(gradeQuiz(quiz, junk).passed).toBe(false);
  });

  it("answers keyed by option text rather than option id do not pass", () => {
    const byText = Object.fromEntries(
      quiz.questions.map((q) => [q.id, q.options.find((o) => o.id === q.correct)!.text]),
    );
    expect(gradeQuiz(quiz, byText).passed).toBe(false);
  });

  it("retaking is deterministic: a failed attempt then a passing one both grade on their own answers", () => {
    const failed = gradeQuiz(quiz, missing(quiz, 2));
    const retake = gradeQuiz(quiz, allCorrect(quiz));
    const again = gradeQuiz(quiz, missing(quiz, 2));
    expect(failed.passed).toBe(false);
    expect(retake.passed).toBe(true);
    expect(again).toEqual(failed);
  });

  it("reports the correct answers for every question", () => {
    const r = gradeQuiz(quiz, {});
    expect(r.correctAnswers).toEqual(
      Object.fromEntries(quiz.questions.map((q) => [q.id, q.correct])),
    );
  });
});
