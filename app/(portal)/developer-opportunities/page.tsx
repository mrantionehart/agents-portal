// ============================================================================
// DEVINTEL-P3I · Developer Opportunities (Agent Portal)
// ============================================================================
// A shell only. 🔒 No data is read here and no Supabase client is constructed:
// every read and write goes to Vault's server-authorized API from the client
// component, which carries the agent's access token. `authenticated` holds
// UPDATE on exactly two columns of `dev_opportunities` and RLS limits rows to
// the caller's own assignment, so a Portal-side query would be refused anyway
// — Vault is the sole backend by construction, not by convention.
//
// This route is `/developer-opportunities`. The Portal's existing
// `/opportunities` page (Private Opportunities) is a different, unrelated
// feature and is untouched.
// ============================================================================

export const dynamic = "force-dynamic";

import DeveloperOpportunities from "@/src/portal/developer-opportunities/DeveloperOpportunities";

export default function DeveloperOpportunitiesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Developer Opportunities</h1>
        <p className="mt-1 text-sm text-white/60">
          Developer relationships your broker has assigned to you. A pursuit strategy is a
          strategy — it does not mean a property is available, or that HartFelt is authorized
          to represent it.
        </p>
      </header>
      <DeveloperOpportunities />
    </div>
  );
}
