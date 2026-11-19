"use client";
// ============================================================================
// FL-CAT-1 — Deal facts the agent answers for their own transaction
// ============================================================================
// Two controlled questions decide two conditional document requirements:
//   • Brokerage relationship (F.S. 475.278) → Brokerage Relationship Disclosure
//   • Earnest-money deposit required by the contract → Proof of Earnest Money
// An answer decides whether a requirement APPLIES; it never satisfies one. The
// Broker of Record still verifies every document, and once the deal is
// submitted only the broker can change an answer (Vault enforces both).
// Unanswered / Unknown keeps the requirement review-required.
// ============================================================================
import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";

type Facts = {
  available: boolean;
  applies: boolean;
  editable: boolean;
  brokerage_relationship: string | null;
  earnest_money_status: string | null;
};

const RELATIONSHIP_OPTIONS = [
  { value: "", label: "Not yet determined" },
  { value: "transaction_broker", label: "Transaction broker" },
  { value: "single_agent", label: "Single agent" },
  { value: "no_brokerage_relationship", label: "No brokerage relationship" },
  { value: "unknown", label: "Unknown — needs verification" },
];
const EARNEST_OPTIONS = [
  { value: "", label: "Not yet determined" },
  { value: "required", label: "Yes — a deposit is required" },
  { value: "not_required", label: "No — the contract requires no deposit" },
  { value: "unknown", label: "Unknown — needs verification" },
];

const SELECT =
  "w-full rounded-md border border-[#1a1a2e] bg-[#0a0a0f] px-3 py-2 text-sm text-[#F1F1F3] focus:outline-none focus:border-[#C9A84C] disabled:opacity-60";

export default function DealFactsCard({
  transactionId,
  fetchImpl,
}: {
  transactionId: string;
  /** Injectable for tests (defaults to window.fetch). */
  fetchImpl?: typeof fetch;
}) {
  // No fetch available (non-browser render) ⇒ nothing to show; never throw.
  const doFetch: typeof fetch | undefined = fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  const url = `/api/transactions/${encodeURIComponent(transactionId)}/compliance-facts`;
  const [facts, setFacts] = useState<Facts | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rel, setRel] = useState("");
  const [em, setEm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    if (!doFetch) return;
    Promise.resolve()
      .then(() => doFetch(url, { credentials: "include" }))
      .then(async (r) => (r.ok ? ((await r.json()) as Facts) : Promise.reject(r.status)))
      .then((f) => {
        if (!live) return;
        setFacts(f);
        setRel(f.brokerage_relationship ?? "");
        setEm(f.earnest_money_status ?? "");
      })
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (loadError) {
    return (
      <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5 text-xs text-[#71717A]" data-testid="deal-facts-error">
        Deal facts could not be loaded. Your broker can record them in Vault.
      </section>
    );
  }
  if (!facts || !facts.applies || !facts.available) return null;

  const changed = rel !== (facts.brokerage_relationship ?? "") || em !== (facts.earnest_money_status ?? "");

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (!doFetch) throw new Error("no fetch");
      const res = await doFetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerage_relationship: rel || null, earnest_money_status: em || null }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || "Couldn't save the answers.");
      } else {
        setFacts((f) => (f ? { ...f, brokerage_relationship: rel || null, earnest_money_status: em || null } : f));
        setSaved(true);
      }
    } catch {
      setError("Couldn't save the answers.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5" data-testid="deal-facts">
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] inline-flex items-center gap-1.5 mb-3">
        <ClipboardCheck className="h-3.5 w-3.5 text-[#C9A84C]" />
        Deal facts for required documents
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="deal-facts-relationship" className="block text-sm text-[#F1F1F3] mb-1.5">
            Brokerage relationship with the client (F.S. 475.278)
          </label>
          <select id="deal-facts-relationship" aria-label="Brokerage relationship" className={SELECT} value={rel} disabled={!facts.editable || busy} onChange={(e) => setRel(e.target.value)}>
            {RELATIONSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {(!rel || rel === "unknown") && (
            <p className="mt-1 text-xs text-amber-400">The Brokerage Relationship Disclosure stays required until this is answered.</p>
          )}
        </div>
        <div>
          <label htmlFor="deal-facts-earnest" className="block text-sm text-[#F1F1F3] mb-1.5">
            Does the executed contract require an earnest-money deposit?
          </label>
          <select id="deal-facts-earnest" aria-label="Earnest-money requirement" className={SELECT} value={em} disabled={!facts.editable || busy} onChange={(e) => setEm(e.target.value)}>
            {EARNEST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {(!em || em === "unknown") && (
            <p className="mt-1 text-xs text-amber-400">Proof of earnest money stays required until this is answered.</p>
          )}
        </div>
      </div>
      {facts.editable ? (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="rounded-md bg-[#C9A84C] px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
            disabled={!changed || busy}
            onClick={save}
          >
            {busy ? "Saving…" : "Save answers"}
          </button>
          {saved && <span className="text-xs text-emerald-400" role="status">Saved. Your broker reviews every document before payout.</span>}
          {error && <span className="text-xs text-red-400" role="alert">{error}</span>}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[#71717A]" data-testid="deal-facts-locked">
          Submitted for broker review — only your broker can change these answers now.
        </p>
      )}
    </section>
  );
}
