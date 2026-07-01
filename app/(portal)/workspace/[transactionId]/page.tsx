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
import { fetchFormDetail } from "@/src/portal/documents/details/api";
import { parseFormId } from "@/src/portal/documents/details/helpers";
import type { FormDetailBundle } from "@/src/portal/documents/details/types";
import { composeBannerState } from "@/src/portal/workspace/banner/compose-banner-state";
import { fetchPayoutReadinessSafely } from "@/src/portal/workspace/compliance/api";
import { composeComplianceTabState } from "@/src/portal/workspace/compliance/compose-compliance-tab";
import type { ComplianceTabState } from "@/src/portal/workspace/compliance/types";
import type { MissingFieldsItem } from "@/src/portal/documents/details/types";
import { fetchTimelineHistorySafely } from "@/src/portal/workspace/timeline/api";
import { fetchCommissionWorkspaceSafely } from "@/src/portal/workspace/commission/api";
import { composeCommissionState } from "@/src/portal/workspace/commission/compose-commission";
import type { CommissionWorkspaceState } from "@/src/portal/workspace/commission/types";
import { composeTimelineState } from "@/src/portal/workspace/timeline/compose-timeline";
import type { TimelineTabState } from "@/src/portal/workspace/timeline/types";

export default async function TransactionWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<{ tab?: string; form?: string }>;
}) {
  const { transactionId } = await params;
  const sp = await searchParams;
  const activeTab: TabId = parseTab(sp.tab);
  const rawFormParam = typeof sp.form === "string" ? sp.form : null;

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
  // Workflow 3.2.C.1 — extend the existing direct-Supabase SELECT with
  // `status` + `broker_review_status` to drive the ComplianceBanner.
  // RLS (SEC.3B.M2 live on transactions) enforces tenant scoping; this
  // adds columns to a row Vault already authorizes the caller to read.
  // Workflow 3.2.C.2 — add `closing_date` to the existing select for the
  // Compliance tab "closing in N days" warning. Same RLS-bound row.
  const txnRowPromise = supabase
    .from("transactions")
    .select("client_email, client_name, status, broker_review_status, closing_date")
    .eq("id", transactionId)
    .maybeSingle<{
      client_email: string | null;
      client_name: string | null;
      status: string | null;
      broker_review_status: string | null;
      closing_date: string | null;
    }>();
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
  // Workflow 3.2.C.1 — page-level /missing-fields fetch. Banner always
  // renders and needs statutory counts; lifting this off the drawer-
  // only path (W3.2.A) means future Compliance/Commission tabs can
  // consume it for free. Soft-fails to zero counts on error so the
  // banner still renders the rest of the signals.
  const missingFieldsPromise = fetchMissingFieldsSafely({
    accessToken: session.access_token,
    transactionId,
  });
  // Workflow 3.2.C.2 — page-level payout-readiness fetch (agent-readable).
  // Soft-fails to null so Compliance tab still renders its other sections
  // when this endpoint is degraded. Boundary-masked via toSafePayoutReadiness.
  const payoutReadinessPromise = fetchPayoutReadinessSafely({
    accessToken: session.access_token,
    transactionId,
  });
  // Workflow 3.3.1 — Timeline history fetch. BROKER-ONLY at the
  // function-level gate (isBrokerTier check); agent role short-circuits
  // to { kind: 'skip' } without ever calling Vault's /history.
  const timelineHistoryPromise = fetchTimelineHistorySafely({
    accessToken: session.access_token,
    transactionId,
    callerRole,
  });
  // Workflow 3.4.3.1 — Commission Workspace fetch (server-only api.ts
  // owns endpoint paths). Two-stage: list the caller's commissions and
  // pick the one for this transaction; then call the W3.4.3.0 read-
  // only gate-verdict endpoint for the per-gate verdict + payable flag.
  // Both fail soft. Result is boundary-masked at the api.ts layer —
  // composer never sees amounts / splits / Stripe IDs / notes.
  const commissionWorkspacePromise = fetchCommissionWorkspaceSafely({
    accessToken: session.access_token,
    transactionId,
  });
  const [
    clientIntelligence,
    documentsResult,
    missingFieldsSummary,
    payoutReadinessSafe,
    timelineHistoryResult,
    commissionWorkspaceResult,
  ] = await Promise.all([
      loadClientIntelligenceForTransaction({
        supabase,
        callerId: session.user.id,
        callerRole,
        clientEmail: txnRow?.client_email ?? null,
        clientName: txnRow?.client_name ?? resolvedCard.client_name,
      }) as Promise<ClientIntelligenceResult>,
      documentsPromise,
      missingFieldsPromise,
      payoutReadinessPromise,
      timelineHistoryPromise,
      commissionWorkspacePromise,
    ]);

  const documents =
    documentsResult.kind === "ok" ? documentsResult.documents : [];
  const rawRequirements =
    documentsResult.kind === "ok" ? documentsResult.requirements : [];
  const rawInstances =
    documentsResult.kind === "ok" ? documentsResult.instances : [];
  const documentsError =
    documentsResult.kind === "error"
      ? `HTTP ${documentsResult.status}`
      : null;

  const paperworkPackageUrl = vaultPaperworkUrl(resolvedCard.transaction_id, vaultBase);

  // ── Compose ComplianceBanner state (Workflow 3.2.C.1) ──────────────
  // Pure derivation from already-loaded signals. No commission amounts,
  // no broker notes, no Stripe data — composer's input type excludes them.
  const bannerState = composeBannerState({
    readiness_tier: resolvedCard.readiness_tier,
    required_forms_count: resolvedCard.required_forms_count,
    ready_forms_count: resolvedCard.ready_forms_count,
    signed_forms_count: resolvedCard.signed_forms_count,
    blocked_forms_count: resolvedCard.blocked_forms_count,
    pending_envelopes_count: resolvedCard.pending_envelopes_count,
    portal_status: resolvedCard.portal_status,
    broker_confirmation_required: resolvedCard.broker_confirmation_required,
    statutory_count: missingFieldsSummary.statutory_count,
    satisfied_statutory_count: missingFieldsSummary.satisfied_statutory_count,
    broker_review_status: txnRow?.broker_review_status ?? null,
    transaction_status: txnRow?.status ?? null,
  });

  // ── Compose ComplianceTab state (Workflow 3.2.C.2) ─────────────────
  // Only compose when Compliance tab is active — saves wasted CPU on
  // other tabs since the composer maps every document + every missing
  // item. Pure derivation; no fetches.
  let complianceState: ComplianceTabState | null = null;
  if (activeTab === "compliance") {
    const rawRequirementsForCompliance =
      documentsResult.kind === "ok" ? documentsResult.requirements : [];
    complianceState = composeComplianceTabState({
      card: resolvedCard,
      missingItems: missingFieldsSummary.items,
      satisfiedStatutoryPaths: missingFieldsSummary.satisfied_statutory_paths,
      statutoryCount: missingFieldsSummary.statutory_count,
      documents,
      requirements: rawRequirementsForCompliance,
      transactionStatus: txnRow?.status ?? null,
      brokerReviewStatus: txnRow?.broker_review_status ?? null,
      closingDate: txnRow?.closing_date ?? null,
      payoutReadiness: payoutReadinessSafe,
      paperworkPackageUrl,
    });
  }

  // ── Compose TimelineTab state (Workflow 3.3.1 + W3.4.3.2) ──────────
  // Pure derivation from already-loaded signals + role-gated history.
  // W3.4.3.2: pass-through of W3.4.3.1's commissionWorkspaceResult so
  // the composer can synthesize commission lifecycle cards alongside
  // the existing paperwork events. No new fetch.
  let timelineState: TimelineTabState | null = null;
  if (activeTab === "timeline") {
    timelineState = composeTimelineState({
      callerRole,
      card: resolvedCard,
      documents,
      transactionStatus: txnRow?.status ?? null,
      brokerReviewStatus: txnRow?.broker_review_status ?? null,
      closingDate: txnRow?.closing_date ?? null,
      statutoryCount: missingFieldsSummary.statutory_count,
      satisfiedStatutoryCount: missingFieldsSummary.satisfied_statutory_count,
      history: timelineHistoryResult,
      paperworkPackageUrl,
      commission: commissionWorkspaceResult,
      workspaceBaseUrl: `/workspace/${resolvedCard.transaction_id}`,
    });
  }

  // ── Compose CommissionTab state (Workflow 3.4.3.1) ─────────────────
  // Reads the W3.4.3.0 gate-verdict + safe-projected commission row.
  // Composer is pure; commission logic stays in Vault. NO amounts /
  // splits / Stripe IDs / broker notes / payout IDs surface.
  let commissionState: CommissionWorkspaceState | null = null;
  if (activeTab === "commission") {
    // Map the W3.2.C.2-masked compliance gate status to the broker-side
    // shape names the composer's SideSummary expects. The verdict's
    // blocker list is independently authoritative for the gate-row
    // tone — this informs the side-summary copy only.
    const complianceGate =
      payoutReadinessSafe?.gates.compliance_checklist_complete ?? null;
    const complianceOverallStatus =
      complianceGate === "ok"
        ? "passed"
        : complianceGate === "warning"
        ? "issues_found"
        : complianceGate === "blocked"
        ? "failed"
        : null;
    commissionState = composeCommissionState({
      fetchResult: commissionWorkspaceResult,
      transactionStatus: txnRow?.status ?? null,
      brokerReviewStatus: txnRow?.broker_review_status ?? null,
      complianceOverallStatus,
      closingDate: txnRow?.closing_date ?? null,
      workspaceBaseUrl: `/workspace/${resolvedCard.transaction_id}`,
      paperworkPackageUrl,
    });
  }

  // ── Per-form drawer hydration (Workflow 3.2.A) ─────────────────────
  // Only relevant when the Documents tab is active. parseFormId returns
  // null for any value not in the loaded documents scope — cross-tenant
  // safety bound. Broker-only fetches inside fetchFormDetail are skipped
  // when the caller is agent.
  let activeFormId: string | null = null;
  let activeFormDocument: typeof documents[number] | null = null;
  let activeFormInstanceId: string | null = null;
  let activeFormDetail: FormDetailBundle | null = null;
  if (activeTab === "documents" && rawFormParam) {
    activeFormId = parseFormId(rawFormParam, documents);
    if (activeFormId) {
      activeFormDocument = documents.find((d) => d.form_id === activeFormId) ?? null;
      const requirement =
        rawRequirements.find((r) => r.form_id === activeFormId) ?? null;
      const matchingInstance =
        rawInstances
          .filter((i) => i.form_id === activeFormId)
          .sort((a, b) =>
            (b.updated_at ?? "") > (a.updated_at ?? "") ? 1 : -1
          )[0] ?? null;
      activeFormInstanceId = matchingInstance?.id ?? null;
      if (activeFormDocument) {
        activeFormDetail = await fetchFormDetail({
          accessToken: session.access_token,
          transactionId,
          formInstanceId: activeFormInstanceId,
          callerRole,
          document: activeFormDocument,
          requirement,
        });
      }
    }
  }

  // ── Tab dispatch ──────────────────────────────────────────────────
  const tabContent = (() => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab card={resolvedCard} vaultBase={vaultBase} />;
      case "documents":
        return (
          <DocumentsTab
            transactionId={resolvedCard.transaction_id}
            documents={documents}
            documentsError={documentsError}
            paperworkPackageUrl={paperworkPackageUrl}
            activeFormId={activeFormId}
            activeFormDocument={activeFormDocument}
            activeFormInstanceId={activeFormInstanceId}
            activeFormDetail={activeFormDetail}
            coachRecommendation={resolvedCard.coach_recommendation ?? null}
          />
        );
      case "timeline":
        return timelineState ? <TimelineTab state={timelineState} /> : null;
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
        return complianceState ? <ComplianceTab state={complianceState} /> : null;
      case "commission":
        return commissionState ? <CommissionTab state={commissionState} /> : null;
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
      bannerState={bannerState}
    >
      {tabContent}
    </WorkspaceShell>
  );
}

// ── /missing-fields page-level fetcher (Workflow 3.2.C.1) ────────────
// Server-side. Soft-fails so the banner can render the other signals
// when this single endpoint is degraded. Returns only the aggregate
// counts the composer needs — never the per-blocker text (which may
// reference broker context).

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

interface MissingFieldsSummary {
  statutory_count: number;
  satisfied_statutory_count: number;
  /** Workflow 3.2.C.2 — full items list for the Compliance tab. */
  items: MissingFieldsItem[];
  satisfied_statutory_paths: string[];
}

async function fetchMissingFieldsSafely(input: {
  accessToken: string;
  transactionId: string;
}): Promise<MissingFieldsSummary> {
  const EMPTY: MissingFieldsSummary = {
    statutory_count: 0,
    satisfied_statutory_count: 0,
    items: [],
    satisfied_statutory_paths: [],
  };
  try {
    const res = await fetch(
      `${VAULT_API_URL}/paperwork/transactions/${input.transactionId}/missing-fields`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return EMPTY;
    const body = (await res.json()) as {
      statutory_count?: number;
      satisfied_statutory_paths?: string[];
      items?: MissingFieldsItem[];
    };
    return {
      statutory_count:
        typeof body?.statutory_count === "number" ? body.statutory_count : 0,
      satisfied_statutory_count: Array.isArray(body?.satisfied_statutory_paths)
        ? body.satisfied_statutory_paths.length
        : 0,
      items: Array.isArray(body?.items) ? body.items : [],
      satisfied_statutory_paths: Array.isArray(body?.satisfied_statutory_paths)
        ? body.satisfied_statutory_paths
        : [],
    };
  } catch {
    return EMPTY;
  }
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
