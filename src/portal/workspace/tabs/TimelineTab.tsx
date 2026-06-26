// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Timeline tab
// ============================================================================
// Placeholder rendered with the existing 5-row Timeline shape from the
// pre-3.1 page (preserves visual layout). The merged feed endpoint
// (`/api/paperwork/transactions/[id]/timeline`) ships in Workflow 3.4
// and will pull from paperwork_audit_log + broker_review_history +
// envelope events + commission events.
// ============================================================================

import { Clock } from "lucide-react";

export default function TimelineTab() {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">
        Timeline
      </h2>

      <ul className="space-y-2 text-sm">
        <TimelineRow label="Contract date" />
        <TimelineRow label="Closing date" />
        <TimelineRow label="Last paperwork update" />
        <TimelineRow label="Last signature activity" />
        <TimelineRow label="Last portal activity" />
      </ul>

      <div className="mt-4 rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2.5 text-[11px] text-[#71717A] leading-relaxed flex items-start gap-2">
        <Clock className="h-3 w-3 text-[#71717A] mt-0.5 shrink-0" />
        <span>
          Timeline feed will connect to paperwork audit log, broker review
          history, envelope events, and commission events in{" "}
          <strong className="text-[#A1A1AA] font-normal">Workflow 3.4</strong>.
          Data already exists in Vault (paperwork_audit_log, broker_review_history,
          paperwork_envelopes, commissions); this tab will mount the merged
          read-only feed.
        </span>
      </div>
    </section>
  );
}

function TimelineRow({ label }: { label: string }) {
  return (
    <li className="flex items-baseline justify-between">
      <span className="text-[#A1A1AA]">{label}</span>
      <span className="text-[#71717A]">—</span>
    </li>
  );
}
