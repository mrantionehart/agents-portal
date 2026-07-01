// ============================================================================
// AGENT.DOCS.1 — /library HartFelt template library
// ============================================================================
// Server-rendered shell. Reads the caller's Bearer via the (portal)
// Supabase cookie session, calls the Vault agent-scoped template
// endpoint, and hands the safe TemplateCard[] to the client component
// for rendering + per-row download.
// ============================================================================

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle, Library } from "lucide-react";

import LibraryClient from "@/src/portal/library/LibraryClient";
import { fetchAgentTemplates } from "@/src/portal/library/api";

export default async function LibraryPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_n: string, _v: string, _o: CookieOptions) {
          /* read-only */
        },
        remove(_n: string, _o: CookieOptions) {
          /* read-only */
        },
      },
    }
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <Shell>
        <ErrorBanner message="Sign in and reload this page." />
      </Shell>
    );
  }

  const result = await fetchAgentTemplates({
    accessToken: session.access_token,
  });

  return (
    <Shell>
      <LibraryClient
        templates={result.kind === "ok" ? result.templates : []}
        error={result.kind === "error" ? result.message : null}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <header className="flex items-center gap-3">
        <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-2">
          <Library className="h-4 w-4 text-[#E8D5A3]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#F1F1F3]">Form Library</h1>
          <p className="text-xs text-[#71717A]">
            Approved Florida Realtors blank templates. Download and complete
            through your DocuSign account when the transaction doesn&apos;t use
            HartFelt&apos;s auto-generate flow.
          </p>
        </div>
      </header>
      {children}
    </main>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
