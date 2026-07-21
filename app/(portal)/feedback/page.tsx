// PILOT-FEEDBACK-001 — Pilot cohort feedback page
//
// Static server component that renders the client form. Sits inside
// the (portal) route group so it inherits the sidebar + auth guard;
// no separate auth check needed here.

import { FeedbackFormClient } from '@/portal/feedback/FeedbackFormClient'

export const dynamic = 'force-dynamic'

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-2xl sm:text-3xl font-semibold text-[#F1F1F3]">
        Pilot Feedback
      </h1>
      <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-[#A1A1AA]">
        Thanks for helping us shape the platform. Answer whichever
        questions feel useful — nothing is required.
      </p>
      <div className="mt-8">
        <FeedbackFormClient />
      </div>
    </div>
  )
}
