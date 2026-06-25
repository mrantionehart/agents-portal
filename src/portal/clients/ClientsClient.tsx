// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Clients index client component
// ============================================================================
// Holds filter + search state. Receives the pre-fetched list from the
// server component (zero client-side DB calls). Renders a row-style
// inbox of clients.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, MapPin, Phone, Search, Users } from "lucide-react";

import type { AssignmentBucket, ClientListItem } from "./types";
import {
  applyClientFilters,
  bucketBadgeLabel,
  channelLabel,
  clientListCounts,
  profileTypeLabel,
  relativeUpdated,
  representationLabel,
  temperatureLabel,
  type AssignmentFilter,
  type TempFilter,
  type TypeFilter,
} from "./helpers";

export default function ClientsClient({ items }: { items: ClientListItem[] }) {
  const [tempFilter, setTempFilter] = useState<TempFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => clientListCounts(items), [items]);
  const filtered = useMemo(
    () =>
      applyClientFilters(items, {
        temperature: tempFilter,
        type: typeFilter,
        assignment: assignmentFilter,
        search,
      }),
    [items, tempFilter, typeFilter, assignmentFilter, search]
  );

  return (
    <div>
      {/* Status / temperature filter chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Chip label={`All (${counts.total})`} active={tempFilter === "all"} onClick={() => setTempFilter("all")} />
        <Chip label={`Hot (${counts.hot})`} active={tempFilter === "hot"} onClick={() => setTempFilter("hot")} />
        <Chip label={`Warm (${counts.warm})`} active={tempFilter === "warm"} onClick={() => setTempFilter("warm")} />
        <Chip label={`Cold (${counts.cold})`} active={tempFilter === "cold"} onClick={() => setTempFilter("cold")} />
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <TypeChip label="All Types" active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
        <TypeChip label={`Buyers (${counts.buyers})`} active={typeFilter === "buyers"} onClick={() => setTypeFilter("buyers")} />
        <TypeChip label={`Sellers (${counts.sellers})`} active={typeFilter === "sellers"} onClick={() => setTypeFilter("sellers")} />
        <TypeChip label={`Investors (${counts.investors})`} active={typeFilter === "investors"} onClick={() => setTypeFilter("investors")} />
      </div>

      {/* R3A — Assignment filter chips (caller-relative). AND-composed
          with temperature + type + search above. */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <TypeChip
          label="All Assignments"
          active={assignmentFilter === "all"}
          onClick={() => setAssignmentFilter("all")}
        />
        <TypeChip
          label={`Assigned to Me (${counts.assigned})`}
          active={assignmentFilter === "assigned"}
          onClick={() => setAssignmentFilter("assigned")}
        />
        <TypeChip
          label={`Claimed by Me (${counts.claimed})`}
          active={assignmentFilter === "claimed"}
          onClick={() => setAssignmentFilter("claimed")}
        />
        <TypeChip
          label={`Dispo Feed (${counts.dispo})`}
          active={assignmentFilter === "dispo"}
          onClick={() => setAssignmentFilter("dispo")}
        />
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, or target area…"
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
          {filtered.map((c) => (
            <ClientRow key={c.id} c={c} />
          ))}
        </ul>
      )}

      <p className="mt-6 text-[11px] text-[#71717A]">
        Client Intelligence is read-only. To update a client, ask the AI Assistant
        on the related transaction — broker confirmation is required for every change.
      </p>
    </div>
  );
}

// ── Row ─────────────────────────────────────────────────────────────

function ClientRow({ c }: { c: ClientListItem }) {
  return (
    <li>
      <Link
        href={`/clients/${c.id}`}
        className="block px-4 py-3 hover:bg-[#1a1a25] transition-colors duration-[180ms]"
      >
        <div className="flex items-start gap-3">
          <Users className="h-4 w-4 text-[#71717A] shrink-0 mt-1" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="truncate text-sm font-medium text-[#F1F1F3]">
                {c.full_name ?? "(no name on file)"}
              </span>
              <TypeBadge type={c.profile_type} />
              {c.temperature && c.temperature !== "—" && (
                <TempBadge t={c.temperature} />
              )}
              <BucketBadge b={c.assignmentBucket} />
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1 text-xs text-[#A1A1AA]">
              {c.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3 text-[#71717A]" /> {c.email}
                </span>
              )}
              {c.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3 text-[#71717A]" /> {c.phone}
                </span>
              )}
              {c.preferred_channel && (
                <span className="text-[#71717A]">prefers {channelLabel(c.preferred_channel)}</span>
              )}
              {representationLabel(c.representation_status) !== "—" && (
                <span className="text-[#71717A]">{representationLabel(c.representation_status)}</span>
              )}
            </div>
            {c.target_areas.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#A1A1AA]">
                <MapPin className="h-3 w-3 text-[#71717A]" />
                <span className="truncate">{c.target_areas.join(", ")}</span>
              </div>
            )}
          </div>
          <div className="shrink-0 text-[11px] text-[#71717A]">
            {relativeUpdated(c.updated_at)}
          </div>
        </div>
      </Link>
    </li>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-md text-sm border transition-colors duration-[180ms]
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

function TypeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-2 py-1 rounded-md border
        ${active
          ? "bg-[#1a1a25] text-[#F1F1F3] border-[#252538]"
          : "bg-[#11111a] text-[#71717A] border-[#1a1a2e] hover:text-[#A1A1AA]"
        }
      `}
    >
      {label}
    </button>
  );
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span className="inline-block rounded-md border border-[#252538] bg-[#1a1a25] text-[10px] uppercase tracking-wide text-[#A1A1AA] px-1.5 py-0.5">
      {profileTypeLabel(type)}
    </span>
  );
}

function BucketBadge({ b }: { b: AssignmentBucket }) {
  const label = bucketBadgeLabel(b);
  if (!label) return null;
  const cls =
    b === "assigned"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : b === "claimed"
      ? "bg-violet-900/30 text-violet-200 border-violet-700/40"
      : "bg-amber-900/20 text-amber-200 border-amber-700/40";
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}
      title={
        b === "assigned"
          ? "You are the assigned agent for this client"
          : b === "claimed"
          ? "You claimed this client from the dispo feed"
          : "Available in the dispo feed — any agent can claim"
      }
    >
      {label}
    </span>
  );
}

function TempBadge({ t }: { t: string }) {
  const cls =
    t === "hot"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : t === "warm"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] ${cls}`}>
      {temperatureLabel(t)}
    </span>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-12 text-center text-sm">
      {hasAny ? (
        <>
          <p className="text-[#A1A1AA]">No clients match the current filters.</p>
          <p className="text-xs text-[#71717A] mt-1">Try clearing the filters or search.</p>
        </>
      ) : (
        <>
          <p className="text-[#A1A1AA]">No clients on file yet.</p>
          <p className="text-xs text-[#71717A] mt-1">
            New profiles from the agent CRM will surface here.
          </p>
        </>
      )}
    </div>
  );
}
