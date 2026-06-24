// ============================================================================
// AGENT PORTAL 2.0 — Workspace client shell
// ============================================================================
// Holds filter state. Receives the pre-fetched WorkspaceCard list from
// the server component (no client-side fetch — Vault is hit server-side
// to avoid CORS + token-exposure surface). Renders the card grid.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";

import WorkspaceCard from "./WorkspaceCard";
import { applyFilters } from "./helpers";
import type { StatusFilter, TypeFilter, WorkspaceCard as WorkspaceCardData } from "./types";

interface Props {
  items: WorkspaceCardData[];
  vaultBase: string;
  /** Server-side error to render instead of the grid. */
  error?: { status: number; message: string };
}

export default function WorkspaceClient({ items, vaultBase, error }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(
    () => applyFilters(items, { status: statusFilter, type: typeFilter }),
    [items, statusFilter, typeFilter]
  );

  const counts = useMemo(
    () => ({
      total: items.length,
      ready_for_review: items.filter((c) => c.readiness_tier === "ready_for_review").length,
      ready_for_signature: items.filter((c) => c.readiness_tier === "ready_for_signature").length,
      needs_more_info: items.filter(
        (c) =>
          c.next_action === "continue_collection" ||
          c.next_action === "request_party_attestation"
      ).length,
    }),
    [items]
  );

  return (
    <div>
      {/* Status chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Chip label={`All (${counts.total})`} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <Chip
          label={`Ready for Review (${counts.ready_for_review})`}
          active={statusFilter === "ready_for_review"}
          onClick={() => setStatusFilter("ready_for_review")}
        />
        <Chip
          label={`Ready for Signature (${counts.ready_for_signature})`}
          active={statusFilter === "ready_for_signature"}
          onClick={() => setStatusFilter("ready_for_signature")}
        />
        <Chip
          label={`Needs More Info (${counts.needs_more_info})`}
          active={statusFilter === "needs_more_info"}
          onClick={() => setStatusFilter("needs_more_info")}
        />
      </div>

      {/* Type chips */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        <TypeChip label="All Types" active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
        <TypeChip label="Lease" active={typeFilter === "lease"} onClick={() => setTypeFilter("lease")} />
        <TypeChip label="Purchase" active={typeFilter === "purchase"} onClick={() => setTypeFilter("purchase")} />
        <TypeChip label="Listing" active={typeFilter === "listing"} onClick={() => setTypeFilter("listing")} />
        <TypeChip label="Buyer Rep" active={typeFilter === "buyer_rep"} onClick={() => setTypeFilter("buyer_rep")} />
      </div>

      {error ? (
        <ErrorState status={error.status} message={error.message} />
      ) : filtered.length === 0 ? (
        <EmptyState hasItems={items.length > 0} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((card) => (
            <WorkspaceCard key={card.transaction_id} card={card} vaultBase={vaultBase} />
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] text-[#71717A]">
        Broker confirmation is required for any change. This Portal does not send envelopes or finalize packages — Vault is the source of truth.
      </p>
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

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-12 text-center text-sm">
      {hasItems ? (
        <>
          <p className="text-[#A1A1AA]">No transactions match the current filters.</p>
          <p className="mt-1 text-xs text-[#71717A]">Try clearing the filters above.</p>
        </>
      ) : (
        <>
          <p className="text-[#A1A1AA]">No active transactions yet.</p>
          <p className="mt-1 text-xs text-[#71717A]">
            Once you create or are assigned a transaction, it will appear here.
          </p>
        </>
      )}
    </div>
  );
}

function ErrorState({ status, message }: { status: number; message: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">
          {status === 401
            ? "Please sign in to view your workspace."
            : status === 403
            ? "You don't have permission to view this workspace."
            : `Couldn't load the workspace (HTTP ${status}).`}
        </div>
        {message && (
          <div className="mt-1 text-[11px] text-rose-300/80 truncate">{message}</div>
        )}
      </div>
    </div>
  );
}
