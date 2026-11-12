// HR-FINAL-1.1 — the final also requires every compliance-critical question to
// be answered correctly (Broker of Record approval 2026-11-12). A paper that
// meets the score but is not passed missed one of them; saying "you need 85%"
// would be false. Which question stays undisclosed.
export function finalExamFailMessage(score: number, passScore: number): string {
  if (score >= passScore) {
    return 'A required compliance question was answered incorrectly, which fails the exam regardless of score. Review the material and take it again.'
  }
  return `You need ${passScore}% to pass. Review the material and take it again.`
}
