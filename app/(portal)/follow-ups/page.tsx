// ============================================================================
// AP-FOLLOWUPS-1 · My Follow-Ups
// ============================================================================
// A shell only. 🔒 No data is read here and no Supabase client is constructed:
// every read and write goes to Vault's server-authorized API from the client
// component, which carries the agent's access token. SEC-CRM-1 revokes
// anon/authenticated from every crm_* object, so a Portal-side query would be
// refused anyway — Vault is the sole backend by construction, not by
// convention.
// ============================================================================

export const dynamic = "force-dynamic";

import MyFollowUps from "@/src/portal/followups/MyFollowUps";

export default function FollowUpsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-bold text-white">My Follow-Ups</h1>
        <p className="mt-1 text-sm text-white/60">
          Your own follow-ups only. Overdue is past and still open; today is the
          calendar day in Eastern.
        </p>
      </header>
      <MyFollowUps clientHref={(id) => `/clients/${id}`} />
    </div>
  );
}
