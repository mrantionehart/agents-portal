// PILOT-FEEDBACK-001A — sidebar footer copy pin
//
// Locks the user-facing footer string. The previous copy read
// "Portal 2.0 · Preview" which reads as "beta / unfinished" to a real
// production learner and was the top copy-level pilot risk flagged in
// the PILOT-READINESS-001 audit.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SIDEBAR_SRC = readFileSync(
  resolve(__dirname, '..', 'Sidebar.tsx'),
  'utf-8',
)

describe('Sidebar footer copy (PILOT-FEEDBACK-001A)', () => {
  it("does not contain 'Portal 2.0 · Preview' or any case variant", () => {
    expect(SIDEBAR_SRC).not.toContain('Portal 2.0 · Preview')
    expect(SIDEBAR_SRC).not.toContain('Portal 2.0 · PREVIEW')
    expect(SIDEBAR_SRC).not.toContain('PORTAL 2.0 · PREVIEW')
  })

  it("contains the HartFelt brand line 'Because Choices Matter.'", () => {
    expect(SIDEBAR_SRC).toContain('Because Choices Matter.')
  })
})
