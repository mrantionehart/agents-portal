// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Transaction Workspace (tabbed)
// ============================================================================
// Refactor of the AP2.1C single-column page into a tabbed OS shell.
// Existing data loads preserved byte-for-byte:
//   - fetchWorkspaceFromVault (R0)
//   - office-scope notFound fallback (preserves cross-tenant safety)
//   - profile role + transactions row (AP2.1D)
//   - Client Intelligence + Documents in parallel (R4 + AP2.1D)
//
// New: parses `?tab=`, validates via parseTab (unknown → overview),
// dispatches to the matching tab component inside WorkspaceShell.
// READ-ONLY. No new APIs, no new fetches, no mutations.
// ============================================================================

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { fetchDocumentsForTransaction } from "@/src/portal/documents/api";
import { fetchWorkspaceFromVault, vaultSiteBase } from "@/src/portal/workspace/api";
import {
  loadClientIntelligenceForTransaction,
  type ClientIntelligenceResult,
} from "@/src/portal/workspace/client-intelligence";
import {
  findCardById,
  vaultPaperworkUrl,
  vaultTransactionUrl,
} from "@/src/portal/workspace/transaction-helpers";

import WorkspaceShell from "@/src/portal/workspace/tabs/WorkspaceShell";
import OverviewTab from "@/src/portal/workspace/tabs/OverviewTab";
import DocumentsTab from "@/src/portal/workspace/tabs/DocumentsTab";
import TimelineTab from "@/src/portal/workspace/tabs/TimelineTab";
import ClientTab from "@/src/portal/workspace/tabs/ClientTab";
import OffersTab from "@/src/portal/workspace/tabs/OffersTab";
import ComplianceTab from "@/src/portal/workspace/tabs/ComplianceTab";
import CommissionTab from "@/src/portal/workspace/tabs/CommissionTab";
import AITab from "@/src/portal/workspace/tabs/AITab";
import { parseTab, type TabId } from "@/src/portal/workspace/tabs/tab-config";

export default async function TransactionWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { transactionId } = await params;
  const sp = await searchParams;
  const activeTab: TabId = parseTab(sp.tab);

  // ── Auth + session ────────────────────────────────────────────────
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

  const vaultBase = vaultSiteBase();

  if (!session) {
    return (
      <ErrorShell transactionId={transactionId} vaultBase={vaultBase}>
        <ErrorBanner status={401} message="Sign in and reload this page." />
      </ErrorShell>
    );
  }

  // ── Pull workspace cards from Vault, find this transaction ────────
  const result = await fetchWorkspaceFromVault({
    accessToken: session.access_token,
    scope: "mine",
  });

  if (result.ok === false) {
    return (
      <ErrorShell transactionId={transactionId} vaultBase={vaultBase}>
        <ErrorBanner status={result.status} message={result.message} />
      </ErrorShell>
    );
  }

  const card = findCardById(result.items, transactionId);
  let resolvedCard = card;
  if (!resolvedCard) {
    // Either invalid id OR not visible under the agent's own scope.
    // Try office scope as a fallback for broker-tier callers (Vault
    // returns 403 to agents, which we surface as "not found" — never
    // leaking existence).
    const officeResult = await fetchWorkspaceFromVault({
      accessToken: session.access_token,
      scope: "office",
    });
    resolvedCard =
      officeResult.ok === true
        ? findCardById(officeResult.items, transactionId)
        : undefined;
    if (!resolvedCard) notFound();
  }

  // ── Parallel data loads — preserved from AP2.1C / AP2.1D / R4 ────
  const callerProfilePromise = supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", session.user.id)
    .maybeSingle<{ role: string; full_name: string | null }>();
  const txnRowPromise = supabase
    .from("transactions")
    .select("client_email, client_name")
    .eq("id", transactionId)
    .maybeSingle<{ client_email: string | null; client_name: string | null }>();
  const [{ data: callerProfile }, { data: txnRow }] = await Promise.all([
    callerProfilePromise,
    txnRowPromise,
  ]);
  const callerRole = callerProfile?.role ?? "agent";
  const agentName = callerProfile?.full_name ?? session.user.email ?? null;

  const documentsPromise = fetchDocumentsForTransaction({
    accessToken: session.access_token,
    transactionId,
    vaultSiteBase: vaultBase,
  });
  const [clientIntelligence, documentsResult] = await Promise.all([
    loadClientIntelligenceForTransaction({
      supabase,
      callerId: session.user.id,
      callerRole,
      clientEmail: txnRow?.client_email ?? null,
      clientName: txnRow?.client_name ?? resolvedCard.client_name,
    }) as Promise<ClientIntelligenceResult>,
    documentsPromise,
  ]);

  const documents =
    documentsResult.kind === "ok" ? documentsResult.documents : [];
  const documentsError =
    documentsResult.kind === "error"
      ? `HTTP ${documentsResult.status}`
      : null;

  const paperworkPackageUrl = vaultPaperworkUrl(resolvedCard.transaction_id, vaultBase);

  // ── Tab dispatch ──────────────────────────────────────────────────
  const tabContent = (() => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab card={resolvedCard} vaultBase={vaultBase} />;
      case "documents":
        return (
          <DocumentsTab
            documents={documents}
            documentsError={documentsError}
            paperworkPackageUrl={paperworkPackageUrl}
          />
        );
      case "timeline":
        return <TimelineTab />;
      case "client":
        return (
          <ClientTab
            clientIntelligence={clientIntelligence}
            fallbackClientName={resolvedCard.client_name}
          />
        );
      case "offers":
        return <OffersTab />;
      case "compliance":
        return <ComplianceTab />;
      case "commission":
        return <CommissionTab />;
      case "ai":
        return <AITab transactionId={resolvedCard.transaction_id} />;
    }
  })();

  return (
    <WorkspaceShell
      card={resolvedCard}
      vaultBase={vaultBase}
      activeTab={activeTab}
      agentName={agentName}
      dealPortal={{ kind: "unknown" }}
    >
      {tabContent}
    </WorkspaceShell>
  );
}

// ── Error shell (unauthed / fetch-failed paths) ──────────────────────

function ErrorShell({
  transactionId,
  vaultBase,
  children,
}: {
  transactionId: string;
  vaultBase: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Link
        href="/workspace"
        className="text-xs text-[#71717A] hover:text-[#A1A1AA] inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Workspace
      </Link>
      <h1 className="text-2xl font-semibold text-[#F1F1F3]">
        Transaction{" "}
        <span className="text-[#71717A]">{transactionId.slice(0, 8)}…</span>
      </h1>
      <p className="text-sm text-[#A1A1AA] mt-1 mb-6">
        Workspace pulls from Vault. Broker confirmation is required for any change.
      </p>
      <div className="space-y-4">{children}</div>
      <div className="mt-6 text-[11px] text-[#71717A]">
        <a
          href={vaultTransactionUrl(transactionId, vaultBase)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#A1A1AA] hover:text-[#F1F1F3] inline-flex items-center gap-1"
        >
          Open in Vault
        </a>
      </div>
    </div>
  );
}

function ErrorBanner({ status, message }: { status: number; message: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">
          {status === 401
            ? "Please sign in to view this transaction."
            : status === 403
            ? "You don't have permission to view this transaction."
            : `Couldn't load the transaction (HTTP ${status}).`}
        </div>
        {message && (
          <div className="mt-1 text-[11px] text-rose-300/80 truncate">{message}</div>
        )}
      </div>
    </div>
  );
}
