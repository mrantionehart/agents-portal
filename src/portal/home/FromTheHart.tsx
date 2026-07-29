// ============================================================================
// From The Hart — daily quote card
// ============================================================================
// A quiet, read-only card that sits just below the morning greeting. One quote,
// no interaction — a personal line from the Broker each day. Presentation only;
// the quote is resolved server-side and passed in.
// ============================================================================

import type { DailyQuote } from "@/src/portal/home/quotes/quote-service";

export default function FromTheHart({ quote, author }: DailyQuote) {
  return (
    <section
      aria-label="From The Hart"
      className="mb-6 rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true">❤️</span>
        <h2 className="text-sm font-semibold tracking-wide text-[#F1F1F3]">From The Hart</h2>
      </div>

      <blockquote className="mt-3 text-lg leading-relaxed text-[#F1F1F3]">
        &ldquo;{quote}&rdquo;
      </blockquote>

      <footer className="mt-4">
        <p className="text-sm text-[#A1A1AA]">&mdash; {author}</p>
        <p className="mt-0.5 text-xs italic text-[#71717A]">Because Choices Matter.</p>
      </footer>
    </section>
  );
}
