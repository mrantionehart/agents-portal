"use client";

// ============================================================================
// DEAL-DISPO-AGENTS · Deal Opportunities (Agent Portal)
// ============================================================================
// Off-market deals the agent's broker has distributed to them. Vault is the
// only backend: every read and write goes through
// `lib/deal-opportunities/vault-deal-opportunities-client.ts` with the agent's
// own Bearer token, and Vault decides what this agent may see.
//
// 🔒 What renders is the BUYER package Vault returns — never the broker's
// internal numbers, which are not in the response at all.
// 🔒 Every response carries a fresh clientRef and the submit button is
// guarded by a ref, so a double tap is one response, never two offers.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listDealOpportunities, getDealOpportunity, respondToDeal, DealOpportunityApiError,
  type DealOpportunitySummary, type DealOpportunityDetail, type DealAction,
} from "@/lib/deal-opportunities/vault-deal-opportunities-client";

const CARD = "rounded-lg border border-[#1a1a2e] bg-[#11111a]";

export const STAGE_LABEL: Record<string, string> = {
  published: "NEW",
  viewed: "OPENED",
  interested: "INTEREST SENT",
  offer_submitted: "OFFER SENT",
  under_review: "BROKER REVIEWING",
  negotiating: "BROKER COUNTERED",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  passed: "PASSED",
};

/** What the agent may do in each stage. Mirrors Vault's TRANSITIONS. */
export function agentActionsFor(stage: string): DealAction[] {
  const open = ["published", "viewed", "interested", "offer_submitted", "under_review", "negotiating"];
  if (!open.includes(stage)) return [];
  const out: DealAction[] = [];
  if (stage === "published" || stage === "viewed") out.push("interest");
  if (["published", "viewed", "interested", "negotiating"].includes(stage)) out.push("offer");
  out.push("inquiry", "pass");
  return out;
}

const money = (c: number | null) =>
  c == null ? "—" : (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const newRef = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");

const ERR: Record<string, string> = {
  wrong_state: "That is no longer possible — your broker has already moved this deal on. It has been refreshed.",
  bad_amount: "Enter an offer amount greater than zero.",
  message_required: "Write your question first.",
  not_found: "This opportunity is no longer available to you.",
  license_not_verified: "Your licence has not been verified yet, so deal opportunities are not available.",
};
const errText = (e: unknown) =>
  e instanceof DealOpportunityApiError
    ? ERR[e.code ?? ""] ?? (e.status === 401 ? "Please sign in again." : `Something went wrong (${e.status}).`)
    : "Could not reach the server.";

const EVENT_LABEL: Record<string, string> = {
  published: "Shared with you", viewed: "You opened it", interest: "You said you're interested",
  inquiry: "Your question", offer: "Your offer", pass: "You passed", review: "Broker is reviewing",
  reply: "Broker replied", counter: "Broker countered", accept: "Broker accepted", decline: "Broker declined",
  revoked: "Access removed",
};

export default function DealOpportunities({ initialId }: { initialId?: string | null }) {
  const [list, setList] = useState<DealOpportunitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialId ?? null);

  const load = useCallback(async () => {
    try { setList(await listDealOpportunities()); setError(null); }
    catch (e) { setError(errText(e)); setList([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (openId) {
    return <DealDetail assignmentId={openId} onBack={() => { setOpenId(null); void load(); }} />;
  }
  if (error) return <p className="text-sm text-red-400" data-testid="deal-opps-error">{error}</p>;
  if (!list) return <p className="text-sm text-white/60">Loading…</p>;
  if (list.length === 0) {
    return (
      <div className={`${CARD} p-6 text-sm text-white/60`} data-testid="deal-opps-empty">
        No deal opportunities yet. When your broker shares an off-market deal with you, it appears here.
      </div>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="deal-opps-list">
      {list.map((o) => (
        <li key={o.assignmentId}>
          <button type="button" onClick={() => setOpenId(o.assignmentId)}
                  data-testid={`deal-opp-${o.assignmentId}`}
                  className={`${CARD} w-full p-4 text-left hover:border-[#2a2a4e]`}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-white">{o.deal.headline ?? "Off-market opportunity"}</span>
              <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                {STAGE_LABEL[o.stage] ?? o.stage}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/60">
              {[o.location.street, o.location.city, o.location.region].filter(Boolean).join(", ") || "Location on request"}
            </p>
            <p className="mt-2 text-sm text-white">Asking {money(o.deal.askingPriceCents)}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DealDetail({ assignmentId, onBack }: { assignmentId: string; onBack: () => void }) {
  const [d, setD] = useState<DealOpportunityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    try { setD(await getDealOpportunity(assignmentId)); setError(null); }
    catch (e) { setError(errText(e)); }
  }, [assignmentId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (action: DealAction) => {
    if (inFlight.current) return;
    let amountCents: number | null = null;
    if (action === "offer") {
      const dollars = Number(amount.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(dollars) || dollars <= 0) { setNote(ERR.bad_amount); return; }
      amountCents = Math.round(dollars * 100);
    }
    if (action === "inquiry" && !message.trim()) { setNote(ERR.message_required); return; }
    inFlight.current = true; setBusy(true); setNote(null);
    try {
      await respondToDeal(assignmentId, {
        action, amountCents, message: message.trim() || null, clientRef: newRef(),
      });
      setAmount(""); setMessage("");
      setNote({ interest: "Your broker has been told you're interested.",
                offer: "Offer sent to your broker.", inquiry: "Question sent.",
                pass: "You've passed on this deal." }[action]);
    } catch (e) { setNote(errText(e)); }
    finally { inFlight.current = false; setBusy(false); await load(); }
  };

  const back = (
    <button type="button" onClick={onBack} className="text-sm text-blue-400" data-testid="deal-opp-back">
      ← All deal opportunities
    </button>
  );
  if (error) return <div className="space-y-3">{back}<p className="text-sm text-red-400" data-testid="deal-opp-error">{error}</p></div>;
  if (!d) return <div className="space-y-3">{back}<p className="text-sm text-white/60">Loading…</p></div>;

  const actions = agentActionsFor(d.stage);
  const facts: Array<[string, string | number | null]> = [
    ["Asking price", money(d.deal.askingPriceCents)],
    ["Property type", d.deal.propertyType?.replace(/_/g, " ") ?? null],
    ["Beds", d.deal.beds], ["Baths", d.deal.baths], ["Sq ft", d.deal.sqft],
    ["Lot (sq ft)", d.deal.lotSizeSqft], ["Units", d.deal.units], ["Year built", d.deal.yearBuilt],
  ];

  return (
    <div className="space-y-4" data-testid="deal-opp-detail">
      {back}
      <div className={`${CARD} p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">{d.deal.headline ?? "Off-market opportunity"}</h2>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80" data-testid="deal-opp-stage">
            {STAGE_LABEL[d.stage] ?? d.stage}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/60">
          {[d.location.street, d.location.city, d.location.region].filter(Boolean).join(", ") || "Location on request"}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          {facts.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
            <div key={k}><dt className="text-white/50">{k}</dt><dd className="text-white">{v}</dd></div>
          ))}
        </dl>
        {d.deal.buyerDescription ? <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">{d.deal.buyerDescription}</p> : null}
        {d.deal.dealTerms ? (
          <p className="mt-2 text-xs text-white/60"><span className="text-white/80">Terms: </span>{d.deal.dealTerms}</p>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div className={`${CARD} space-y-2 p-4`} data-testid="deal-opp-respond">
          <h3 className="text-sm font-medium text-white">Respond to your broker</h3>
          {actions.includes("offer") ? (
            <input inputMode="decimal" placeholder="Offer amount ($)" value={amount}
                   onChange={(e) => setAmount(e.target.value)} data-testid="deal-opp-amount"
                   className="w-full rounded border border-[#1a1a2e] bg-[#0d0d14] px-3 py-2 text-sm text-white sm:w-60" />
          ) : null}
          <textarea placeholder="Message to your broker (terms, your buyer, questions)" value={message}
                    onChange={(e) => setMessage(e.target.value)} data-testid="deal-opp-message" rows={3}
                    className="w-full rounded border border-[#1a1a2e] bg-[#0d0d14] px-3 py-2 text-sm text-white" />
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button key={a} type="button" disabled={busy} onClick={() => void act(a)}
                      data-testid={`deal-opp-${a}`}
                      className={`rounded px-3 py-2 text-sm disabled:opacity-50 ${
                        a === "offer" ? "bg-blue-600 text-white"
                        : a === "pass" ? "border border-red-500/60 text-red-400"
                        : "border border-[#2a2a4e] text-white"}`}>
                {{ interest: "I'm interested", offer: "Submit offer", inquiry: "Ask a question", pass: "Pass" }[a]}
              </button>
            ))}
          </div>
          {d.stage === "offer_submitted" || d.stage === "under_review" ? (
            <p className="text-xs text-white/50" data-testid="deal-opp-pending">
              Your offer is with your broker. You can send a message, but not a second offer, until they answer.
            </p>
          ) : null}
        </div>
      ) : null}

      {note ? <p className="text-sm text-white/80" data-testid="deal-opp-note">{note}</p> : null}

      {d.events.length > 0 ? (
        <div className={`${CARD} p-4`} data-testid="deal-opp-thread">
          <h3 className="text-sm font-medium text-white">History</h3>
          <ol className="mt-2 space-y-1">
            {d.events.map((e) => (
              <li key={e.id} className="text-xs text-white/70">
                <span className="text-white/90">{EVENT_LABEL[e.kind] ?? e.kind}</span>
                {e.amountCents != null ? ` · ${money(e.amountCents)}` : ""}
                {e.message ? ` — “${e.message}”` : ""}
                <span className="ml-1 text-white/40">({when(e.createdAt)})</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
