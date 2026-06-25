// ============================================================================
// AGENT PORTAL 2.1 — R3B — Leads tab client component
// ============================================================================
// Holds filter + search state. Receives pre-fetched leads + intakes
// from the server component. Renders an inbox-style list. Read-only —
// NO claim / assign / convert / edit / delete / email / SMS.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Hand,
  Mail,
  MapPin,
  Phone,
  Search,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import Link from "next/link";

import type {
  IntakeListItem,
  LeadClaimBucket,
  LeadListItem,
} from "./types";
import {
  applyIntakeFilters,
  applyLeadFilters,
  claimBucketLabel,
  intakeStatusLabel,
  leadStatusLabel,
  leadsCounts,
  relativeCreated,
  type LeadsFilter,
} from "./helpers";

export interface LeadsClientProps {
  leads: LeadListItem[];
  intakes: IntakeListItem[];
  error: string | null;
}

export default function LeadsClient({
  leads,
  intakes,
  error,
}: LeadsClientProps) {
  const [filter, setFilter] = useState<LeadsFilter>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => leadsCounts(leads, intakes), [leads, intakes]);
  const visibleLeads = useMemo(
    () => applyLeadFilters(leads, { filter, search }),
    [leads, filter, search]
  );
  const visibleIntakes = useMemo(
    () => applyIntakeFilters(intakes, { filter, search }),
    [intakes, filter, search]
  );

  const showLeads = filter !== "intakes";
  const showIntakes = filter === "all" || filter === "intakes";

  return (
    <div>
      <Link
        href="/clients"
        className="text-xs text-[#71717A] hover:text-[#A1A1AA] inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Clients
      </Link>

      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 mb-4">
          Couldn&apos;t load some leads or intakes: {error}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Chip
          label={`All (${counts.totalLeads + counts.totalIntakes})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <Chip
          label={`Unclaimed (${counts.unclaimed})`}
          active={filter === "unclaimed"}
          onClick={() => setFilter("unclaimed")}
        />
        <Chip
          label={`Claimed by Me (${counts.claimedByMe})`}
          active={filter === "claimed_by_me"}
          onClick={() => setFilter("claimed_by_me")}
        />
        <Chip
          label={`Intakes (${counts.totalIntakes})`}
          active={filter === "intakes"}
          onClick={() => setFilter("intakes")}
        />
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, property, or notes…"
          className="
            w-full rounded-md border border-[#1a1a2e] bg-[#0b0b10]
            pl-9 pr-3 py-2 text-sm text-[#F1F1F3]
            placeholder:text-[#71717A]
            focus:outline-none focus:border-[#252538]
          "
        />
      </div>

      {/* Leads list */}
      {showLeads && (
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-2">
            Leads
          </h2>
          {visibleLeads.length === 0 ? (
            <LeadsEmpty hasAny={leads.length > 0} filter={filter} />
          ) : (
            <ul className="rounded-lg border border-[#1a1a2e] overflow-hidden divide-y divide-[#1a1a2e]">
              {visibleLeads.map((l) => (
                <LeadRowItem key={l.id} l={l} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Intakes panel */}
      {showIntakes && (
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-2">
            Intakes
          </h2>
          {visibleIntakes.length === 0 ? (
            <IntakesEmpty hasAny={intakes.length > 0} />
          ) : (
            <ul className="rounded-lg border border-[#1a1a2e] overflow-hidden divide-y divide-[#1a1a2e]">
              {visibleIntakes.map((i) => (
                <IntakeRowItem key={i.id} i={i} />
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="text-[11px] text-[#71717A]">
        Read-only view. To claim or work a lead, open the legacy{" "}
        <Link href="/lead-distribution" className="underline hover:text-[#A1A1AA]">
          Lead Distribution
        </Link>{" "}
        page.
      </p>
    </div>
  );
}

// ── Lead row ────────────────────────────────────────────────────────

function LeadRowItem({ l }: { l: LeadListItem }) {
  return (
    <li className="px-4 py-3 hover:bg-[#1a1a25] transition-colors duration-[180ms]">
      <div className="flex items-start gap-3">
        <UserCircle2 className="h-4 w-4 text-[#71717A] shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="truncate text-sm font-medium text-[#F1F1F3]">
              {l.name ?? "(unnamed lead)"}
            </span>
            <ClaimBadge b={l.claimBucket} who={l.claimed_by_name} />
            <StatusBadge label={leadStatusLabel(l.status)} />
            {l.source && (
              <span className="text-[10px] text-[#71717A] uppercase tracking-wide">
                {l.source}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1 text-xs text-[#A1A1AA]">
            {l.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3 text-[#71717A]" /> {l.email}
              </span>
            )}
            {l.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-[#71717A]" /> {l.phone}
              </span>
            )}
            {l.budget && <span className="text-[#71717A]">{l.budget}</span>}
          </div>
          {l.property && (
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#A1A1AA]">
              <MapPin className="h-3 w-3 text-[#71717A]" />
              <span className="truncate">{l.property}</span>
            </div>
          )}
          {l.notes_preview && (
            <p className="mt-1.5 text-[11px] text-[#71717A] italic line-clamp-2">
              &ldquo;{l.notes_preview}&rdquo;
            </p>
          )}
        </div>
        <div className="shrink-0 text-[11px] text-[#71717A]">
          {relativeCreated(l.created_at)}
        </div>
      </div>
    </li>
  );
}

function IntakeRowItem({ i }: { i: IntakeListItem }) {
  return (
    <li className="px-4 py-3 hover:bg-[#1a1a25] transition-colors duration-[180ms]">
      <div className="flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-[#C9A84C]/80 shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="truncate text-sm font-medium text-[#F1F1F3]">
              {i.name ?? "(unnamed intake)"}
            </span>
            <StatusBadge label={intakeStatusLabel(i.status)} />
            {i.isOwnIntake && (
              <span
                className="inline-block rounded-md border border-emerald-700/40 bg-emerald-900/30 text-emerald-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
                title="You created this intake"
              >
                Yours
              </span>
            )}
            {i.property_type && (
              <span className="text-[10px] text-[#71717A] uppercase tracking-wide">
                {i.property_type}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1 text-xs text-[#A1A1AA]">
            {i.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3 text-[#71717A]" /> {i.email}
              </span>
            )}
            {i.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-[#71717A]" /> {i.phone}
              </span>
            )}
            {i.budget && <span className="text-[#71717A]">{i.budget}</span>}
            {i.timeline && <span className="text-[#71717A]">{i.timeline}</span>}
          </div>
          {i.motivation && (
            <p className="mt-1 text-[11px] text-[#A1A1AA] line-clamp-1">
              {i.motivation}
            </p>
          )}
          {i.notes_preview && (
            <p className="mt-1 text-[11px] text-[#71717A] italic line-clamp-2">
              &ldquo;{i.notes_preview}&rdquo;
            </p>
          )}
        </div>
        <div className="shrink-0 text-[11px] text-[#71717A]">
          {relativeCreated(i.created_at)}
        </div>
      </div>
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

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-md border border-[#252538] bg-[#1a1a25] text-[10px] uppercase tracking-wide text-[#A1A1AA] px-1.5 py-0.5">
      {label}
    </span>
  );
}

function ClaimBadge({ b, who }: { b: LeadClaimBucket; who: string | null }) {
  const cls =
    b === "claimed_by_me"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : b === "claimed_by_other"
      ? "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]"
      : "bg-amber-900/20 text-amber-200 border-amber-700/40";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}
      title={
        b === "claimed_by_me"
          ? "You claimed this lead"
          : b === "claimed_by_other"
          ? `Claimed by ${who ?? "another agent"}`
          : "Unclaimed — available in the lead pool"
      }
    >
      {b === "claimed_by_me" ? <Check className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
      {claimBucketLabel(b)}
    </span>
  );
}

function LeadsEmpty({ hasAny, filter }: { hasAny: boolean; filter: LeadsFilter }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-10 text-center text-sm">
      {hasAny ? (
        <>
          <p className="text-[#A1A1AA]">
            No leads match the current filter
            {filter === "unclaimed"
              ? " — no unclaimed leads in your tenant right now."
              : filter === "claimed_by_me"
              ? " — you haven't claimed any leads yet."
              : "."}
          </p>
          <p className="text-xs text-[#71717A] mt-1">
            Clear filters or check the lead pool later.
          </p>
        </>
      ) : (
        <>
          <p className="text-[#A1A1AA]">No leads in your tenant yet.</p>
          <p className="text-xs text-[#71717A] mt-1">
            New leads posted to the pool will surface here.
          </p>
        </>
      )}
    </div>
  );
}

function IntakesEmpty({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-8 text-center text-sm">
      {hasAny ? (
        <p className="text-[#A1A1AA]">No intakes match your search.</p>
      ) : (
        <>
          <p className="text-[#A1A1AA]">No intakes on file yet.</p>
          <p className="text-xs text-[#71717A] mt-1">
            Intakes from the agent CRM will show up here.
          </p>
        </>
      )}
    </div>
  );
}
