// ============================================================================
// TODAY B.002 · Slice 2 — TodayRow (purpose-built, scan-optimized Home row)
// ============================================================================
// A lightweight, SERVER-renderable row for the Home "Today" surface. It is
// intentionally NOT WorkspaceCard — it shows only the most urgent information
// Vault already supplies, optimized for fast top-of-Home scanning. It never
// fetches, buckets, mutates, or calculates dates; every value comes from the
// Vault-provided `deadline_summary` via the existing deadline-view helpers.
//
// Scanning hierarchy: property → most urgent deadline → urgency (explicit text)
// → Open Transaction. Urgency is conveyed with TEXT (a11y), tone only accents it.
// ============================================================================
import Link from "next/link";
import type { LifecycleTone, WorkspaceCard } from "../workspace/types";
import { deadlineChipVM, hasDeadlineSummary } from "../workspace/deadline-view";

// Text-only tone accents, mirroring the app's LifecycleTone palette
// (workspace/tabs/OverviewTab TONE_CLASS). Urgency never relies on color alone.
const TONE_TEXT: Record<LifecycleTone, string> = {
  ok: "text-emerald-300",
  info: "text-sky-300",
  warn: "text-amber-300",
  muted: "text-[#A1A1AA]",
};

export default function TodayRow({ card }: { card: WorkspaceCard }) {
  // Fail-safe: never render a row without a Vault-provided deadline. The Today
  // buckets only pass projectable cards; this guards against misuse and never
  // fabricates deadline information.
  if (!hasDeadlineSummary(card.deadline_summary)) return null;

  const vm = deadlineChipVM(card.deadline_summary);
  const property = card.property_address?.trim() || "Untitled transaction";
  const deadlineText = [vm.next_deadline_label, vm.due_date_label].filter(Boolean).join(" · ") || null;
  const extraOverdue = vm.overdue_count > 1 ? vm.overdue_count - 1 : 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2.5">
      <div className="min-w-0">
        {/* 1. Property — primary identifier */}
        <div className="truncate text-sm font-medium text-[#F1F1F3]" title={property}>
          {property}
        </div>

        {/* 2. Most urgent deadline — secondary */}
        {deadlineText && (
          <div className="truncate text-xs text-[#A1A1AA]" title={deadlineText}>
            {deadlineText}
          </div>
        )}

        {/* 3. Urgency — explicit TEXT (not color alone) + optional additional-overdue */}
        {(vm.days_label || extraOverdue > 0) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {vm.days_label && <span className={`font-medium ${TONE_TEXT[vm.days_tone]}`}>{vm.days_label}</span>}
            {extraOverdue > 0 && <span className="text-amber-300">+{extraOverdue} more overdue</span>}
          </div>
        )}
      </div>

      {/* 4. Open Transaction — one clear, keyboard-navigable route into the workspace */}
      <Link
        href={`/workspace/${card.transaction_id}`}
        aria-label={`Open transaction — ${property}`}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#E8D5A3] hover:underline"
      >
        Open <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
