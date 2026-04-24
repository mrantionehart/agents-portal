'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Award, RotateCcw, ArrowRight, X } from 'lucide-react'
import type { Quiz } from '@/app/data/quizzes'

interface QuizModalProps {
  quiz: Quiz
  volume: number
  moduleNum: number
  onComplete: (result: { score: number; passed: boolean }) => void
  onClose: () => void
}

export default function QuizModal({ quiz, volume, moduleNum, onComplete, onClose }: QuizModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    score: number
    passed: boolean
    correctCount: number
    totalQuestions: number
    correctAnswers: Record<string, string>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allAnswered = quiz.questions.every(q => answers[q.id])

  const handleSelect = (questionId: string, optionId: string) => {
    if (result) return // No changes after submission
    setAnswers(prev => ({ ...prev, [questionId]: optionId }))
  }

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const resp = await fetch('/api/training/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume, module_num: moduleNum, answers }),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${resp.status}`)
      }

      const data = await resp.json()
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    setAnswers({})
    setResult(null)
    setError(null)
  }

  const handleContinue = () => {
    if (result) {
      onComplete({ score: result.score, passed: result.passed })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#0a0a0f] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0f] border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-xl font-bold text-white">{quiz.title}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {quiz.questions.length} questions — {quiz.passingScore}% to pass
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-400 hover:bg-[#111] rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Result banner */}
        {result && (
          <div
            className={`mx-6 mt-4 p-4 rounded-lg flex items-center gap-3 ${
              result.passed
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            {result.passed ? (
              <Award className="w-8 h-8 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            )}
            <div>
              <p
                className={`font-bold text-lg ${
                  result.passed ? 'text-green-400' : 'text-red-800'
                }`}
              >
                {result.passed ? 'You passed!' : 'Not quite — try again'}
              </p>
              <p className={`text-sm ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                Score: {result.score}% ({result.correctCount}/{result.totalQuestions} correct)
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Questions */}
        <div className="px-6 py-4 space-y-6">
          {quiz.questions.map((q, idx) => {
            const userAnswer = answers[q.id]
            const correctAnswer = result?.correctAnswers[q.id]
            const isCorrect = result ? userAnswer === correctAnswer : null

            return (
              <div key={q.id} className="space-y-3">
                <p className="font-semibold text-white">
                  <span className="text-blue-600 mr-2">{idx + 1}.</span>
                  {q.question}
                </p>
                <div className="space-y-2 ml-1">
                  {q.options.map(opt => {
                    const isSelected = userAnswer === opt.id
                    const isThisCorrect = result && opt.id === correctAnswer
                    const isThisWrong = result && isSelected && opt.id !== correctAnswer

                    let optionClasses =
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition'

                    if (result) {
                      if (isThisCorrect) {
                        optionClasses += ' bg-green-500/10 border-green-300 text-green-900'
                      } else if (isThisWrong) {
                        optionClasses += ' bg-red-500/10 border-red-300 text-red-900'
                      } else {
                        optionClasses += ' border-[#1a1a2e] text-gray-400'
                      }
                    } else if (isSelected) {
                      optionClasses += ' bg-blue-500/10 border-blue-400 text-blue-900'
                    } else {
                      optionClasses +=
                        ' border-[#1a1a2e] text-gray-200 hover:bg-[#0a0a0f] hover:border-[#1a1a2e] cursor-pointer'
                    }

                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelect(q.id, opt.id)}
                        disabled={!!result}
                        className={optionClasses}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? result
                                ? isThisCorrect
                                  ? 'border-green-500 bg-green-500/100'
                                  : 'border-red-500 bg-red-500/100'
                                : 'border-blue-500 bg-blue-500/100'
                              : isThisCorrect
                                ? 'border-green-500 bg-green-500/100'
                                : 'border-[#1a1a2e]'
                          }`}
                        >
                          {(isSelected || isThisCorrect) && result && (
                            isThisCorrect ? (
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            ) : (
                              <XCircle className="w-3 h-3 text-white" />
                            )
                          )}
                          {isSelected && !result && (
                            <span className="w-2 h-2 rounded-full bg-[#0a0a0f]" />
                          )}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                      </button>
                    )
                  })}
                </div>
                {result && isCorrect === false && (
                  <p className="text-xs text-red-600 ml-1">
                    Correct answer: {q.options.find(o => o.id === correctAnswer)?.text}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-[#0a0a0f] border-t px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
          {!result ? (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition ${
                allAnswered && !submitting
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-[#1a1a2e] text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          ) : result.passed ? (
            <button
              onClick={handleContinue}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition"
            >
              Continue to Next Module
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
