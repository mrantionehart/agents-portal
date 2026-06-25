// ============================================================================
// AGENT PORTAL 2.1 — R2B — /workspace/portals/[portalId]
// ============================================================================
// Server-rendered. Calls:
//   GET vault.*/api/deal-portals/advisor/[id]  (Bearer)
//        → portal + views + media
//   GET agents.*/api/broker/deal-portals/[id]/feedback  (cookie)
//        → aggregated feedback (proxy re-implements Vault's gates)
//
// Both endpoints return 404 for cross-tenant / role-rejected / missing
// — this page just maps to notFound() so existence never leaks.
// ============================================================================

export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle, Share2 } from "lucide-react";

import PortalDetailClient from "@/src/portal/portals/PortalDetailClient";
import {
  fetchPortalDetail,
  fetchPortalFeedback,
} from "@/src/portal/portals/detail-api";

export default async function PortalDetailPage({
  params,
}: {
  params: Promise<{ portalId: string }>;
}) {
  const { portalId } = await params;

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
  if (!session) {
    return (
      <Shell>
        <ErrorBanner status={401} message="Sign in to view this portal." />
      </Shell>
    );
  }

  // 1. Portal detail (Vault Bearer)
  const detail = await fetchPortalDetail({
    accessToken: session.access_token,
    portalId,
  });

  // Cross-tenant / role-rejected / missing all map to not_found.
  if (detail.kind === "not_found") notFound();
  if (detail.kind === "error") {
    return (
      <Shell>
        <ErrorBanner status={detail.status} message={detail.message} />
      </Shell>
    );
  }

  // 2. Feedback (agents-portal proxy, same-origin via cookie). We
  // forward the raw cookie header so requireAuth() inside the proxy
  // resolves the same agent identity.
  const hdrs = await headers();
  const cookieHeader =
    hdrs.get("cookie") ??
    cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  // Same-origin base URL — sidesteps the env defaulting if running in
  // preview / local dev.
  const host = hdrs.get("host") ?? "agents.hartfeltrealestate.com";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}`;

  const feedback = await fetchPortalFeedback({
    baseUrl,
    cookieHeader,
    portalId,
  });

  return (
    <Shell>
      <PortalDetailClient
        portal={detail.portal}
        feedback={feedback.kind === "ok" ? feedback.payload : null}
        feedbackError={
          feedback.kind === "error" ? `HTTP ${feedback.status}` : null
        }
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-2 text-[10px] uppercase tracking-wider text-[#71717A] flex items-center gap-1">
        <Share2 className="h-3 w-3 text-[#C9A84C]" />
        Deal Portal Detail
      </header>
      {children}
    </div>
  );
}

function ErrorBanner({ status, message }: { status: number; message: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2 mb-4">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">
          {status === 401
            ? "Please sign in to view this portal."
            : `Couldn't load this portal (HTTP ${status}).`}
        </div>
        {message && (
          <div className="mt-1 text-[11px] text-rose-300/80 truncate">{message}</div>
        )}
      </div>
    </div>
  );
}
