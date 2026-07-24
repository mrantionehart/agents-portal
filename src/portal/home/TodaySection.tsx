// ============================================================================
// TODAY B.003 · Slice 3 — TodaySection (deadline-driven Home work queue)
// ============================================================================
// COMPOSITION ONLY. Groups the agent's cards into the four Today groups by
// calling the pure `bucketToday` (Slice 1) exactly once, and renders each item
// through `TodayRow` (Slice 2). It owns grouping/ordering/empty-states/semantics
// — never deadline logic, date formatting, routing, or data loading (all in
// existing modules). Server-renderable: no client directive, no hooks, no state.
// ============================================================================
import type { WorkspaceCard } from "../workspace/types";
import { bucketToday } from "./today-buckets";
import TodayRow from "./TodayRow";

/**
 * A single urgency group. Renders nothing when empty UNLESS `emptyMessage` is
 * supplied (Coming Up), in which case it always renders the heading + message.
 * Rows are wrapped as semantic list items; TodayRow owns the row markup.
 */
function TodayGroup({
  heading,
  cards,
  emptyMessage,
}: {
  heading: string;
  cards: WorkspaceCard[];
  emptyMessage?: string;
}) {
  if (cards.length === 0 && !emptyMessage) return null;
  return (
    <section aria-label={heading} className="mt-4 first:mt-0">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">{heading}</h3>
      {cards.length > 0 ? (
        <ul role="list" className="space-y-1.5">
          {cards.map((card) => (
            <li key={card.transaction_id}>
              <TodayRow card={card} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[#71717A]">{emptyMessage}</p>
      )}
    </section>
  );
}

export default function TodaySection({ cards }: { cards: WorkspaceCard[] }) {
  // Single call — all grouping/urgency comes from Vault via this pure module.
  const buckets = bucketToday(cards);
  const caughtUp =
    buckets.overdue.length === 0 && buckets.dueToday.length === 0 && buckets.dueThisWeek.length === 0;

  return (
    <section aria-labelledby="today-heading" className="mb-8">
      <h2 id="today-heading" className="mb-3 text-sm font-medium text-[#F1F1F3]">
        Today
      </h2>

      {/* Urgency groups — rendered only when populated (no empty headings). */}
      <TodayGroup heading="Overdue" cards={buckets.overdue} />
      <TodayGroup heading="Due Today" cards={buckets.dueToday} />
      <TodayGroup heading="Due This Week" cards={buckets.dueThisWeek} />

      {/* Caught-up state — only when ALL three urgency groups are empty. */}
      {caughtUp && (
        <div className="mt-4 first:mt-0 rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-3 text-sm text-[#A1A1AA]">
          <p className="font-medium text-[#F1F1F3]">
            <span aria-hidden="true">✅ </span>You&apos;re caught up.
          </p>
          <p>No overdue work.</p>
          <p>No deadlines today.</p>
        </div>
      )}

      {/* Coming Up — ALWAYS renders (neutral message when empty). */}
      <TodayGroup heading="Coming Up" cards={buckets.upcoming} emptyMessage="No upcoming deadlines." />
    </section>
  );
}
