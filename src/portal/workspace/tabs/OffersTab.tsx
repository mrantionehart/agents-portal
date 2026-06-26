// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Offers tab
// ============================================================================
// Placeholder. The `offers` table exists (1 row in prod, 31 columns)
// but has NO `transaction_id` FK — offers attach via buyer_id /
// agent_id / property today. Transaction-linked offers require a
// schema decision in Workflow 3.5 (add nullable `offers.transaction_id`
// FK OR a junction table).
//
// READ-ONLY. No offer creation, no counter-offer, no acceptance.
// ============================================================================

import { Handshake } from "lucide-react";

export default function OffersTab() {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <Handshake className="h-3.5 w-3.5 text-[#C9A84C]" />
        Offers
      </h2>

      <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] py-8 px-5 text-center">
        <p className="text-sm text-[#A1A1AA]">
          Offers are currently pre-transaction artifacts.
        </p>
        <p className="text-xs text-[#71717A] mt-2 max-w-prose mx-auto leading-relaxed">
          The existing <code className="text-[#E8D5A3]">offers</code> table
          captures offer price, escalation cap, contingencies, earnest
          money, cover letter, and risk score — but it attaches to a buyer
          + agent + property, not directly to a transaction. Transaction-linked
          offers (counter-offers, history, accepted-then-graduate-to-transaction
          flow) require <strong className="text-[#A1A1AA] font-normal">Workflow 3.5</strong>.
        </p>
      </div>

      <p className="mt-3 text-[10px] text-[#71717A] leading-relaxed">
        Read-only placeholder. Once linkage exists, this tab will surface
        active offer + counter-offer chain + accepted / rejected / withdrawn
        history.
      </p>
    </section>
  );
}
