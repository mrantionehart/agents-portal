/**
 * @jest-environment node
 */
// HR-CERT-SECURITY D1 — EASE now sends ANSWERS to POST /api/training/quiz and
// this bank grades them. If EASE shows a question id or answer letter this
// bank does not have, a correct mobile answer scores 0. The same fingerprint
// file is committed in EASE (src/data/__tests__/quiz-answer-key.fingerprint.json)
// and its own test compares EASE's bank to it, so drift in EITHER repo fails
// that repo's CI. Regenerate both copies together, never one.
import { MODULE_QUIZZES } from "@/app/data/quizzes";
import fingerprint from "./quiz-answer-key.fingerprint.json";

const fp = fingerprint as Record<string, { passingScore: number; key: string }>;

describe("quiz answer-key fingerprint (shared with EASE)", () => {
  it("covers exactly the 26 HartFelt Ready module quizzes", () => {
    expect(Object.keys(MODULE_QUIZZES).sort()).toEqual(Object.keys(fp).sort());
    expect(Object.keys(fp)).toHaveLength(26);
  });

  it.each(Object.keys(fp))("%s matches the fingerprint (ids, answers, 80%% pass mark)", (k) => {
    const q = MODULE_QUIZZES[k];
    expect(q.passingScore).toBe(80);
    expect(q.passingScore).toBe(fp[k].passingScore);
    expect(q.questions.map((x) => `${x.id}=${x.correct}`).join(",")).toBe(fp[k].key);
  });
});
