/**
 * @jest-environment node
 */
import { finalExamFailMessage } from '@/lib/training/final-exam-message'

describe('final exam fail message (HR-FINAL-1.1)', () => {
  it('below the pass mark → the score explanation, unchanged', () => {
    expect(finalExamFailMessage(83, 85)).toBe('You need 85% to pass. Review the material and take it again.')
  })
  it('at or above the pass mark but not passed → a missed compliance-critical question, never "you need 85%"', () => {
    for (const s of [85, 98]) {
      const m = finalExamFailMessage(s, 85)
      expect(m).toMatch(/required compliance question/)
      expect(m).not.toMatch(/You need 85%/)
    }
  })
})
