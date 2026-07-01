// ============================================================================
// AGENT PORTAL 2.1 — R4 — Transaction Documents panel
// ============================================================================
// Server-rendered. Receives the pre-merged DocumentRow[] from the page.
// Renders header counts + a per-form row list. Read-only —
// NO generate / download / send / approve / edit / attestation request.
//
// All "Open in Vault" links open the same Vault paperwork detail page
// anchored on form_id; the broker-tier actions live on that page.
// ============================================================================

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, ExternalLink, FileText, Lock } from "lucide-react";

import type { DocumentRow } from "./types";
import {
  categoryLabel,
  documentCounts,
  envelopeCopy,
  missingFieldsCopy,
  relativeUpdated,
  statusLabel,
  statusTone,
} from "./helpers";
import { formDrawerHref } from "./details/helpers";
import AgentDocumentDownloadButton from "./AgentDocumentDownloadButton";

export interface DocumentsPanelProps {
  documents: DocumentRow[];
  /** Set when the upstream fetch failed; renders a banner instead of
   *  collapsing the section to an empty list. */
  error: string | null;
  /** Vault deep-link for the paperwork package — shown once at the
   *  bottom of the panel as a single "Open paperwork package" CTA. */
  paperworkPackageUrl: string;
  /** Transaction id used to build per-form drawer hrefs.
   *  Workflow 3.2.A — rows become clickable Links that set ?form=<form_id>. */
  transactionId: string;
  /** form_id currently open in the drawer (for active-row highlight). */
  activeFormId?: string | null;
}

export default function DocumentsPanel({
  documents,
  error,
  paperworkPackageUrl,
  transactionId,
  activeFormId,
}: DocumentsPanelProps) {
  const counts = documentCounts(documents);

  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5 mb-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A]">Documents</h2>
        {counts.needs_attention > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-amber-700/40 bg-amber-900/20 text-amber-200 text-[10px] px-1.5 py-0.5 uppercase tracking-wide"
            title="Documents that are blocked or missing required fields"
          >
            <AlertTriangle className="h-3 w-3" />
            {counts.needs_attention} needs attention
          </span>
        )}
      </div>

      {/* Counts row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        <Stat label="Total" value={counts.total} tone="muted" />
        <Stat label="Not Started" value={counts.not_started} tone="muted" />
        <Stat label="In Progress" value={counts.in_progress} tone="info" />
        <Stat label="Ready" value={counts.ready} tone="info" />
        <Stat
          label="Blocked"
          value={counts.blocked}
          tone={counts.blocked > 0 ? "warn" : "muted"}
        />
        <Stat label="Signed" value={counts.signed} tone="ok" />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-200 mb-3">
          Couldn&apos;t load the document list ({error}). Open the paperwork
          package in Vault for the latest.
        </div>
      )}

      {documents.length === 0 ? (
        <DocumentsEmpty />
      ) : (
        <ul className="rounded-lg border border-[#1a1a2e] overflow-hidden divide-y divide-[#1a1a2e]">
          {documents.map((d) => (
            <DocumentRowItem
              key={d.form_id}
              d={d}
              transactionId={transactionId}
              active={activeFormId === d.form_id}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#71717A]">
        <span>
          Read-only view. Send, approve, generate, and edit live in Vault.
        </span>
        <a
          href={paperworkPackageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
        >
          <FileText className="h-3 w-3" /> Open paperwork package in Vault
        </a>
      </div>
    </section>
  );
}

// ── Row ──────────────────────────────────────────────────────────────

function DocumentRowItem({
  d,
  transactionId,
  active,
}: {
  d: DocumentRow;
  transactionId: string;
  active: boolean;
}) {
  const tone = statusTone(d.status);
  const missing = missingFieldsCopy(d.missing_fields_count, d.status);
  const envelope = envelopeCopy(d);
  const drawerHref = formDrawerHref(transactionId, d.form_id);

  return (
    <li
      className={`relative ${active ? "bg-[#1a1a25]" : "hover:bg-[#1a1a25]"} transition-colors duration-[180ms]`}
    >
      {/* Row is a Link to the drawer. The Vault deep-link below uses
          stopPropagation via being absolutely positioned outside the
          Link's clickable area. */}
      <Link
        href={drawerHref}
        aria-current={active ? "page" : undefined}
        aria-label={`View detail for ${d.form_id}`}
        className="block px-4 py-3 pr-28"
      >
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-[#71717A] shrink-0 mt-1" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="truncate text-sm font-medium text-[#F1F1F3]">
                {d.form_id}
              </span>
              {d.form_revision && (
                <span className="text-[10px] text-[#71717A]">
                  {d.form_revision}
                </span>
              )}
              <StatusBadge label={statusLabel(d.status)} tone={tone} />
              {d.form_category && (
                <span className="text-[10px] text-[#71717A] uppercase tracking-wide">
                  {categoryLabel(d.form_category)}
                </span>
              )}
              {d.status === "blocked" && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] text-amber-200/80"
                  title="Blocked on party attestation"
                >
                  <Lock className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
            {missing && (
              <div className="mt-1 text-xs text-[#A1A1AA] inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-300/80" />
                {missing}
              </div>
            )}
            {envelope && (
              <div className="mt-1 text-xs text-[#A1A1AA] inline-flex items-center gap-1.5">
                {d.status === "signed" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-300/80" />
                ) : (
                  <Clock className="h-3 w-3 text-sky-300/80" />
                )}
                {envelope}
              </div>
            )}
            {d.signed_at && (
              <div className="mt-1 text-[11px] text-[#71717A]">
                Signed {relativeUpdated(d.signed_at)}
              </div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-[#71717A] shrink-0 self-center" />
        </div>
      </Link>
      {/* Open-in-Vault anchor lives outside the row Link so opening
          Vault doesn't also pop the drawer. Absolutely positioned on
          the right edge. */}
      <div className="absolute top-3 right-4 flex items-center gap-2">
        {d.downloadable && d.form_instance_id && (
          <AgentDocumentDownloadButton
            transactionId={transactionId}
            formInstanceId={d.form_instance_id}
            formId={d.form_id}
          />
        )}
        <a
          href={d.open_in_vault_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
          aria-label={`Open ${d.form_id} in Vault`}
        >
          <ExternalLink className="h-3 w-3" /> Open in Vault
        </a>
      </div>
      {d.updated_at && (
        <div className="absolute bottom-3 right-4 text-[10px] text-[#71717A]">
          updated {relativeUpdated(d.updated_at)}
        </div>
      )}
    </li>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

type Tone = "ok" | "info" | "warn" | "muted";

function Stat({ label, value, tone }: { label: string; value: number; tone: Tone }) {
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

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function DocumentsEmpty() {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-8 text-center text-sm">
      <p className="text-[#A1A1AA]">No documents needed yet.</p>
      <p className="text-xs text-[#71717A] mt-1 max-w-md mx-auto leading-relaxed">
        Once the transaction has facts collected and a type set, the rule
        engine will surface required forms here.
      </p>
    </div>
  );
}
