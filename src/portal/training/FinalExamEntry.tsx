'use client'

// HARTFELT-READY-FINAL-1 — the Training Hub's entry point to the one
// comprehensive final. It shows the live lock state rather than a bare link,
// because "locked until all 26 module quizzes pass" is the thing an agent
// most needs to know before clicking.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GraduationCap } from 'lucide-react'

interface Standing {
  unlocked: boolean
  pass_score: number
  required_modules: number
  passed_modules: number
  final_exam: { attempted: boolean; bestScore: number | null; passed: boolean }
}

export function FinalExamEntry() {
  const [s, setS] = useState<Standing | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const res = await fetch('/api/training/final-exam', { cache: 'no-store' })
        if (!res.ok) return
        if (live) setS((await res.json()) as Standing)
      } catch {
        /* the hub still works without this card */
      }
    })()
    return () => { live = false }
  }, [])

  if (!s) return null

  const body = s.final_exam.passed
    ? `Passed at ${s.final_exam.bestScore}%.`
    : s.unlocked
    ? `Unlocked — ${s.pass_score}% to pass.${
        s.final_exam.attempted ? ` Previous best ${s.final_exam.bestScore}%.` : ''
      }`
    : `Locked — ${s.passed_modules} of ${s.required_modules} module quizzes passed.`

  return (
    <div className="mb-6 rounded-lg border border-[#2A2A31] bg-[#17171B] px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <GraduationCap className="h-5 w-5 text-[#C9A84C] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-[#F1F1F3]">
            HartFelt Ready™ — Comprehensive Final Exam
          </p>
          <p className="text-sm text-[#A1A1AA]">{body}</p>
        </div>
      </div>
      {!s.final_exam.passed && (
        <Link
          href="/training-final-exam"
          className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold ${
            s.unlocked
              ? 'bg-[#C9A84C] text-[#15151A]'
              : 'border border-[#2A2A31] text-[#A1A1AA]'
          }`}
        >
          {s.unlocked ? 'Start' : 'View what is left'}
        </Link>
      )}
    </div>
  )
}
