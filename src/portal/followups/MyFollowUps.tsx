"use client";

// ============================================================================
// AP-FOLLOWUPS-1 · My Follow-Ups
// ============================================================================
// 🔒 VAULT IS THE ONLY BACKEND. Every read and write goes through
// `GET/PATCH /api/crm/followups` on Vault, carrying the agent's Supabase
// access token via `authFetch`. This component NEVER touches a crm_* table
// through the Portal's own database client, and it could not: SEC-CRM-1
// revokes anon/authenticated from every crm_* object, so a Portal-side query
// would be refused before RLS was even consulted.
//
// 🔒 OWNERSHIP IS NOT DECIDED HERE. Vault's `resolveCrmOwnerScope` constrains
// the list to the caller's own agent id (Model A, tenant-derived from the
// profiles row, never from request input) and `authorizeCrmRecordAccess`
// re-checks the owner on every PATCH. Nothing in this file can widen that —
// there is no agent or tenant parameter to send.
//
// 🔑 AND THE BUCKETS COME FROM THE DATABASE. The API returns each row's
// `bucket` from `crm_followup_bucket`, the same function Vault's dashboard
// counts with, so the Portal cannot disagree with Vault about what is overdue.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/supabase";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export const BUCKETS = ["overdue", "today", "upcoming", "completed"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  completed: "Completed",
};

export interface FollowupRow {
  id: string;
  title: string;
  description: string | null;
  due_at: string;
  status: string;
  bucket: Bucket | null;
  client_profile_id: string | null;
}

/** Group by the bucket the SERVER supplied. A row whose bucket the server
 *  could not determine is deliberately left out rather than guessed into a
 *  tab — see `crm_followup_bucket`. */
export function groupByBucket(rows: readonly FollowupRow[]): Record<Bucket, FollowupRow[]> {
  const out: Record<Bucket, FollowupRow[]> = { overdue: [], today: [], upcoming: [], completed: [] };
  for (const r of rows) {
    if (r.bucket && BUCKETS.includes(r.bucket)) out[r.bucket].push(r);
  }
  for (const k of BUCKETS) out[k].sort((a, b) => a.due_at.localeCompare(b.due_at));
  return out;
}

/** Eastern, matching `crm_followup_bucket`'s timezone, so a row never reads as
 *  a different day than the tab it sits under. */
export function formatDue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function MyFollowUps({ clientHref }: { clientHref?: (id: string) => string }) {
  const [rows, setRows] = useState<FollowupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Bucket>("overdue");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; due: string; notes: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${VAULT_API_URL}/crm/followups?limit=200`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "Unable to load your follow-ups");
        return;
      }
      setError(null);
      setRows(Array.isArray(body?.tasks) ? (body.tasks as FollowupRow[]) : []);
    } catch {
      setError("Unable to load your follow-ups");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => groupByBucket(rows ?? []), [rows]);

  async function patch(taskId: string, payload: Record<string, unknown>) {
    setBusyId(taskId);
    try {
      const res = await authFetch(`${VAULT_API_URL}/crm/followups`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, ...payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body?.error === "string" ? body.error : "Unable to update that follow-up");
        return;
      }
      setDraft(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section data-testid="ap-my-followups" className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setTab(b)}
            aria-pressed={b === tab}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              b === tab ? "bg-amber-400 text-black" : "bg-white/5 text-white/60 hover:text-white"
            }`}
          >
            {BUCKET_LABEL[b]} {grouped[b].length}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {rows === null ? (
        <p className="text-sm text-white/60">Loading…</p>
      ) : grouped[tab].length === 0 ? (
        <p className="text-sm text-white/60">No {BUCKET_LABEL[tab].toLowerCase()} follow-ups.</p>
      ) : (
        <ul className="space-y-2">
          {grouped[tab].map((r) => (
            <li key={r.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{r.title}</p>
                  <p className="mt-0.5 text-xs text-white/60 tabular-nums">
                    {formatDue(r.due_at)} · {r.status}
                  </p>
                  {r.description ? (
                    <p className="mt-1 text-xs text-white/80">{r.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {r.bucket !== "completed" ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void patch(r.id, { status: "completed" })}
                        className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() =>
                          setDraft(
                            draft?.id === r.id
                              ? null
                              : { id: r.id, due: "", notes: r.description ?? "" },
                          )
                        }
                        className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
                      >
                        {draft?.id === r.id ? "Close" : "Reschedule / notes"}
                      </button>
                    </>
                  ) : null}
                  {r.client_profile_id && clientHref ? (
                    <a
                      href={clientHref(r.client_profile_id)}
                      className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                    >
                      Open contact
                    </a>
                  ) : null}
                </div>
              </div>

              {draft?.id === r.id ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="text-xs text-white/60">
                    New due date
                    <input
                      type="datetime-local"
                      value={draft.due}
                      onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-white/60">
                    Notes
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() =>
                      void patch(r.id, {
                        // Only what changed is sent. An empty date must not
                        // become an invalid `dueDate` the API would reject.
                        ...(draft.due ? { dueDate: new Date(draft.due).toISOString() } : {}),
                        notes: draft.notes,
                      })
                    }
                    className="self-end rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
