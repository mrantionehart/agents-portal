// ============================================================================
// EASE-2.0-PLAN-SURFACE-AP-1 — Your Daily Game Plan
// ============================================================================
// Up to five things that actually need the agent today, above the Today queue.
// Server-rendered with the page; no client fetch, no waterfall.
//
// Every row answers three questions in one line: WHAT needs attention (the
// label), WHY (the humanized time), and WHAT I CAN DO (the row is the link).
// Nothing from the wire contract leaks — no signal_type, no dedupe_key, no
// evidence, no raw ISO timestamp.
//
// The card renders even when the plan is empty, because "nothing needs you"
// is information the agent came here for. It is the one honest thing to say
// when most agents genuinely have nothing queued: it does not invent a
// recommendation, does not show a zero, and does not imply we checked systems
// we do not read.
// ============================================================================

import Link from "next/link";

import type { PlanItem } from "./daily-plan-api";

/**
 * Human time for a plan row, in both directions.
 *
 * `relativeTime` in intelligence-helpers is past-only — a meeting three hours
 * from now comes back "just now", which is worse than wrong, it is confidently
 * wrong. This mirrors that vocabulary and adds the future half rather than
 * editing a helper four other widgets depend on.
 */
export function planTimeLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.round((d.getTime() - now.getTime()) / 1000);
  const ahead = secs > 0;
  const n = Math.abs(secs);

  if (n < 60) return ahead ? "Starting now" : "Just now";
  if (n < 3600) {
    const m = Math.floor(n / 60);
    return ahead ? `In ${m}m` : `${m}m ago`;
  }
  if (n < 86400) {
    const h = Math.floor(n / 3600);
    return ahead ? `In ${h}h` : `${h}h ago`;
  }
  const days = Math.floor(n / 86400);
  return ahead ? `In ${days}d` : `${days}d ago`;
}

/** Where a row goes. Item-level for meetings; the list for tasks, which has no detail route. */
export function planHref(item: PlanItem): string {
  return item.subjectKind === "meeting" ? `/meetings/${item.subjectId}` : "/tasks";
}

function PlanRow({ item, now }: { item: PlanItem; now: Date }) {
  return (
    <li>
      <Link
        href={planHref(item)}
        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-black/5 transition-colors"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.label}</span>
          <span className="block text-xs text-neutral-500">{planTimeLabel(item.at, now)}</span>
        </span>
        <span className="shrink-0 text-xs text-neutral-400">{item.actionLabel}</span>
      </Link>
    </li>
  );
}

export default function DailyGamePlan({
  items,
  now = new Date(),
}: {
  items: PlanItem[];
  now?: Date;
}) {
  return (
    <section aria-labelledby="daily-game-plan-heading" className="mb-6">
      <h2 id="daily-game-plan-heading" className="mb-2 text-sm font-semibold tracking-wide">
        Your Daily Game Plan
      </h2>

      {items.length === 0 ? (
        <div className="rounded-lg border border-black/5 px-3 py-4">
          <p className="text-sm font-medium">Nothing needs you right now</p>
          <p className="mt-0.5 text-xs text-neutral-500">Your plan fills in as things come up.</p>
          {/* Scope, stated plainly. The agent should never have to guess how
              much of their world this covers. */}
          <p className="mt-2 text-[11px] text-neutral-400">
            Watching upcoming meetings and overdue tasks.
          </p>
        </div>
      ) : (
        <ul className="rounded-lg border border-black/5 divide-y divide-black/5">
          {items.map((item) => (
            <PlanRow key={`${item.subjectKind}:${item.subjectId}`} item={item} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
