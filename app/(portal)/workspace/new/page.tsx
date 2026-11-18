// ============================================================================
// TRANSACTION OS 3.3B.3A — /workspace/new (Transaction Wizard entry)
// ============================================================================
// The Agent Transaction Wizard's route. Lives inside the (portal) route group,
// so it inherits the Sidebar / TopBar / CommandBar shell from
// app/(portal)/layout.tsx automatically. This page is a thin wrapper: it
// renders the client WizardShell inside a Suspense boundary (required because
// the shell reads `?step=` via useSearchParams).
//
// LEAD-LIFECYCLE · `?client=<client_profiles.id>` starts the transaction for a
// lead. The profile is read here with the AGENT'S OWN session through the same
// loader as the client page (RLS + canAccess), so an id the agent cannot see
// reads as unavailable and nothing is linked. Only the id travels in the URL;
// the client's name and contact details never do. The create route re-checks
// ownership and lead eligibility on submit.
//
// The legacy single-page /transactions/new form is left UNTOUCHED.
// ============================================================================

import { Suspense } from "react";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import WizardShell from "@/src/portal/workspace/new/WizardShell";
import type { LinkedClient } from "@/src/portal/workspace/new/wizard-session";
import { loadClientDetail } from "@/src/portal/clients/loader";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readLinkedClient(clientId: string): Promise<LinkedClient | null> {
  if (!UUID_RE.test(clientId)) return null;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(_n: string, _v: string, _o: CookieOptions) { /* read-only */ },
        remove(_n: string, _o: CookieOptions) { /* read-only */ },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: string | null }>();
  const result = await loadClientDetail({
    supabase,
    callerId: session.user.id,
    callerRole: prof?.role ?? "agent",
    clientId,
  });
  if (result.kind !== "ok") return null;
  const c = result.client as { id: string; full_name?: string | null; email?: string | null; phone?: string | null };
  return { id: c.id, full_name: c.full_name ?? null, email: c.email ?? null, phone: c.phone ?? null };
}

export default async function NewTransactionWizardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string | string[] }>;
}) {
  const sp = await searchParams;
  const clientId = typeof sp.client === "string" ? sp.client.trim() : "";
  const linkClient = clientId ? await readLinkedClient(clientId) : null;

  return (
    <Suspense
      fallback={
        <div className="max-w-[760px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading…
        </div>
      }
    >
      <WizardShell linkClient={linkClient} linkClientUnavailable={!!clientId && !linkClient} />
    </Suspense>
  );
}
