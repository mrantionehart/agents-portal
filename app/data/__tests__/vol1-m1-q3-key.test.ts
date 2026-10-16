/**
 * @jest-environment node
 */
// The Volume 1 Module 1 q3 answer key, corrected TRUE -> FALSE on broker
// approval 2026-10-16.
//
// It had been keyed 'a' (True) — "Presentation IS more important than process
// at HartFelt" — which contradicts Module 1's own curriculum and the quiz's
// own q1. Nothing caught it because an answer key has no validator: 'a' is a
// legal option id, so every structural check passed. This test is the
// validator, and it pins the key by its TEXT, not its option id, so a future
// reordering of the options cannot quietly re-break it.
import { MODULE_QUIZZES, gradeQuiz } from "@/app/data/quizzes";

const quiz = MODULE_QUIZZES["vol1_m1"];
const q3 = quiz.questions.find((q) => q.id === "v1m1q3")!;

describe("vol1_m1 q3 — the corrected key", () => {
  it("is still the question we think it is", () => {
    expect(q3).toBeDefined();
    expect(q3.question).toBe(
      "True or False: Presentation is more important than process at HartFelt.",
    );
    expect(q3.options.map((o) => o.text)).toEqual(["True", "False"]);
  });

  it("keys FALSE — pinned by text, not by option id", () => {
    const keyed = q3.options.find((o) => o.id === q3.correct)!;
    expect(keyed.text).toBe("False");
  });

  it("is consistent with q1, which keys the process-led answer", () => {
    const q1 = quiz.questions.find((q) => q.id === "v1m1q1")!;
    const keyed = q1.options.find((o) => o.id === q1.correct)!;
    expect(keyed.text).toBe("Professional behavior, precision, and execution");
  });

  it("grading now rewards False and rejects True", () => {
    const answerAll = (q3Choice: string) =>
      gradeQuiz(quiz, {
        v1m1q1: quiz.questions[0].correct,
        v1m1q2: quiz.questions[1].correct,
        v1m1q3: q3Choice,
      });
    const falseId = q3.options.find((o) => o.text === "False")!.id;
    const trueId = q3.options.find((o) => o.text === "True")!.id;

    const withFalse = answerAll(falseId);
    expect(withFalse.correctCount).toBe(3);
    expect(withFalse.score).toBe(100);
    expect(withFalse.passed).toBe(true);

    const withTrue = answerAll(trueId);
    expect(withTrue.correctCount).toBe(2);
    // 2 of 3 is 67 against a pass mark of 80 — answering True now fails.
    expect(withTrue.score).toBe(67);
    expect(withTrue.passed).toBe(false);
  });

  it("the correction changed nothing else in the quiz", () => {
    expect(quiz.questions).toHaveLength(3);
    expect(quiz.passingScore).toBe(80);
    expect(quiz.title).toBe("Foundations Quiz");
    expect(quiz.questions.map((q) => q.id)).toEqual(["v1m1q1", "v1m1q2", "v1m1q3"]);
  });
});
