"use client";
// ============================================================================
// "Request time with the Broker" — agent-facing create form.
// Sends ONLY agent-owned fields to the Portal proxy (which forwards to Vault):
// meetingType, priority, durationMin, timezone, 1–3 future proposedStarts,
// notes, idempotencyKey. It NEVER sends tenant/broker/requester/status or an
// arbitrary expiration — Vault owns those (server-derived expiry).
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/supabase";
import {
  AGENT_MEETING_TYPES,
  MEETING_TYPE_LABELS,
  MEETING_PRIORITIES,
  PRIORITY_LABELS,
  type AgentMeetingType,
  type MeetingPriority,
} from "@/src/portal/meetings/types";
import { validateCreate } from "@/src/portal/meetings/bucketing";

const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function CreateMeetingForm() {
  const router = useRouter();
  const [meetingType, setMeetingType] = useState<AgentMeetingType>("deal_review");
  const [priority, setPriority] = useState<MeetingPriority>("normal");
  const [durationMin, setDurationMin] = useState(30);
  const [times, setTimes] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [minDateTime, setMinDateTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useRef<string | null>(null);

  // Client-only: default the min selectable time to "now" (no SSR mismatch).
  useEffect(() => {
    const d = new Date(Date.now() + 60_000);
    d.setSeconds(0, 0);
    setMinDateTime(d.toISOString().slice(0, 16));
  }, []);

  function ensureIdem(): string {
    if (!idem.current) idem.current = (globalThis.crypto?.randomUUID?.() ?? `agent-${Math.random().toString(36).slice(2)}-${times.join("|")}`);
    return idem.current;
  }

  function setTime(i: number, v: string) {
    setTimes((prev) => prev.map((t, idx) => (idx === i ? v : t)));
  }
  const addTime = () => setTimes((prev) => (prev.length < 3 ? [...prev, ""] : prev));
  const removeTime = (i: number) => setTimes((prev) => prev.filter((_, idx) => idx !== i));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const proposedStarts = times
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => {
        const d = new Date(t);
        return Number.isNaN(d.getTime()) ? t : d.toISOString();
      });

    const check = validateCreate({ meetingType, priority, durationMin, timezone, proposedStarts }, new Date());
    if (!check.ok) { setError(check.error ?? "Please review the form."); return; }

    setBusy(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          meetingType, priority, durationMin, timezone, proposedStarts,
          notes: notes.trim() || null,
          idempotencyKey: ensureIdem(),
        }),
      });
      if (res.ok) {
        router.push("/meetings");
        router.refresh();
        return;
      }
      let msg = `Couldn't submit your request (${res.status}).`;
      try { const j = await res.json(); if (typeof j?.error === "string") msg = j.error; } catch { /* ignore */ }
      setError(msg);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5">
      <Field label="Meeting type">
        <select value={meetingType} onChange={(e) => setMeetingType(e.target.value as AgentMeetingType)} className={selectCls}>
          {AGENT_MEETING_TYPES.map((t) => (
            <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as MeetingPriority)} className={selectCls}>
            {MEETING_PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </Field>
        <Field label="Duration">
          <select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className={selectCls}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Preferred times (1–3, future only)">
        <div className="space-y-2">
          {times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={t}
                min={minDateTime || undefined}
                onChange={(e) => setTime(i, e.target.value)}
                className={`${selectCls} flex-1`}
              />
              {times.length > 1 && (
                <button type="button" onClick={() => removeTime(i)} className="text-xs text-[#71717A] hover:text-rose-300 px-2 py-1">Remove</button>
              )}
            </div>
          ))}
          {times.length < 3 && (
            <button type="button" onClick={addTime} className="text-xs text-[#E8D5A3] hover:text-[#C9A84C]">+ Add another time</button>
          )}
        </div>
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What would you like to discuss?"
          className={`${selectCls} resize-y`}
        />
      </Field>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[#C9A84C] px-4 py-2 text-sm font-medium text-[#0b0b10] hover:bg-[#E8D5A3] disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Request time"}
        </button>
        <a href="/meetings" className="text-sm text-[#A1A1AA] hover:text-[#F1F1F3]">Cancel</a>
      </div>
    </form>
  );
}

const selectCls =
  "w-full rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-sm text-[#F1F1F3] focus:border-[#C9A84C]/50 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#A1A1AA]">{label}</span>
      {children}
    </label>
  );
}
