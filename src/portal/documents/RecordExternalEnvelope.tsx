"use client";

// ============================================================================
// AGENT PORTAL · "Record external envelope"
// ============================================================================
// For the case Vault refuses to send: an ERL-14 the agent completed outside
// Vault has no signature anchor Vault recognises, so the native send is
// refused and the agreement goes out through the agent's own DocuSign. This
// records that it did.
//
// 🔒 IT RECORDS, IT DOES NOT SEND. There is no send button here and no code
// path that could become one. The two actions are "record what I already
// sent" and "ask DocuSign again".
//
// 🔒 UNVERIFIED IS SAID, NOT IMPLIED. Vault decides verification by reading
// the envelope back from the sending account; when it could not, the badge
// reads UNVERIFIED in those words and `effectiveTone` refuses to paint
// anything unverified as good — so a "Completed" that nobody confirmed can
// never look like a signed agreement.
// ============================================================================

import { useEffect, useState } from "react";

import { authFetch } from "@/lib/supabase";
import {
  esignConnectionState,
  type EsignConnectionState,
  type EsignStatusLite,
} from "./checklist/checklist-logic";

import {
  ENTRY_PROBLEM_COPY,
  RECORD_BLOCKER_COPY,
  connectionCopy,
  effectiveTone,
  recordBlocker,
  statusView,
  validateEnvelopeId,
  verificationView,
  type Tone,
} from "./external-envelope-view";

export interface ExternalEnvelopeRow {
  readonly id: string;
  readonly envelope_id: string | null;
  readonly status: string;
  readonly verified: boolean;
  readonly sent_at: string | null;
  readonly sending_account_email: string | null;
  readonly has_executed_pdf: boolean;
  readonly has_certificate: boolean;
}

export interface RecordExternalEnvelopeProps {
  readonly transactionId: string;
  readonly formInstanceId: string;
  readonly formId: string;
  /** The form instance's status, as Vault reports it. */
  readonly documentStatus: string;
  readonly hasPdf: boolean;
  /** Envelopes already recorded against this document. */
  readonly envelopes: ReadonlyArray<ExternalEnvelopeRow>;
  readonly onChanged?: () => void;
}

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-zinc-800 text-zinc-300",
  info: "bg-blue-900/40 text-blue-200 border border-blue-800",
  good: "bg-emerald-900/40 text-emerald-200 border border-emerald-800",
  warn: "bg-amber-900/40 text-amber-200 border border-amber-800",
  bad: "bg-red-900/40 text-red-200 border border-red-800",
};

function Badge({ label, tone, testId }: { label: string; tone: Tone; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

export default function RecordExternalEnvelope({
  transactionId, formInstanceId, formId, documentStatus, hasPdf,
  envelopes, onChanged,
}: RecordExternalEnvelopeProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conn, setConn] = useState<EsignConnectionState>("checking");
  const [connEmail, setConnEmail] = useState<string | null>(null);

  // Read when the form OPENS, which is the only moment the answer is shown
  // and the moment it is most likely to have just changed (the agent may have
  // reconnected on /settings in another tab). Not on mount: the panel mounts
  // one of these per approved document and none of them needs the answer until
  // it is asked for.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setConn("checking");
    void (async () => {
      try {
        const res = await authFetch("/api/esign/status", { method: "GET" });
        if (!active) return;
        if (!res.ok) {
          setConn("unknown");
          return;
        }
        const s = (await res.json().catch(() => null)) as EsignStatusLite | null;
        if (!active) return;
        setConnEmail(s?.email ?? null);
        setConn(esignConnectionState(s));
      } catch {
        if (active) setConn("unknown");
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  const blocker = recordBlocker({
    status: documentStatus,
    hasPdf,
    existingEnvelopes: envelopes.length,
  });

  const post = async (url: string, body?: unknown) => {
    // authFetch, never a bare fetch: it attaches the Bearer token from the
    // cached session and self-heals one 401. The bare fetch that stood here
    // attached a token the MOUNT SITE had to supply, and the mount site
    // supplied null — so every attempt reached the proxy unauthenticated and
    // came back 401 before Vault was ever asked.
    const res = await authFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  };

  const record = async () => {
    const problem = validateEnvelopeId(value);
    if (problem) {
      setError(ENTRY_PROBLEM_COPY[problem]);
      return;
    }
    setBusy("record");
    setError(null);
    setNotice(null);
    try {
      const r = await post(
        `/api/paperwork/external-envelope/${encodeURIComponent(transactionId)}/${encodeURIComponent(formInstanceId)}`,
        {
          envelope_id: value.trim(),
          ...(sentAt ? { sent_at: new Date(sentAt).toISOString() } : {}),
        },
      );
      if (!r.ok) {
        // Vault's own words. "That envelope is not in the connected account"
        // and "DocuSign could not be reached" mean different things to do.
        setError(String(r.json.error ?? `Could not record the envelope (${r.status}).`));
        return;
      }
      setNotice(String(r.json.notice ?? "Envelope recorded."));
      setValue("");
      setOpen(false);
      onChanged?.();
    } catch {
      setError("Could not reach the server to record the envelope.");
    } finally {
      setBusy(null);
    }
  };

  const refresh = async (rowId: string) => {
    setBusy(rowId);
    setError(null);
    setNotice(null);
    try {
      const r = await post(`/api/paperwork/external-envelope/refresh/${encodeURIComponent(rowId)}`);
      if (!r.ok) {
        setError(String(r.json.error ?? `Could not refresh the status (${r.status}).`));
        return;
      }
      setNotice(
        r.json.status === "completed"
          ? "DocuSign confirms this is fully executed. The executed document and certificate are stored in Vault."
          : `DocuSign reports: ${statusView(String(r.json.status)).label}.`,
      );
      onChanged?.();
    } catch {
      setError("Could not reach the server to refresh the status.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-2 rounded-lg border border-[#2a2a3e] p-3" data-testid="external-envelope">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-200">Sent outside Vault</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Vault cannot send {formId} for signature, so an envelope sent from your own
            DocuSign is recorded here. Recording never sends anything.
          </p>
        </div>
        {envelopes.length === 0 && !blocker && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            data-testid="open-record-form"
            className="shrink-0 rounded-lg border border-[#2a2a3e] px-2.5 py-1 text-xs text-zinc-300 hover:bg-[#12121c]"
          >
            Record envelope
          </button>
        )}
      </div>

      {blocker && (
        <p className="mt-2 text-[11px] text-amber-300" data-testid="record-blocked">
          {RECORD_BLOCKER_COPY[blocker]}
        </p>
      )}

      {envelopes.length > 0 && (
        <ul className="mt-2 space-y-2" data-testid="envelope-list">
          {envelopes.map((e) => {
            const sv = statusView(e.status);
            const vv = verificationView(e.verified);
            return (
              <li key={e.id} className="text-xs" data-testid={`envelope-${e.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    label={sv.label}
                    tone={effectiveTone(e.status, e.verified)}
                    testId={`envelope-status-${e.id}`}
                  />
                  <Badge label={vv.label} tone={vv.tone} testId={`envelope-verified-${e.id}`} />
                  <span className="font-mono text-[11px] text-zinc-500">
                    {(e.envelope_id ?? "").slice(0, 8)}…
                  </span>
                  {e.sending_account_email && (
                    <span className="text-[11px] text-zinc-500">
                      sent from {e.sending_account_email}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void refresh(e.id)}
                    disabled={busy !== null}
                    data-testid={`refresh-${e.id}`}
                    className="ml-auto rounded border border-[#2a2a3e] px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-[#12121c] disabled:opacity-50"
                  >
                    {busy === e.id ? "Asking DocuSign…" : "Refresh status"}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">{vv.detail}</p>
                {e.verified && e.status === "completed" && (
                  <p className="mt-0.5 text-[11px] text-zinc-500" data-testid={`artifacts-${e.id}`}>
                    {e.has_executed_pdf ? "Executed document stored" : "Executed document not yet retrieved"}
                    {" · "}
                    {e.has_certificate ? "certificate of completion stored" : "certificate not yet retrieved"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2" data-testid="record-form">
          <label className="block text-[11px] text-zinc-400" htmlFor="envelope-id">
            DocuSign envelope ID
          </label>
          <input
            id="envelope-id"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full rounded-lg border border-[#2a2a3e] bg-[#0f0f18] p-2 font-mono text-xs text-zinc-200"
          />
          <label className="block text-[11px] text-zinc-400" htmlFor="envelope-sent-at">
            Date sent (optional)
          </label>
          <input
            id="envelope-sent-at"
            type="date"
            value={sentAt}
            onChange={(e) => setSentAt(e.target.value)}
            className="rounded-lg border border-[#2a2a3e] bg-[#0f0f18] p-2 text-xs text-zinc-200"
          />
          <p className="text-[11px] text-zinc-500" data-testid="connection-notice">
            {connectionCopy(conn, connEmail)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void record()}
              disabled={busy !== null}
              data-testid="submit-record"
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {busy === "record" ? "Checking with DocuSign…" : "Record envelope"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded border border-red-900 bg-red-950/40 p-2 text-[11px] text-red-200" data-testid="record-error">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-2 rounded border border-[#2a2a3e] p-2 text-[11px] text-zinc-300" data-testid="record-notice">
          {notice}
        </p>
      )}
    </section>
  );
}
