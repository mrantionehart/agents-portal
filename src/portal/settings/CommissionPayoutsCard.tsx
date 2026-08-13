// ============================================================================
// Commission Payouts card (Agent Portal, Settings → Earnings)
// ============================================================================
// Agent-facing entry to the EXISTING Vault Stripe Connect payout flow. The
// agent's bank/KYC info is collected on Stripe's hosted onboarding — never by
// HartFelt. Readiness is server-owned (Vault GET /api/stripe/connect); this
// component only renders it. "Connect" POSTs with the bounded `agent_portal`
// context and top-level-navigates to the returned Stripe URL. No new backend,
// no second Connect account, no bank data stored in the Agent Portal.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { authFetch } from "@/lib/supabase";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

type Readiness =
  | "not_configured"
  | "not_started"
  | "incomplete"
  | "pending_verification"
  | "ready";

interface ConnectStatus {
  enabled?: boolean;
  readiness?: Readiness;
}

export default function CommissionPayoutsCard() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${VAULT_API_URL}/stripe/connect`, { method: "GET" });
      if (res.ok) setStatus((await res.json()) as ConnectStatus);
      else setStatus(null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Clean the ?stripe=success return marker so a refresh doesn't re-show it.
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("stripe") === "success") {
        params.delete("stripe");
        const qs = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }
    } catch {
      /* no-op */
    }
  }, [load]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await authFetch(`${VAULT_API_URL}/stripe/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: "agent_portal" }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && json.url) {
        window.location.href = json.url; // hand off to Stripe-hosted onboarding
        return;
      }
      setError(json.error || "Couldn't start Stripe payout setup. Please try again.");
    } catch {
      setError("Couldn't start Stripe payout setup. Please try again.");
    } finally {
      setConnecting(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-[#71717A]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking payout status…
      </div>
    );
  }

  const readiness = status?.readiness;
  const notConfigured = status?.enabled === false || readiness === "not_configured";
  const ready = readiness === "ready";

  return (
    <div className="rounded-xl border border-[#1a1a2e] bg-[#11111a] p-5">
      <div className="flex items-start gap-2">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-[#F1F1F3]">Commission Payouts</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#A1A1AA]">
            Connect your payout account securely through Stripe to receive eligible electronic
            commission payments from HartFelt. Your banking information is entered securely with
            Stripe and is <strong>not stored by HartFelt</strong>.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {notConfigured ? (
          <p className="text-xs text-[#71717A]">
            Payouts aren&rsquo;t enabled on this brokerage yet. You can set this up later.
          </p>
        ) : ready ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Payout account connected — you&rsquo;re ready to receive eligible electronic commission payouts.
          </p>
        ) : readiness === "pending_verification" ? (
          <div className="space-y-2">
            <p className="text-xs text-[#A1A1AA]">Stripe verification in progress.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-[#2a2a3e] px-3 py-1.5 text-xs font-medium text-[#F1F1F3] transition hover:border-[#C9A84C]/50"
            >
              Check Status
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[#A1A1AA]">
              {readiness === "incomplete" ? "Payout setup incomplete." : "Payout setup not started."}
            </p>
            <button
              type="button"
              onClick={() => void connect()}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-semibold text-[#0a0a0f] transition hover:bg-[#d8ba61] disabled:opacity-60"
            >
              {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {readiness === "incomplete" ? "Continue Stripe Setup" : "Connect with Stripe"}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-[#71717A]">
          Connecting Stripe doesn&rsquo;t guarantee payment; commission payouts still follow your
          brokerage&rsquo;s approval process.
        </p>
      </div>
    </div>
  );
}
