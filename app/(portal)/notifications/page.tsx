// ============================================================================
// AGENT PORTAL 2.0 — AP2.1F — Notifications Inbox
// ============================================================================
// Polished inbox replacing the legacy /notifications page. Reads the
// EXISTING `notifications` table via the same Supabase client + RLS the
// legacy page used. Reuses the documented safe mark-read pattern
// (UPDATE read_at = now()). No new Vault endpoints, no new Portal API
// routes, no DB migrations.
//
// Schema notes (legacy file documents these — Sprint D-3 Track F.0.1
// + F.0.4):
//   - body column is 'body' (NOT 'message')
//   - unread is read_at IS NULL (NOT is_read boolean)
// ============================================================================

"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react";

import { getAccessToken } from "@/lib/supabase";
import { useAuth } from "@/app/providers";
import {
  applyFilters,
  categoryFor,
  iconFor,
  inboxCounts,
  linkTargetFor,
  timeAgo,
  type CategoryFilter,
  type NotificationRow,
  type StatusFilter,
} from "@/src/portal/notifications/notifications-helpers";

// ── PORTAL — lock-free data access ───────────────────────────────────────────
// The inbox reads the `notifications` table (RLS-scoped by the user's JWT), but
// via a DIRECT Supabase REST call using the cached access token — NOT the
// browser client's supabase.from(), which transitively calls getSession() and
// intermittently HANGS on the navigator LockManager (same root cause as the
// Coordinator P1). getAccessToken() is push-cached + lock-free. Every request
// is also bounded by a timeout so the spinner can never hang forever.
const REST_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/rest/v1`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const FETCH_TIMEOUT_MS = 8000;

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** fetch() with a bounded timeout so a stalled request can't hang the UI. */
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default function PortalNotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  // ── Auth gate (mirrors the legacy page) ──────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // ── Initial fetch ────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError("Your sign-in has expired — please refresh the page.");
        setRows([]);
        return;
      }
      const select =
        "id,user_id,title,body,type,read_at,created_at,action_url,related_type,related_id";
      const url =
        `${REST_BASE}/notifications?select=${select}` +
        `&user_id=eq.${encodeURIComponent(user.id)}` +
        `&order=created_at.desc&limit=100`;
      const res = await timedFetch(url, { headers });
      if (!res.ok) {
        setError(`Failed to load notifications (${res.status})`);
        setRows([]);
        return;
      }
      const data = (await res.json()) as NotificationRow[];
      setRows(data ?? []);
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "AbortError";
      setError(timedOut ? "Loading timed out — please retry." : e instanceof Error ? e.message : "Failed to load notifications");
      setRows([]);
    }
  }, [user]);

  useEffect(() => {
    if (user) void fetchNotifications();
  }, [user, fetchNotifications]);

  // ── Mark single read (reuse legacy safe pattern) ─────────────────
  async function markRead(id: string) {
    if (!user) return;
    const nowIso = new Date().toISOString();
    // Optimistic update; revert on error.
    setRows((prev) =>
      prev ? prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? nowIso } : n)) : prev
    );
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await timedFetch(
        `${REST_BASE}/notifications?id=eq.${encodeURIComponent(id)}&read_at=is.null`,
        { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ read_at: nowIso }) }
      );
      if (!res.ok) void fetchNotifications(); // soft revert to authoritative state
    } catch {
      void fetchNotifications();
    }
  }

  // ── Mark all read (reuse legacy safe pattern) ────────────────────
  async function markAllRead() {
    if (!user || !rows || busy) return;
    const unread = rows.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    setBusy(true);
    const nowIso = new Date().toISOString();
    setRows((prev) => (prev ? prev.map((n) => ({ ...n, read_at: n.read_at ?? nowIso })) : prev));
    try {
      const headers = await authHeaders();
      if (!headers) { setBusy(false); return; }
      const res = await timedFetch(
        `${REST_BASE}/notifications?user_id=eq.${encodeURIComponent(user.id)}&read_at=is.null`,
        { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ read_at: nowIso }) }
      );
      if (!res.ok) void fetchNotifications();
    } catch {
      void fetchNotifications();
    }
    setBusy(false);
  }

  // ── Derived ──────────────────────────────────────────────────────
  const counts = useMemo(() => (rows ? inboxCounts(rows) : null), [rows]);
  const filtered = useMemo(
    () => (rows ? applyFilters(rows, { status: statusFilter, category: categoryFilter }) : []),
    [rows, statusFilter, categoryFilter]
  );

  // ── Render ───────────────────────────────────────────────────────
  if (authLoading || !user) {
    return (
      <div className="flex items-center gap-2 text-[#71717A] py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div data-training-id="portal.notifications.inbox">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#C9A84C]" />
            <h1 className="text-2xl font-semibold text-[#F1F1F3]">Notifications</h1>
          </div>
          <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
            Latest activity from Vault. Click an item to mark it read or open the
            related transaction.
          </p>
          {counts && counts.unread > 0 && (
            <p className="text-xs text-[#71717A] mt-2 tabular-nums">{counts.unread} unread</p>
          )}
        </div>
        {counts && counts.unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy}
            className="
              inline-flex items-center gap-2
              rounded-md border border-[#C9A84C]/40
              bg-[#C9A84C]/15 px-3 py-1.5 text-sm
              text-[#E8D5A3] hover:bg-[#C9A84C]/25
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-colors duration-[180ms]
            "
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Chip
          label={`All${counts ? ` (${counts.total})` : ""}`}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <Chip
          label={`Unread${counts ? ` (${counts.unread})` : ""}`}
          active={statusFilter === "unread"}
          onClick={() => setStatusFilter("unread")}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        <CategoryChip
          label="All Types"
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        />
        <CategoryChip
          label={`Transactions${counts ? ` (${counts.transactions})` : ""}`}
          active={categoryFilter === "transactions"}
          onClick={() => setCategoryFilter("transactions")}
        />
        <CategoryChip
          label={`Paperwork${counts ? ` (${counts.paperwork})` : ""}`}
          active={categoryFilter === "paperwork"}
          onClick={() => setCategoryFilter("paperwork")}
        />
        <CategoryChip
          label={`System${counts ? ` (${counts.system})` : ""}`}
          active={categoryFilter === "system"}
          onClick={() => setCategoryFilter("system")}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2 mb-4">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">Couldn&apos;t load notifications.</div>
            <div className="mt-1 text-[11px] text-rose-300/80 truncate">{error}</div>
          </div>
        </div>
      )}

      {rows === null && !error ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={(rows?.length ?? 0) > 0} />
      ) : (
        <ul className="rounded-lg border border-[#1a1a2e] overflow-hidden divide-y divide-[#1a1a2e]">
          {filtered.map((n) => (
            <NotificationRowItem key={n.id} n={n} onClick={() => markRead(n.id)} />
          ))}
        </ul>
      )}

      <p className="mt-6 text-[11px] text-[#71717A]">
        This inbox is read-only except for mark-read. Vault is the source of truth
        for the notification stream — no portal-side writes other than the read
        timestamp.
      </p>
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────

function NotificationRowItem({
  n,
  onClick,
}: {
  n: NotificationRow;
  onClick: () => void;
}) {
  const cat = categoryFor(n.type);
  const target = linkTargetFor(n);
  const unread = !n.read_at;
  const body = n.body ?? "";

  const inner = (
    <div
      className={`
        flex items-start gap-3 px-4 py-3
        ${unread ? "bg-[#11111a]" : "bg-[#0b0b10]"}
        hover:bg-[#1a1a25]
        transition-colors duration-[180ms]
      `}
    >
      <span aria-hidden className="text-base shrink-0 mt-0.5">
        {iconFor(n.type)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`truncate text-sm ${
              unread ? "text-[#F1F1F3] font-medium" : "text-[#A1A1AA]"
            }`}
          >
            {n.title}
          </span>
          {unread && (
            <span
              aria-hidden
              className="shrink-0 h-1.5 w-1.5 rounded-full bg-[#C9A84C]"
              title="Unread"
            />
          )}
        </div>
        {body && (
          <p className="text-xs text-[#A1A1AA] mt-0.5 leading-relaxed line-clamp-2">{body}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <CategoryBadge category={cat} type={n.type} />
          <span className="text-[10px] text-[#71717A]">{timeAgo(n.created_at)}</span>
          {target && (
            <span className="text-[10px] text-[#71717A] inline-flex items-center gap-1">
              <ExternalLink className="h-2.5 w-2.5" /> open transaction
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (target) {
    return (
      <li>
        <Link
          href={target}
          onClick={onClick}
          className="block"
          aria-label={`${n.title} — open transaction`}
        >
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left block"
        aria-label={`${n.title} — mark read`}
      >
        {inner}
      </button>
    </li>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

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

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function CategoryBadge({ category, type }: { category: ReturnType<typeof categoryFor>; type: string }) {
  const cls =
    category === "transactions"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : category === "paperwork"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] ${cls}`}>
      {type}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-12 text-center text-sm text-[#71717A] inline-flex items-center gap-2 w-full justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications…
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-12 text-center text-sm">
      {hasAny ? (
        <>
          <p className="text-[#A1A1AA]">No notifications match the current filters.</p>
          <p className="text-xs text-[#71717A] mt-1">Try clearing the filters above.</p>
        </>
      ) : (
        <>
          <p className="text-[#A1A1AA]">You&apos;re all caught up.</p>
          <p className="text-xs text-[#71717A] mt-1">New activity will land here as Vault posts it.</p>
        </>
      )}
    </div>
  );
}
