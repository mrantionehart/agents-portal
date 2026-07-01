// ============================================================================
// AGENT.DOCS.1 — Per-row Download button for the Documents tab
// ============================================================================
// Client component. Calls the agent-scoped Vault endpoint with a fresh
// Bearer from the browser Supabase session, then opens the returned
// signed URL in a new tab. Vault re-verifies visibility + assignment
// and writes the audit row — this component never sees a bucket, path,
// or checksum.
// ============================================================================

"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { supabase } from "@/lib/supabase";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export interface AgentDocumentDownloadButtonProps {
  transactionId: string;
  formInstanceId: string;
  formId: string;
}

export default function AgentDocumentDownloadButton({
  transactionId,
  formInstanceId,
  formId,
}: AgentDocumentDownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 30000);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("Sign-in expired");
        return;
      }
      const res = await fetch(
        `${VAULT_API_URL}/paperwork/agents/transactions/${encodeURIComponent(
          transactionId
        )}/documents/${encodeURIComponent(formInstanceId)}/download`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: ctrl.signal,
        }
      );
      if (!res.ok) {
        setError(
          res.status === 404
            ? "Not available"
            : res.status === 400
            ? "Not yet ready"
            : res.status === 401
            ? "Sign-in expired"
            : `Failed (${res.status})`
        );
        return;
      }
      const body: { signed_url?: string } = await res.json();
      if (!body?.signed_url) {
        setError("No download URL");
        return;
      }
      // Anchor-click download — bypasses popup blockers that silently
      // kill window.open when called from an awaited promise chain.
      const a = document.createElement("a");
      a.href = body.signed_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = `${formId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Timed out");
      } else {
        console.error("[document-download]", formId, err);
        setError(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={`Download ${formId}`}
      className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#0b0b10] px-2 py-0.5 text-[10px] text-[#E8D5A3] hover:bg-[#1a1a25] disabled:opacity-50"
      title={error ?? "Download the current PDF"}
    >
      <Download className="h-2.5 w-2.5" />
      {busy ? "…" : error ?? "Download"}
    </button>
  );
}
