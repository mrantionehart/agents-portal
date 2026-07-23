// ============================================================================
// PAPERWORK UX-001 — Template download button (behavior UNCHANGED from AGENT.DOCS.1)
// ============================================================================
// Extracted verbatim from LibraryClient so the workflow-first redesign reuses
// the exact, battle-tested download path: authFetch (getSession-hang race) →
// Vault /paperwork/agents/templates/[form_id]/download → signed_url → same-origin
// blob download. The ONLY addition is an optional onDownloaded() hook so the UI
// can record "Recently Used" — download behavior itself is identical.
// ============================================================================

"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { authFetch } from "@/lib/supabase";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export function TemplateDownloadButton({
  formId,
  onSessionExpired,
  onDownloaded,
}: {
  formId: string;
  onSessionExpired?: () => void;
  onDownloaded?: (formId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await authFetch(
        `${VAULT_API_URL}/paperwork/agents/templates/${encodeURIComponent(
          formId
        )}/download`,
        { method: "GET", cache: "no-store" }
      );
      if (!res.ok) {
        if (res.status === 401) {
          setError("Sign-in expired");
          onSessionExpired?.();
        } else {
          setError(res.status === 404 ? "Not available" : `Failed (${res.status})`);
        }
        return;
      }
      const body: { signed_url?: string } = await res.json();
      if (!body?.signed_url) {
        setError("No URL returned");
        return;
      }
      const pdfRes = await fetch(body.signed_url, { signal: ctrl.signal });
      if (!pdfRes.ok) {
        setError(`Storage ${pdfRes.status}`);
        return;
      }
      const blob = await pdfRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${formId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      onDownloaded?.(formId); // record Recently Used (presentation-only)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Timed out — try again");
      } else {
        console.error("[library-download]", formId, err);
        setError(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#252538] bg-[#0b0b10] px-2.5 py-1 text-xs text-[#E8D5A3] hover:bg-[#1a1a25] disabled:opacity-50"
      >
        <Download className="h-3 w-3" />
        {busy ? "Preparing…" : "Download PDF"}
      </button>
      {error && (
        <span className="text-[10px] text-rose-300" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
