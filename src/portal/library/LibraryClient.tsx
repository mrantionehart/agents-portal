// ============================================================================
// AGENT.DOCS.1 — Library client
// ============================================================================
// Renders the template grid + per-row Download button. Runs on the
// browser so the download button can pull a fresh Bearer via the
// Supabase session and open the signed URL in a new tab.
//
// Vault handles the authorization + audit. This surface never sees a
// storage path — only the signed URL, which we immediately hand to
// window.open. No PII, no checksum, no bucket in this component.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileText, Search } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { TemplateCard } from "./types";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export interface LibraryClientProps {
  templates: TemplateCard[];
  error: string | null;
}

export default function LibraryClient({
  templates,
  error,
}: LibraryClientProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const t of templates) s.add(t.category);
    return Array.from(s).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.form_id.toLowerCase().includes(q) ||
        t.form_name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [templates, query, category]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-200 flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Couldn&apos;t load templates ({error}).</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search forms, e.g. RLHD-3x or Lease"
            className="w-full rounded-md border border-[#1a1a2e] bg-[#0b0b10] pl-7 pr-3 py-2 text-sm text-[#F1F1F3] placeholder:text-[#52525B] focus:outline-none focus:ring-1 focus:ring-[#E8D5A3]/40"
            aria-label="Search templates"
          />
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-sm text-[#F1F1F3] focus:outline-none focus:ring-1 focus:ring-[#E8D5A3]/40"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {formatCategory(c)}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-[#71717A] whitespace-nowrap">
          {filtered.length} of {templates.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-10 text-center">
          <p className="text-sm text-[#A1A1AA]">No templates match this filter.</p>
        </div>
      ) : (
        <ul className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <li
              key={t.form_id}
              className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-3.5 w-3.5 text-[#71717A] shrink-0" />
                    <span className="text-sm font-medium text-[#F1F1F3]">
                      {t.form_id}
                    </span>
                    {t.manual_only && (
                      <span
                        title="This blank template is only downloadable because HartFelt cannot auto-generate this form yet. You still need to fill it out manually."
                        className="text-[10px] px-1.5 py-0.5 rounded-md border border-amber-700/40 bg-amber-900/20 text-amber-200 uppercase tracking-wide"
                      >
                        Manual only
                      </span>
                    )}
                    {!t.active && !t.manual_only && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-[#252538] bg-[#1a1a25] text-[#A1A1AA] uppercase tracking-wide">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[#A1A1AA]">
                    {t.form_name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#71717A]">
                    <span className="uppercase tracking-wide">
                      {formatCategory(t.category)}
                    </span>
                    {t.revision && <span>· {t.revision}</span>}
                    {typeof t.bytes === "number" && (
                      <span>· {formatBytes(t.bytes)}</span>
                    )}
                  </div>
                </div>
              </div>
              <TemplateDownloadButton formId={t.form_id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────

function TemplateDownloadButton({ formId }: { formId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("Sign-in expired. Refresh the page.");
        return;
      }
      const res = await fetch(
        `${VAULT_API_URL}/paperwork/agents/templates/${encodeURIComponent(
          formId
        )}/download`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      if (!res.ok) {
        setError(
          res.status === 404
            ? "Not available"
            : `Download failed (${res.status})`
        );
        return;
      }
      const body: { signed_url?: string } = await res.json();
      if (!body?.signed_url) {
        setError("Server returned no download URL");
        return;
      }
      window.open(body.signed_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
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

// ── Helpers ──────────────────────────────────────────────────────────

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
