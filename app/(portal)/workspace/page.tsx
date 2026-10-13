// ============================================================================
// AGENT PORTAL 2.0 — Workspace screen
// ============================================================================
// Server-rendered. Reads the agent's session via @supabase/ssr, calls
// Vault's existing GET /api/platform/workspace with the user's access
// token forwarded as Bearer, and renders the card grid.
//
// Read-only. No new API. No DB writes. No paperwork logic — Vault is
// the source of truth.
// ============================================================================

export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { Plus } from "lucide-react";

import WorkspaceClient from "@/src/portal/workspace/WorkspaceClient";
import { fetchWorkspaceFromVault, vaultSiteBase } from "@/src/portal/workspace/api";

/** Transaction OS 3.3B.3A: the primary entry point is now the in-portal
 *  Transaction Wizard at /workspace/new (inside the (portal) shell). The
 *  legacy single-page /transactions/new form is left untouched. */
const NEW_TRANSACTION_HREF = "/workspace/new";

export default async function WorkspacePage() {
  const cookieStore = await cookies();

  // Server Supabase client. Mirrors the existing /api/auth/me pattern.
  // Only purpose: read the user's session from the cookie jar; we do
  // NOT mutate cookies from this page.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_name: string, _value: string, _options: CookieOptions) {
          /* read-only on this page */
        },
        remove(_name: string, _options: CookieOptions) {
          /* read-only on this page */
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const vaultBase = vaultSiteBase();

  // Render the shell + heading regardless of session state — even when
  // we can't fetch, the chrome around the error banner stays consistent.
  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">Workspace</h1>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Active transactions and next actions.
          </p>
        </div>
        <Link
          href={NEW_TRANSACTION_HREF}
          className="
            shrink-0 inline-flex items-center gap-1.5
            rounded-md bg-[#C9A84C] text-[#0b0b10]
            px-3 py-1.5 text-sm font-medium
            hover:bg-[#E8D5A3]
            transition-colors duration-[180ms]
          "
        >
          <Plus className="h-4 w-4" aria-hidden /> New Transaction
        </Link>
      </header>

      {!session ? (
        <WorkspaceClient
          items={[]}
          vaultBase={vaultBase}
          error={{
            status: 401,
            message: "Sign in and reload this page.",
          }}
        />
      ) : (
        <WorkspaceFromVault
          accessToken={session.access_token}
          vaultBase={vaultBase}
          scope={await resolveWorkspaceScope(supabase, session.user.id)}
        />
      )}
    </div>
  );
}

/**
 * LEASE-WALKTHROUGH-1 — which Vault scope this caller should get.
 *
 * This was hardcoded to "mine", which filters transactions by
 * agent_id = caller.id. For an agent that is correct. For a BROKER it means
 * an empty workspace: brokers are not the assigned agent on anything, so they
 * could never open a lease transaction, and therefore never reach
 * Documents → Walkthrough.
 *
 * Vault has supported `?scope=office` for broker tier all along and refuses it
 * for anyone else with a 403, so the tenant boundary and the role check both
 * stay server-side. This only decides which of the two to ASK for; an
 * unreadable role falls back to "mine", the narrower scope.
 */
const BROKER_TIER = new Set(["broker", "admin", "office_manager"]);

async function resolveWorkspaceScope(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<"mine" | "office"> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (data as { role?: string | null } | null)?.role ?? "";
  return BROKER_TIER.has(role) ? "office" : "mine";
}

async function WorkspaceFromVault({
  accessToken,
  scope,
  vaultBase,
}: {
  accessToken: string;
  scope: "mine" | "office";
  vaultBase: string;
}) {
  const result = await fetchWorkspaceFromVault({ accessToken, scope });
  if (result.ok === true) {
    return <WorkspaceClient items={result.items} vaultBase={vaultBase} />;
  }
  return (
    <WorkspaceClient
      items={[]}
      vaultBase={vaultBase}
      error={{ status: result.status, message: result.message }}
    />
  );
}
