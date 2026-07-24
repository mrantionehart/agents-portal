// ============================================================================
// TODAY B.005 · Slice 5 — BusinessSnapshot (grouped business widgets)
// ============================================================================
// A lightweight presentation wrapper that groups the agent's own business
// metrics — Production + Pipeline — into one Home section, below Today. It
// REUSES the existing widgets and pure helpers unchanged; it computes nothing
// new beyond the derivations Home already performed, from the SAME fetched cards
// (no new fetch, no client hooks, no widget-internal changes).
//
// Scope note: only Production + Pipeline belong here (the agent's own business
// output). Market News / Development Radar / Hot Leads / Opportunities are
// external market/lead intelligence and remain in the separate widgets section.
// ============================================================================
import type { WorkspaceCard } from "../workspace/types";
import { pipelineSnapshot, productionSnapshot } from "./intelligence-helpers";
import { PipelineSnapshotWidget, ProductionSnapshotWidget } from "./IntelligenceWidgets";

export default function BusinessSnapshot({ cards }: { cards: WorkspaceCard[] }) {
  // Pure derivations from the already-fetched workspace cards. No new requests.
  const production = productionSnapshot(cards);
  const pipeline = pipelineSnapshot(cards);

  return (
    <section aria-label="Business Snapshot" className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-[#F1F1F3]">Business Snapshot</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductionSnapshotWidget snapshot={production} />
        <PipelineSnapshotWidget snapshot={pipeline} />
      </div>
    </section>
  );
}
