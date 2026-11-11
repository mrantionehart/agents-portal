// ============================================================================
// DEAL-DISPO-AGENTS · Deal Opportunities (Agent Portal)
// ============================================================================
// A shell. No data is read here and no Supabase client is constructed: the
// client component calls Vault's agent-capable dispo routes with the agent's
// own token, and Vault decides what this agent may see. `?id=` deep-links one
// opportunity — the bell notice uses it.
// ============================================================================

export const dynamic = "force-dynamic";

import DealOpportunities from "@/src/portal/deal-opportunities/DealOpportunities";

export default function DealOpportunitiesPage({
  searchParams,
}: { searchParams?: { id?: string | string[] } }) {
  const id = searchParams?.id;
  const initialId = typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Deal Opportunities</h1>
        <p className="mt-1 text-sm text-white/60">
          Off-market deals your broker has shared with you. Tell your broker you&apos;re interested,
          ask a question, or submit an offer for your buyer.
        </p>
      </header>
      <DealOpportunities initialId={initialId} />
    </div>
  );
}
