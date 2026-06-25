// ============================================================================
// AGENT PORTAL 2.1 — R2A — Deal Portals client component
// ============================================================================
// Holds filter + search + clipboard state. Receives the pre-fetched list
// from the server component so there's NO client-side DB or auth flow.
//
// Actions (read-only by spec):
//   - Copy Link    → navigator.clipboard
//   - Open Portal  → window.open(shareUrl, _blank)
// NO email send, NO sms send, NO recipient logging, NO Vault mutations.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Eye,
  MapPin,
  Search,
  Share2,
  User,
} from "lucide-react";

import type { DealPortalRow, StatusFilter } from "./types";
import {
  applyFilters,
  formatPrice,
  listCounts,
  locationLabel,
  relativeTime,
  shareUrl,
  statusLabel,
} from "./helpers";

export default function PortalsClient({ items }: { items: DealPortalRow[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const counts = useMemo(() => listCounts(items), [items]);
  const filtered = useMemo(
    () => applyFilters(items, { status: statusFilter, search }),
    [items, statusFilter, search]
  );

  async function handleCopy(portal: DealPortalRow) {
    const url = shareUrl(portal);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(portal.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // navigator.clipboard may fail in non-secure contexts; fallback to
      // window.prompt so the user can still get the URL.
      window.prompt("Copy this link:", url);
    }
  }

  function handleOpen(portal: DealPortalRow) {
    window.open(shareUrl(portal), "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total" value={String(counts.total)} tone="muted" />
        <Stat
          label="Active"
          value={String(counts.active)}
          tone={counts.active > 0 ? "ok" : "muted"}
        />
        <Stat label="Archived" value={String(counts.archived)} tone="muted" />
        <Stat label="Total Views" value={String(counts.totalViews)} tone="info" />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Chip label={`All (${counts.total})`} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <Chip label={`Active (${counts.active})`} active={statusFilter === "active"} onClick={() => setStatusFilter("active")} />
        <Chip label={`Archived (${counts.archived})`} active={statusFilter === "archived"} onClick={() => setStatusFilter("archived")} />
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by property, client, or location…"
          className="
            w-full rounded-md border border-[#1a1a2e] bg-[#0b0b10]
            pl-9 pr-3 py-2 text-sm text-[#F1F1F3]
            placeholder:text-[#71717A]
            focus:outline-none focus:border-[#252538]
          "
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAny={items.length > 0} />
      ) : (
        <ul className="rounded-lg border border-[#1a1a2e] overflow-hidden divide-y divide-[#1a1a2e]">
          {filtered.map((portal) => (
            <PortalRow
              key={portal.id}
              portal={portal}
              copied={copiedId === portal.id}
              onCopy={() => handleCopy(portal)}
              onOpen={() => handleOpen(portal)}
            />
          ))}
        </ul>
      )}

      <p className="mt-6 text-[11px] text-[#71717A]">
        Read-only list. Sharing is copy-link only — the Portal never sends
        emails, texts, or logs recipients. Use the shared link in your own
        email or messaging app of choice.
      </p>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────

function PortalRow({
  portal,
  copied,
  onCopy,
  onOpen,
}: {
  portal: DealPortalRow;
  copied: boolean;
  onCopy: () => void;
  onOpen: () => void;
}) {
  const loc = locationLabel(portal);
  const price = formatPrice(portal.price);

  return (
    <li className="px-4 py-3 hover:bg-[#1a1a25] transition-colors duration-[180ms]">
      <div className="flex items-start gap-3">
        <Share2 className="h-4 w-4 text-[#71717A] shrink-0 mt-1" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="truncate text-sm font-medium text-[#F1F1F3]">
              {portal.title ?? "(untitled portal)"}
            </span>
            <StatusBadge status={portal.status} />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1 text-xs text-[#A1A1AA]">
            {portal.client_name && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3 text-[#71717A]" /> {portal.client_name}
              </span>
            )}
            {loc && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-[#71717A]" /> {loc}
              </span>
            )}
            {price && <span className="text-[#71717A]">{price}</span>}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-[#71717A]">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-2.5 w-2.5" /> {portal.view_count} views
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" /> last viewed{" "}
              {relativeTime(portal.last_viewed_at)}
            </span>
            <span>created {relativeTime(portal.created_at)}</span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            className="
              inline-flex items-center gap-1 rounded-md
              border border-[#252538] bg-[#11111a]
              px-2 py-1 text-[11px] text-[#A1A1AA]
              hover:text-[#F1F1F3] hover:border-[#3a3a55]
              transition-colors duration-[180ms]
            "
            title="Copy share link"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-300" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="
              inline-flex items-center gap-1 rounded-md
              border border-[#C9A84C]/40 bg-[#C9A84C]/10
              px-2 py-1 text-[11px] text-[#E8D5A3]
              hover:bg-[#C9A84C]/15
              transition-colors duration-[180ms]
            "
            title="Open the public portal in a new tab"
          >
            <ExternalLink className="h-3 w-3" /> Open
          </button>
        </div>
      </div>
    </li>
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────

type Tone = "ok" | "info" | "warn" | "muted";

function Stat({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const v =
    tone === "ok" ? "text-emerald-300" :
    tone === "info" ? "text-sky-300" :
    tone === "warn" ? "text-amber-300" :
    "text-[#F1F1F3]";
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-3 py-2.5">
      <div className={`text-2xl font-semibold tabular-nums leading-none ${v}`}>{value}</div>
      <div className="text-[11px] text-[#71717A] mt-1">{label}</div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-md text-sm border
        transition-colors duration-[180ms]
        ${active
          ? "bg-[#C9A84C]/15 text-[#E8D5A3] border-[#C9A84C]/40"
          : "bg-[#11111a] text-[#A1A1AA] border-[#1a1a2e] hover:border-[#252538]"
        }
      `}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : s === "archived"
      ? "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]"
      : s === "draft"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-12 text-center text-sm">
      {hasAny ? (
        <>
          <p className="text-[#A1A1AA]">No portals match the current filters.</p>
          <p className="text-xs text-[#71717A] mt-1">Try clearing the filters or search.</p>
        </>
      ) : (
        <>
          <p className="text-[#A1A1AA]">No deal portals yet.</p>
          <p className="text-xs text-[#71717A] mt-1">
            Your broker creates these in Vault; once shared, they show up here.
          </p>
        </>
      )}
    </div>
  );
}
