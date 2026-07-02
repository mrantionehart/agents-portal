// ============================================================================
// AGENT.SIGN.2A — Connected Accounts card (Agent Portal, display-only)
// ============================================================================
// Shows the agent's e-sign connection status, sourced from Vault's gated
// /api/esign/status (which returns NON-SECRET status only — never tokens).
// Phase 2A: display + Disconnect. There is NO "Connect" button yet — the OAuth
// connect flow arrives in 2B. Runs on the browser so it can attach a fresh
// Bearer via authFetch.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSignature, Link2Off, Loader2, ShieldCheck } from "lucide-react";

import { authFetch } from "@/lib/supabase";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

interface EsignStatus {
  connected: boolean;
  provider: string;
  provider_label: string;
  email: string | null;
  account_id: string | null;
  status: string;
  connected_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ConnectedAccountsCard() {
  const [status, setStatus] = useState<EsignStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${VAULT_API_URL}/esign/status`, { method: "GET" });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setStatus((await res.json()) as EsignStatus);
    } catch {
      setError("Couldn't load connection status.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await authFetch(`${VAULT_API_URL}/esign/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "docusign" }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = (await res.json()) as { status: EsignStatus };
      setStatus(json.status);
    } catch {
      setError("Couldn't disconnect. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-[#71717A]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking connection…
      </div>
    );
  }

  const connected = status?.connected === true;

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-[11px] text-rose-200">
          {error}
        </div>
      )}

      <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 min-w-0">
            <FileSignature className="h-4 w-4 text-[#C9A84C] shrink-0" />
            <span className="text-sm text-[#F1F1F3]">DocuSign</span>
          </div>
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/40 bg-emerald-900/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
              <ShieldCheck className="h-3 w-3" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-[#252538] bg-[#11111a] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#A1A1AA]">
              Not connected
            </span>
          )}
        </div>

        {connected ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <dt className="text-[#71717A]">Account email</dt>
            <dd className="text-[#D4D4D8] truncate">{status?.email ?? "—"}</dd>
            <dt className="text-[#71717A]">Connected</dt>
            <dd className="text-[#D4D4D8]">{fmtDate(status?.connected_at ?? null)}</dd>
            <dt className="text-[#71717A]">Last used</dt>
            <dd className="text-[#D4D4D8]">{fmtDate(status?.last_used_at ?? null)}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-[11px] text-[#71717A] leading-relaxed">
            Connecting your own DocuSign lets you send transaction paperwork for
            signature without downloading the package. The connect flow is
            coming soon.
          </p>
        )}

        {connected && (
          <div className="mt-3">
            <button
              type="button"
              onClick={disconnect}
              disabled={disconnecting}
              className="
                inline-flex items-center gap-1.5 rounded-md border border-[#252538]
                bg-[#11111a] px-2.5 py-1.5 text-[11px] text-[#E8D5A3]
                hover:border-rose-700/50 hover:text-rose-200
                disabled:opacity-50 transition-colors duration-[180ms]
              "
            >
              {disconnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Link2Off className="h-3 w-3" />
              )}
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
