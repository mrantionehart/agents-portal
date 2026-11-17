/**
 * @jest-environment node
 */
// D6 — Volume 1 Module 14 "Fair Housing & Disclosure" quiz bank.
// Text and answer keys come from the counsel-cleared Attorney Review Package v5
// (2026-11-13); answer POSITIONS were reshuffled per BA-6, so each key is pinned
// here by the TEXT of the correct option, never by its letter.
// The quiz is INERT in production until the training_modules row for V1 M14 is
// inserted (staged migration); the quiz route refuses a module with no row.
import { getQuizForModule, gradeQuiz } from '@/app/data/quizzes'

const KEYS: Record<string, string> = {
  v1m14q1: "Explain you cannot steer on protected characteristics, and search by the buyer's own objective criteria (price, size, commute, features)",
  v1m14q2: 'Decline: refusing to deal based on familial status is unlawful, and you cannot carry out the instruction',
  v1m14q3: 'Rewrite the remarks to describe the property, not the preferred buyer',
  v1m14q4: 'Familial status',
  v1m14q5: 'Treat it as a reasonable-accommodation request: an assistance animal is not a pet; reliable documentation of the disability-related need may be requested if not obvious, but no pet fee and no diagnosis',
  v1m14q6: 'Only when it qualifies as housing for older persons (55+ or 62+) under federal law',
  v1m14q7: 'Advise the seller it must be disclosed; if the seller refuses, you cannot conceal it and must not proceed on that basis',
  v1m14q8: "All known facts that materially affect the property's value and are not readily observable to the buyer",
  v1m14q9: 'Ensure the federal lead disclosure is completed before the buyer is bound: known lead hazards disclosed, the EPA pamphlet given, the Lead Warning Statement in the contract, and a 10-day inspection opportunity unless waived',
  v1m14q10: 'The statutory radon gas notification must be provided on at least one document signed at or before the contract or lease',
  v1m14q11: 'A transaction broker',
  v1m14q12: 'Loyalty',
}

const quiz = getQuizForModule(1, 14)!

function answers(correct: number): Record<string, string> {
  const out: Record<string, string> = {}
  quiz.questions.forEach((q, i) => {
    const right = q.options.find((o) => o.text === KEYS[q.id])!.id
    out[q.id] = i < correct ? right : q.options.find((o) => o.id !== right)!.id
  })
  return out
}

describe('vol1_m14 — D6 Fair Housing & Disclosure', () => {
  it('exists with 12 questions, 4 options each, pass mark 80', () => {
    expect(quiz).not.toBeNull()
    expect(quiz.questions).toHaveLength(12)
    expect(quiz.passingScore).toBe(80)
    for (const q of quiz.questions) expect(q.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('every answer key points at the approved correct text (pinned by text, not letter)', () => {
    for (const q of quiz.questions) {
      const keyed = q.options.find((o) => o.id === q.correct)!
      expect([q.id, keyed.text]).toEqual([q.id, KEYS[q.id]])
    }
    expect(Object.keys(KEYS).sort()).toEqual(quiz.questions.map((q) => q.id).sort())
  })

  it('answer positions are reshuffled: keys are spread 3 each over a-d', () => {
    const c: Record<string, number> = {}
    for (const q of quiz.questions) c[q.correct] = (c[q.correct] ?? 0) + 1
    expect(c).toEqual({ a: 3, b: 3, c: 3, d: 3 })
  })

  it('10 of 12 PASSES (83%), 9 of 12 FAILS (75%) — the approved 10/12 rule', () => {
    const p = gradeQuiz(quiz, answers(10)) as { score: number; passed: boolean }
    expect(p.passed).toBe(true)
    const f = gradeQuiz(quiz, answers(9)) as { score: number; passed: boolean }
    expect(f.passed).toBe(false)
  })
})
