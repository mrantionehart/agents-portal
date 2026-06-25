// ============================================================================
// AGENT PORTAL 2.0 — AP2.1C — Transaction Workspace
// ============================================================================
// Server-rendered per-transaction screen. Filters Vault's existing
// /api/platform/workspace response by transactionId. No new Vault
// endpoint, no Portal API routes, no DB writes.
//
// Read-only. AI panel posts to Vault's existing /api/ai/chat with the
// documented payload contract. No new chat logic. No new tools.
// ============================================================================

export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { ArrowLeft, ExternalLink, FileText, Sparkles } from "lucide-react";

import AIAssistantPanel from "@/src/portal/workspace/AIAssistantPanel";
import ClientIntelligencePanel from "@/src/portal/workspace/ClientIntelligencePanel";
import { fetchWorkspaceFromVault, vaultSiteBase } from "@/src/portal/workspace/api";
import {
  loadClientIntelligenceForTransaction,
  type ClientIntelligenceResult,
} from "@/src/portal/workspace/client-intelligence";
import {
  findCardById,
  nextActionLabel,
  readinessLanguage,
  riskLabel,
  stageLabel,
  statusExplanation,
  transactionTypeLabel,
  vaultPaperworkUrl,
  vaultTransactionUrl,
} from "@/src/portal/workspace/transaction-helpers";

export default async function TransactionWorkspacePage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;

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
      <Shell transactionId={transactionId} vaultBase={vaultBase}>
        <ErrorBanner status={401} message="Sign in and reload this page." />
      </Shell>
    );
  }

  // ── Pull workspace cards from Vault, find this transaction ────────
  const result = await fetchWorkspaceFromVault({
    accessToken: session.access_token,
    scope: "mine",
  });

  if (result.ok === false) {
    return (
      <Shell transactionId={transactionId} vaultBase={vaultBase}>
        <ErrorBanner status={result.status} message={result.message} />
      </Shell>
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

  // ── AP2.1D: pull Client Intelligence in parallel with the page ────
  //
  // We need the transaction's client_email to look up the profile. The
  // workspace card only carries client_name; the email lives on the
  // transactions row, which agents have read access to via RLS.
  const callerProfilePromise = supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: string }>();
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
  const clientIntelligence: ClientIntelligenceResult =
    await loadClientIntelligenceForTransaction({
      supabase,
      callerId: session.user.id,
      callerRole,
      clientEmail: txnRow?.client_email ?? null,
      clientName: txnRow?.client_name ?? resolvedCard.client_name,
    });

  return (
    <TransactionView
      card={resolvedCard}
      vaultBase={vaultBase}
      clientIntelligence={clientIntelligence}
    />
  );
}

// ── Page shells ───────────────────────────────────────────────────────

function Shell({
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
        Transaction <span className="text-[#71717A]">{transactionId.slice(0, 8)}…</span>
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
          <ExternalLink className="h-3 w-3" /> Open in Vault
        </a>
      </div>
    </div>
  );
}

function TransactionView({
  card,
  vaultBase,
  clientIntelligence,
}: {
  card: import("@/src/portal/workspace/types").WorkspaceCard;
  vaultBase: string;
  clientIntelligence: ClientIntelligenceResult;
}) {
  return (
    <div>
      <Link
        href="/workspace"
        className="text-xs text-[#71717A] hover:text-[#A1A1AA] inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Workspace
      </Link>

      {/* ── 1. Transaction Header ───────────────────────────────── */}
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[#71717A]">
            {transactionTypeLabel(card.transaction_type)}
          </div>
          <h1 className="text-2xl font-semibold text-[#F1F1F3] truncate">
            {card.property_address ?? "(no property address)"}
          </h1>
          <div className="text-sm text-[#A1A1AA] truncate">
            {card.client_name ?? "(no client name)"}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-semibold text-[#F1F1F3] tabular-nums leading-none">
            {card.readiness_score}
            <span className="text-xl text-[#71717A]">%</span>
          </div>
          <div className="text-[10px] text-[#71717A] mt-1">readiness</div>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 mb-6">
        <Badge tone="info">{stageLabel(card.stage)}</Badge>
        <Badge tone="muted">tier: {card.readiness_tier.replace(/_/g, " ")}</Badge>
        {card.risk_tier !== "unknown" && <Badge tone="warn">{riskLabel(card.risk_tier)}</Badge>}
        {card.broker_confirmation_required && (
          <Badge tone="muted">Broker Confirmation Required</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* ── 2. Next Action ─────────────────────────────────────── */}
        <section className="lg:col-span-1 rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">Next Action</h2>
          <div className="text-[#E8D5A3] text-base font-medium mb-2">
            {nextActionLabel(card.next_action)}
          </div>
          <p className="text-sm text-[#A1A1AA] leading-relaxed mb-2">
            {card.suggested_prompt}
          </p>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            {statusExplanation(card)}
          </p>
          <p className="mt-3 text-[11px] text-[#71717A]">{readinessLanguage(card)}</p>
        </section>

        {/* ── 3. Forms Summary ───────────────────────────────────── */}
        <section className="lg:col-span-2 rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">Forms Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
            <Stat label="Required" value={card.required_forms_count} tone="muted" />
            <Stat label="Ready" value={card.ready_forms_count} tone="info" />
            <Stat label="Signed" value={card.signed_forms_count} tone="ok" />
            <Stat
              label="Blocked"
              value={card.blocked_forms_count}
              tone={card.blocked_forms_count > 0 ? "warn" : "muted"}
            />
            <Stat
              label="Pending Env"
              value={card.pending_envelopes_count}
              tone={card.pending_envelopes_count > 0 ? "info" : "muted"}
            />
          </div>
          <a
            href={vaultPaperworkUrl(card.transaction_id, vaultBase)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
          >
            <FileText className="h-3 w-3" /> Open the paperwork package in Vault
          </a>
        </section>
      </div>

      {/* ── 3b. Client Intelligence (AP2.1D) ───────────────────────── */}
      <div className="mb-4">
        <ClientIntelligencePanel
          result={clientIntelligence}
          fallbackClientName={card.client_name}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* ── 4. AI Assistant ────────────────────────────────────── */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-2">AI Assistant</h2>
          <AIAssistantPanel transactionId={card.transaction_id} />
        </section>

        {/* ── 5. Timeline placeholder ────────────────────────────── */}
        <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">Timeline</h2>
          <ul className="space-y-2 text-sm">
            <TimelineRow label="Contract date" />
            <TimelineRow label="Closing date" />
            <TimelineRow label="Last paperwork update" />
            <TimelineRow label="Last signature activity" />
            <TimelineRow label="Last portal activity" />
          </ul>
          <p className="mt-3 text-[10px] text-[#71717A]">
            Timeline data isn&apos;t in the current Vault workspace card. A future
            Vault enhancement will surface it; until then the placeholder keeps
            the layout consistent with the Vault transaction screen.
          </p>
        </section>
      </div>

      {/* ── 6. Quick Links ──────────────────────────────────────── */}
      <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/workspace"
            className="text-[#A1A1AA] hover:text-[#F1F1F3] inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Transactions
          </Link>
          <a
            href={vaultTransactionUrl(card.transaction_id, vaultBase)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-4 w-4" /> Open Transaction in Vault
          </a>
          <a
            href={vaultPaperworkUrl(card.transaction_id, vaultBase)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
          >
            <FileText className="h-4 w-4" /> Open Paperwork in Vault
          </a>
          <a
            href="#ai-assistant"
            className="text-[#A1A1AA] hover:text-[#F1F1F3] inline-flex items-center gap-1"
          >
            <Sparkles className="h-4 w-4" /> Continue with AI
          </a>
        </div>
        <p className="mt-3 text-[11px] text-[#71717A]">
          This page is read-only. There are no send / approval buttons —
          broker confirmation is required for every change, and that flow
          lives in Vault.
        </p>
      </section>
    </div>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

type Tone = "ok" | "info" | "warn" | "muted";

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: Tone;
}) {
  const v =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "info"
      ? "text-sky-300"
      : tone === "warn"
      ? "text-amber-300"
      : "text-[#A1A1AA]";
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-2 py-2 text-center">
      <div className={`text-xl font-semibold tabular-nums leading-none ${v}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-[#71717A] mt-1">{label}</div>
    </div>
  );
}

function TimelineRow({ label }: { label: string }) {
  return (
    <li className="flex items-baseline justify-between">
      <span className="text-[#A1A1AA]">{label}</span>
      <span className="text-[#71717A]">—</span>
    </li>
  );
}

function ErrorBanner({ status, message }: { status: number; message: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200">
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
  );
}
