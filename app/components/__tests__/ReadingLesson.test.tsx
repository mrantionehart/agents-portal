/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ReadingLesson from '../ReadingLesson'

const BODY = '## Material disclosures\n\n**Scope.** Disclose known facts.\n\nAlso required:\n\n- lead-based paint\n- radon notice\n\n<img src=x onerror=alert(1)>'

describe('ReadingLesson', () => {
  it('renders title, heading, paragraphs and list as elements — no raw markdown, no HTML injection', () => {
    const { container } = render(<ReadingLesson title="Material disclosures" lessonNumber="14.5" body={BODY} completed={false} onComplete={() => {}} />)
    expect(screen.getByRole('article', { name: 'Lesson 14.5: Material disclosures' })).toBeInTheDocument()
    expect(screen.getByText('Reading lesson 14.5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Material disclosures' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['lead-based paint', 'radon notice'])
    expect(screen.getByText('Scope.').tagName).toBe('STRONG')
    expect(container.textContent).not.toContain('##')
    expect(container.querySelector('img')).toBeNull()
  })
  it('the primary action is visible and fires once', () => {
    const onComplete = jest.fn()
    render(<ReadingLesson title="T" lessonNumber="14.1" body="Text." completed={false} onComplete={onComplete} />)
    const btn = screen.getByRole('button', { name: /I have read this lesson/ })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
  it('completed and saving states cannot be re-submitted', () => {
    const { rerender } = render(<ReadingLesson title="T" lessonNumber="14.1" body="Text." completed onComplete={() => {}} />)
    expect(screen.getByRole('button', { name: /Lesson completed/ })).toBeDisabled()
    rerender(<ReadingLesson title="T" lessonNumber="14.1" body="Text." completed={false} saving onComplete={() => {}} />)
    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled()
  })
  it('is mobile-first: full-width action, readable column', () => {
    render(<ReadingLesson title="T" lessonNumber="14.1" body="Text." completed={false} onComplete={() => {}} />)
    expect(screen.getByRole('button').className).toMatch(/\bw-full\b.*\bsm:w-auto\b/)
    expect(screen.getByTestId('lesson-body').className).toMatch(/max-w-prose/)
  })
})
