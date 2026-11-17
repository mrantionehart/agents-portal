'use client'

// HARTFELT READY D6 — reading-lesson view. Renders a lesson's markdown body as
// plain React elements (headings, paragraphs, bullet lists, **bold**) — no
// HTML injection — in a readable, mobile-first column, with the learner's
// "I have read this lesson" action.

import { CheckCircle2, FileText } from 'lucide-react'
import type { ReactNode } from 'react'

function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${key}-${i}`} className="text-white">{part.slice(2, -2)}</strong>
      : <span key={`${key}-${i}`}>{part}</span>,
  )
}

export function renderLessonMarkdown(md: string): ReactNode[] {
  const out: ReactNode[] = []
  const blocks = md.replace(/\r\n/g, '\n').trim().split(/\n{2,}/)
  blocks.forEach((block, b) => {
    const lines = block.split('\n')
    if (/^#{1,6}\s/.test(lines[0]) && lines.length === 1) {
      out.push(<h3 key={b} className="text-lg sm:text-xl font-semibold text-white mt-2">{inline(lines[0].replace(/^#{1,6}\s+/, ''), `h${b}`)}</h3>)
    } else if (lines.every((l) => /^\s*-\s+/.test(l))) {
      out.push(
        <ul key={b} className="list-disc pl-5 space-y-1.5">
          {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*-\s+/, ''), `l${b}-${i}`)}</li>)}
        </ul>,
      )
    } else {
      out.push(<p key={b}>{inline(lines.join(' '), `p${b}`)}</p>)
    }
  })
  return out
}

interface Props {
  title: string
  lessonNumber: string
  body: string
  completed: boolean
  saving?: boolean
  onComplete: () => void
}

export default function ReadingLesson({ title, lessonNumber, body, completed, saving, onComplete }: Props) {
  return (
    <article aria-label={`Lesson ${lessonNumber}: ${title}`} className="bg-[#0a0a0f] rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#C9A84C] mb-1">
        <FileText className="w-4 h-4" aria-hidden="true" /> Reading lesson {lessonNumber}
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">{title}</h2>
      <div data-testid="lesson-body" className="max-w-prose space-y-4 text-[15px] sm:text-base leading-7 text-gray-200 break-words">
        {renderLessonMarkdown(body)}
      </div>
      <div className="mt-6 border-t border-gray-800 pt-4">
        <button
          type="button"
          onClick={onComplete}
          disabled={completed || saving}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition ${
            completed ? 'bg-green-500/15 text-green-400 cursor-default' : 'bg-[#C9A84C] text-black hover:bg-[#b8963f]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          {completed ? 'Lesson completed' : saving ? 'Saving…' : 'I have read this lesson'}
        </button>
      </div>
    </article>
  )
}
