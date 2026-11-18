"use client";

// ============================================================================
// LEAD-LIFECYCLE · work a client from their profile
// ============================================================================
// After an agent claims a lead, this is where the work happens — on the lead
// itself, so every step stays attached to the same client_profiles row:
//
//   · Follow-ups (call / email / text / meeting) — Vault's EXISTING
//     `/api/crm/followups`, keyed to the profile (`client_profile_id`). A
//     "meeting" follow-up is the lead appointment; completing one with notes
//     is the contact log. No new CRM, calendar or task table.
//   · Transactions — this client's transactions (read by the page with the
//     agent's own session), and "Start a transaction" through the Portal's
//     EXISTING `/api/transactions/create`, carrying `client_profile_id` and
//     the profile's name/email/phone, so nothing is typed twice and no second
//     client record is made. A transaction starts as a draft the broker
//     reviews.
//
// 🔒 Nothing here sends a tenant, an agent or an owner. Vault and the
// transaction route decide who may act on this lead from the caller's token.
// 🔒 Every write button is guarded by a ref, not state: two clicks in one tick
// would both pass a state check.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/supabase";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export const FOLLOWUP_TYPES = [
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting / appointment" },
] as const;

export const TRANSACTION_TYPES = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Listing (seller)" },
] as const;

export interface PanelFollowup {
  id: string; title: string; description: string | null; due_at: string;
  status: string; bucket: string | null;
}
export interface PanelTransaction {
  id: string; property_address: string | null; type: string | null; status: string | null;
}

const CARD = "rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-4";
const INPUT = "w-full rounded-md border border-[#1a1a2e] bg-[#050507] px-3 py-2 text-sm text-[#F1F1F3]";
const BTN = "rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50";
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function ClientWorkPanel({
  client, transactions,
}: {
  client: { id: string; full_name: string | null; email: string | null; phone: string | null };
  transactions: PanelTransaction[] | null;
}) {
  return (
    <div className="space-y-4" data-testid="client-work-panel">
      <FollowupsCard clientId={client.id} />
      <TransactionsCard client={client} initial={transactions} />
    </div>
  );
}

function FollowupsCard({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<PanelFollowup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "call", due: "", notes: "" });
  const [completing, setCompleting] = useState<{ id: string; notes: string } | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${VAULT_API_URL}/crm/followups?client_profile_id=${encodeURIComponent(clientId)}&limit=100`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof body?.error === "string" ? body.error : "Unable to load follow-ups"); return; }
      setError(null);
      setRows(Array.isArray(body?.tasks) ? body.tasks : []);
    } catch { setError("Unable to load follow-ups"); }
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);

  const send = async (method: "POST" | "PATCH", payload: Record<string, unknown>, ok: string) => {
    if (inFlight.current) return false;
    inFlight.current = true; setNote(null);
    try {
      const res = await authFetch(`${VAULT_API_URL}/crm/followups`, {
        method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof body?.error === "string" ? body.error : "That did not save"); return false; }
      setError(null); setNote(ok); await load(); return true;
    } catch { setError("Could not reach the server"); return false; }
    finally { inFlight.current = false; }
  };

  const open = (rows ?? []).filter((r) => r.status !== "completed");
  const done = (rows ?? []).filter((r) => r.status === "completed");

  return (
    <section className={CARD} data-testid="client-followups">
      <h2 className="text-sm font-semibold text-[#F1F1F3]">Follow-ups &amp; appointments</h2>
      {error ? <p className="mt-2 text-xs text-amber-400" data-testid="followups-error">{error}</p> : null}
      {note ? <p className="mt-2 text-xs text-emerald-400" data-testid="followups-note">{note}</p> : null}

      {rows === null && !error ? <p className="mt-2 text-xs text-[#71717A]">Loading…</p> : null}
      {open.length > 0 ? (
        <ul className="mt-3 space-y-2" data-testid="followups-open">
          {open.map((r) => (
            <li key={r.id} className="rounded-md border border-[#1a1a2e] p-3" data-testid={`followup-${r.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-[#F1F1F3]">{r.title}</span>
                <span className={`text-[11px] ${r.bucket === "overdue" ? "text-amber-400" : "text-[#A1A1AA]"}`}>
                  {r.bucket === "overdue" ? "Overdue · " : ""}{when(r.due_at)}
                </span>
              </div>
              {r.description ? <p className="mt-1 text-xs text-[#A1A1AA]">{r.description}</p> : null}
              {completing?.id === r.id ? (
                <div className="mt-2 space-y-2">
                  <textarea className={INPUT} rows={2} placeholder="What happened? (outcome of the call, text, email or meeting)"
                    value={completing.notes} data-testid={`followup-outcome-${r.id}`}
                    onChange={(e) => setCompleting({ id: r.id, notes: e.target.value })} />
                  <div className="flex gap-2">
                    <button type="button" className={`${BTN} bg-emerald-600 text-white`} data-testid={`followup-save-${r.id}`}
                      onClick={async () => {
                        const ok = await send("PATCH", { taskId: r.id, status: "completed", notes: completing.notes.trim() || r.description || "" }, "Logged as done.");
                        if (ok) setCompleting(null);
                      }}>Save as done</button>
                    <button type="button" className={`${BTN} border border-[#1a1a2e] text-[#A1A1AA]`} onClick={() => setCompleting(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" className={`${BTN} mt-2 border border-[#1a1a2e] text-[#F1F1F3]`} data-testid={`followup-complete-${r.id}`}
                  onClick={() => setCompleting({ id: r.id, notes: "" })}>Mark done &amp; log outcome</button>
              )}
            </li>
          ))}
        </ul>
      ) : rows !== null && !error ? (
        <p className="mt-2 text-xs text-[#71717A]" data-testid="followups-empty">No open follow-ups for this client.</p>
      ) : null}

      <form className="mt-4 grid gap-2 sm:grid-cols-3" data-testid="followup-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!form.due) { setError("Choose when."); return; }
          const ok = await send("POST", {
            clientProfileId: clientId, type: form.type,
            dueDate: new Date(form.due).toISOString(), notes: form.notes.trim() || undefined,
          }, "Follow-up added.");
          if (ok) setForm({ type: form.type, due: "", notes: "" });
        }}>
        <select className={INPUT} value={form.type} data-testid="followup-type"
          onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {FOLLOWUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="datetime-local" className={INPUT} value={form.due} data-testid="followup-due"
          onChange={(e) => setForm({ ...form, due: e.target.value })} />
        <input className={INPUT} placeholder="Notes (optional)" value={form.notes} data-testid="followup-notes"
          onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" className={`${BTN} bg-[#E8D5A3] text-black sm:col-span-3`} data-testid="followup-add">
          Add follow-up
        </button>
      </form>

      {done.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-[#A1A1AA]">Contact history ({done.length})</summary>
          <ul className="mt-2 space-y-1" data-testid="followups-done">
            {done.map((r) => (
              <li key={r.id} className="text-xs text-[#A1A1AA]">
                <span className="text-[#F1F1F3]">{r.title}</span> — {r.description ?? "done"} ({when(r.due_at)})
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function TransactionsCard({
  client, initial,
}: {
  client: { id: string; full_name: string | null; email: string | null; phone: string | null };
  initial: PanelTransaction[] | null;
}) {
  const [txns, setTxns] = useState<PanelTransaction[]>(initial ?? []);
  const [form, setForm] = useState({ type: "buyer", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  return (
    <section className={CARD} data-testid="client-transactions">
      <h2 className="text-sm font-semibold text-[#F1F1F3]">Transactions</h2>
      {initial === null ? (
        <p className="mt-2 text-xs text-amber-400" data-testid="transactions-unreadable">Could not read this client&apos;s transactions.</p>
      ) : txns.length === 0 ? (
        <p className="mt-2 text-xs text-[#71717A]" data-testid="transactions-empty">No transactions for this client yet.</p>
      ) : (
        <ul className="mt-2 space-y-1" data-testid="transactions-list">
          {txns.map((t) => (
            <li key={t.id} className="text-sm">
              <Link href={`/workspace/${t.id}`} className="text-[#E8D5A3] hover:underline">
                {t.property_address || "Untitled transaction"}
              </Link>
              <span className="ml-2 text-xs text-[#A1A1AA]">{t.type ?? ""} · {t.status ?? "draft"}</span>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-4 grid gap-2 sm:grid-cols-3" data-testid="transaction-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (inFlight.current) return;
          if (!form.address.trim()) { setError("Enter the property address."); return; }
          inFlight.current = true; setBusy(true); setError(null); setCreated(null);
          try {
            const res = await authFetch("/api/transactions/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: form.type, business_line: "brokerage", property_address: form.address.trim(),
                client_name: client.full_name ?? "", client_email: client.email ?? "",
                client_phone: client.phone ?? "", client_profile_id: client.id,
              }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) { setError(body?.error || `Could not create the transaction (${res.status}).`); return; }
            const id: string | undefined = body?.data?.id ?? body?.transaction?.id ?? body?.id;
            if (id) setTxns((prev) => [{ id, property_address: form.address.trim(), type: form.type, status: "draft" }, ...prev]);
            setCreated("Draft transaction created for this client. Your broker reviews it before anything is sent.");
            setForm({ ...form, address: "" });
          } catch { setError("Could not reach the server."); }
          finally { inFlight.current = false; setBusy(false); }
        }}>
        <select className={INPUT} value={form.type} data-testid="transaction-type"
          onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {TRANSACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input className={`${INPUT} sm:col-span-2`} placeholder="Property address" value={form.address}
          data-testid="transaction-address" onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <button type="submit" disabled={busy} className={`${BTN} bg-[#E8D5A3] text-black sm:col-span-3`} data-testid="transaction-start">
          {busy ? "Creating…" : "Start a transaction for this client"}
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-amber-400" data-testid="transaction-error">{error}</p> : null}
      {created ? <p className="mt-2 text-xs text-emerald-400" data-testid="transaction-created">{created}</p> : null}
      <p className="mt-3 text-xs text-[#71717A]">
        Need dates and every party now?{" "}
        <Link href={`/workspace/new?client=${encodeURIComponent(client.id)}`} className="text-[#E8D5A3] underline" data-testid="transaction-wizard-link">
          Use the full transaction wizard for this client
        </Link>
      </p>
    </section>
  );
}
