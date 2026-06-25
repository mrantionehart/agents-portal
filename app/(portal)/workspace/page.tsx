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

/** R1: link to the existing legacy /transactions/new creation form. The
 *  Portal does NOT yet wrap the form in the (portal) shell — that lands
 *  in R3. R1's job is just to make the entry point visible. */
const NEW_TRANSACTION_HREF = "/transactions/new";

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
        <WorkspaceFromVault accessToken={session.access_token} vaultBase={vaultBase} />
      )}
    </div>
  );
}

async function WorkspaceFromVault({
  accessToken,
  vaultBase,
}: {
  accessToken: string;
  vaultBase: string;
}) {
  const result = await fetchWorkspaceFromVault({ accessToken, scope: "mine" });
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
