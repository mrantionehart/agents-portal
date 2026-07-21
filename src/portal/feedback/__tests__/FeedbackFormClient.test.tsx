// PILOT-FEEDBACK-001 — Feedback form + sidebar copy

import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FeedbackFormClient } from '../FeedbackFormClient'

const REPO_ROOT = resolve(__dirname, '../../../..')
const SIDEBAR_SRC = readFileSync(
  resolve(REPO_ROOT, 'src/portal/Sidebar.tsx'),
  'utf-8',
)

// ── PILOT-FEEDBACK-001 Change 1 — sidebar footer ─────────────────────

describe('Sidebar footer copy — PORTAL 2.0 · PREVIEW removed', () => {
  it("does not render 'Portal 2.0 · Preview' anywhere in the sidebar source", () => {
    expect(SIDEBAR_SRC).not.toContain('Portal 2.0 · Preview')
    expect(SIDEBAR_SRC).not.toContain('Portal 2.0 · PREVIEW')
    expect(SIDEBAR_SRC).not.toContain('PORTAL 2.0 · PREVIEW')
  })

  it("replaces the preview footer with 'Because Choices Matter.'", () => {
    expect(SIDEBAR_SRC).toContain('Because Choices Matter.')
  })
})

// ── PILOT-FEEDBACK-001 Change 2 — form UX ────────────────────────────

describe('FeedbackFormClient — clean, minimal, all questions optional', () => {
  it('renders every one of the 6 pilot questions', () => {
    render(<FeedbackFormClient />)
    expect(
      screen.getByText(/Without any help, what did you think you were supposed to do first\?/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Was anything confusing or unclear\?/)).toBeInTheDocument()
    expect(
      screen.getByText(/Did you get stuck anywhere\? If yes, where\?/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/If you could improve one thing, what would it be\?/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Overall onboarding experience/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Anything else you'd like us to know\?/),
    ).toBeInTheDocument()
  })

  it('starts with the submit button disabled (no answers yet)', () => {
    render(<FeedbackFormClient />)
    const btn = screen.getByTestId('pilot-feedback-submit') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('enables submit once any single answer is present', () => {
    render(<FeedbackFormClient />)
    const btn = screen.getByTestId('pilot-feedback-submit') as HTMLButtonElement
    fireEvent.change(screen.getByTestId('q1_first_action'), {
      target: { value: 'I clicked Begin Your Journey.' },
    })
    expect(btn.disabled).toBe(false)
  })

  it('enables submit if only a rating is present (all narrative fields blank)', () => {
    render(<FeedbackFormClient />)
    const btn = screen.getByTestId('pilot-feedback-submit') as HTMLButtonElement
    fireEvent.click(screen.getByTestId('q5_rating_8'))
    expect(btn.disabled).toBe(false)
  })

  it('renders exactly 10 rating buttons (1–10)', () => {
    render(<FeedbackFormClient />)
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(screen.getByTestId(`q5_rating_${n}`)).toBeInTheDocument()
    }
  })

  it('renders the "every question is optional" hint (no leading language)', () => {
    render(<FeedbackFormClient />)
    expect(screen.getByText(/Every question is optional\./)).toBeInTheDocument()
  })

  it('does NOT include any leading or technical prompts', () => {
    render(<FeedbackFormClient />)
    // Explicit guard against future scope creep. If any of these labels
    // appear it means someone slipped in a leading or engineering
    // question and this change should be rejected in review.
    const forbidden = [
      /would you recommend/i,
      /did you complete pcert/i,
      /rate the platform certification/i,
      /which browser/i,
      /any bugs/i,
      /net promoter/i,
      /nps/i,
    ]
    for (const rx of forbidden) {
      expect(screen.queryByText(rx)).toBeNull()
    }
  })
})
