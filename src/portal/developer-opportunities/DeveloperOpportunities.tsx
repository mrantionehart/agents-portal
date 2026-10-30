"use client";

// ============================================================================
// DEVINTEL-P3I · Developer Opportunities (Agent Portal)
// ============================================================================
// 🔒 VAULT IS THE ONLY BACKEND. Every read and write goes through Vault's
// existing, already agent-capable `/api/development-intel/opportunities`
// routes, carrying the agent's Supabase access token via `authFetch`. This
// component never touches a dev_* table through the Portal's own database
// client, and it could not: `authenticated` holds UPDATE on exactly two
// columns of `dev_opportunities`, and RLS limits rows to the caller's own
// assignment — a Portal-side query would be refused by the database.
//
// 🔒 ENTITLEMENT IS NOT DECIDED HERE. Vault's `authorizeAgentOpportunityAccess`
// requires an active, affiliated, agent-tier, licence-verified profile that is
// actually assigned, and re-checks it on every read and every write. Nothing
// in this file can widen that — there is no tenant, agent or assignment
// parameter to send.
//
// 🔑 AND THE RULES COME FROM VAULT. The five tasks, the progress, the next
// permitted step and every confidence label arrive in the response's `derived`
// block, computed by the same functions Vault's own screen uses. The Portal
// therefore cannot disagree with Vault about what is still outstanding or what
// an agent is allowed to do next — it renders what it is handed.
//
// 🔒 BROKER WORK IS ABSENT, NOT HIDDEN. There is no approve control, no
// assignment control and no outreach control in this file at all. The four
// gates render as read-only facts.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import {
  listMyOpportunities, getOpportunity, saveResearchNotes, setChecklistTask,
  getResearchLog, submitResearchForReview, addResearchSource,
  DevOpportunityApiError,
  type OpportunitySummary, type OpportunityDetail,
  type ResearchLog, type ResearchSubmissionState,
} from "@/lib/development-opportunities/vault-dev-opportunities-client";

const CARD = "rounded-lg border border-[#1a1a2e] bg-[#11111a]";
const SOFT = "rounded-md border border-[#1a1a2e] bg-[#0d0d14]";

// --- DEVINTEL-P12A -------------------------------------------------------
/** What each state is called, in the agent's own terms rather than the
 *  column's. The broker's workspace uses the same four words. */
export const SUBMISSION_LABEL: Record<ResearchSubmissionState, string> = {
  not_submitted: "NOT SUBMITTED",
  awaiting_review: "PENDING REVIEW",
  changes_requested: "CHANGES REQUESTED",
  accepted: "ACCEPTED",
};
/** The five research tasks a submission counts against — fixed, so "3 of 5"
 *  does not change meaning when a checklist item is added. */
export const SUBMISSION_TASK_TOTAL = 5;
/** Vault's own bound, mirrored so the box stops a label the route would
 *  refuse. It is a courtesy; `mergeSourceRef` is the boundary. */
export const SOURCE_LABEL_MAX = 120;

export type Gate = "RESEARCH" | "OUTREACH" | "PROPOSAL" | "AGREEMENT";
export const GATES: readonly Gate[] = ["RESEARCH", "OUTREACH", "PROPOSAL", "AGREEMENT"];

/** Latest decision per gate. Mirrors Vault; a gate approved then rejected
 *  reads as rejected here too. */
export function latestDecision(
  approvals: readonly { approval_type: string; decision: string; decided_at: string }[],
  gate: Gate,
): { decision: string; decided_at: string } | null {
  let best: { decision: string; decided_at: string } | null = null;
  for (const a of approvals) {
    if (a.approval_type !== gate) continue;
    if (!best || a.decided_at >= best.decided_at) best = a;
  }
  return best;
}

/** A Google Maps search for a verified address. The Portal adds no map
 *  library: this is a plain external link, as in Vault. */
export function mapHref(address: string | null | undefined): string | null {
  const a = (address ?? "").trim();
  return a ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a + ", Miami-Dade County, FL")}` : null;
}

export function parcelHref(parcelId: string | null | undefined): string | null {
  const f = (parcelId ?? "").replace(/\D/g, "");
  return f.length === 13 ? `https://www.miamidade.gov/Apps/PA/propertysearch/#/?folio=${f}` : null;
}

const CONF_STYLE: Record<string, string> = {
  VERIFIED: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30",
  POSSIBLE: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30",
  UNKNOWN: "bg-white/5 text-white/60 ring-1 ring-white/10",
};

function Chip({ value, children }: { value: string; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${CONF_STYLE[value] ?? CONF_STYLE.UNKNOWN}`}>
      {children ?? value}
    </span>
  );
}

const fmt = (s: string | null | undefined) => (s ? s.slice(0, 10) : "—");

export default function DeveloperOpportunities({
  followUpsHref = "/follow-ups",
}: { followUpsHref?: string }) {
  const [rows, setRows] = useState<OpportunitySummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [notEntitled, setNotEntitled] = useState(false);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  // DEVINTEL-P12A · the submission log for the relationship on screen, and
  // the source box. `null` means "not read yet", not "nothing submitted".
  const [log, setLog] = useState<ResearchLog | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceError, setSourceError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const page = await listMyOpportunities({ limit: 25 });
        if (!live) return;
        setRows(page.opportunities);
        setSelected((s) => s ?? page.opportunities[0]?.id ?? null);
      } catch (e) {
        if (!live) return;
        // 403 is "authenticated but not entitled" — a real answer, not a crash.
        if (e instanceof DevOpportunityApiError && e.forbidden) setNotEntitled(true);
        else setListError("Could not load your developer opportunities.");
        setRows([]);
      }
    })();
    return () => { live = false; };
  }, []);

  const load = useCallback(async (id: string) => {
    setDetailError(null);
    try {
      const d = await getOpportunity(id);
      setDetail(d);
      setNotes(d.opportunity.research_notes ?? "");
      setEditing(false);
    } catch (e) {
      setDetail(null);
      setDetailError(e instanceof DevOpportunityApiError && e.notFound
        ? "That relationship is not assigned to you."
        : "Could not load that relationship.");
    }
  }, []);

  /**
   * DEVINTEL-P12A · the submission history and the broker's verdicts.
   *
   * Cleared first. Otherwise the previous relationship's ACCEPTED chip sits
   * over this one's address while the read is in flight, which would tell an
   * agent their work had been accepted when it had not been submitted.
   */
  const loadLog = useCallback(async (id: string) => {
    setLog(null);
    try {
      setLog(await getResearchLog(id));
    } catch {
      // A refusal is Vault's answer, not a crash. The panel stays on
      // "checking" rather than inventing a state.
    }
  }, []);

  useEffect(() => { if (selected) void load(selected); }, [selected, load]);
  useEffect(() => {
    if (!selected) return;
    setSourceUrl(""); setSourceLabel(""); setSourceError(null);
    void loadLog(selected);
  }, [selected, loadLog]);

  async function toggle(taskId: string, next: boolean) {
    if (!selected || !detail) return;
    const before = detail;
    // Optimistic, then reconciled from the server's own derived block.
    setDetail({
      ...detail,
      derived: {
        ...detail.derived,
        checklist: detail.derived.checklist.map((t) => (t.id === taskId ? { ...t, done: next } : t)),
        progress: {
          done: detail.derived.checklist.filter((t) => (t.id === taskId ? next : t.done)).length,
          total: detail.derived.progress.total,
        },
      },
    } as OpportunityDetail);
    try {
      await setChecklistTask(selected, taskId, next);
      await load(selected);                 // take Vault's word for the result
    } catch {
      setDetail(before);                    // nothing was saved
      setDetailError("Could not save that task.");
    }
  }

  async function save() {
    if (!selected) return;
    setBusy(true); setDetailError(null);
    try {
      await saveResearchNotes(selected, notes);
      await load(selected);
    } catch {
      setDetailError("Could not save your notes.");
    } finally { setBusy(false); }
  }

  /**
   * Submit the research as Vault holds it.
   *
   * 🔑 Saves nothing first and sends no content. Vault snapshots the row's own
   * notes and evidence — so an agent submits what is SAVED, not what is in an
   * unsaved textarea, and a broker's verdict points at something that is
   * actually in the record.
   */
  async function submit() {
    if (!selected) return;
    setBusy(true); setDetailError(null);
    try {
      await submitResearchForReview(selected);
      await loadLog(selected);
    } catch (e) {
      // 409 is a real answer: already awaiting review, already accepted, or a
      // terminal stage. Re-read so the screen shows the state that exists.
      setDetailError(e instanceof DevOpportunityApiError && e.message
        ? e.message
        : "Could not submit this for review.");
      await loadLog(selected);
    } finally { setBusy(false); }
  }

  /** Add one source document. The URL rule is Vault's; this shows its answer. */
  async function addSource() {
    if (!selected || !sourceUrl.trim()) return;
    setBusy(true); setSourceError(null);
    try {
      await addResearchSource(selected, { url: sourceUrl.trim(), label: sourceLabel.trim() });
      setSourceUrl(""); setSourceLabel("");
      await load(selected);         // the derived source list is Vault's
    } catch (e) {
      setSourceError(e instanceof DevOpportunityApiError && e.message
        ? e.message
        : "Could not add that source.");
    } finally { setBusy(false); }
  }

  if (notEntitled) {
    return (
      <div data-testid="not-entitled" className={`${CARD} p-8 text-center`}>
        <p className="text-sm text-white/70">
          Developer opportunities are available to active agents with a verified licence.
          Speak to your broker if you expect to see work here.
        </p>
      </div>
    );
  }

  if (rows === null) {
    return <div data-testid="loading" className={`${CARD} p-8 text-center text-sm text-white/50`}>Loading…</div>;
  }

  if (listError) {
    return <p role="alert" data-testid="list-error" className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">{listError}</p>;
  }

  if (rows.length === 0) {
    return (
      <div data-testid="empty" className={`${CARD} p-8 text-center text-sm text-white/60`}>
        You have no developer opportunities assigned. Your broker assigns these.
      </div>
    );
  }

  const d = detail;
  const primary = d?.projects.find((p) => p.link?.is_primary) ?? d?.projects[0] ?? null;
  const primaryAddress = primary?.addresses?.[0] ?? null;
  // DEVINTEL-P12A · the verdict on the submission that is currently open. Only
  // that one — an older submission's "changes requested" must not be shown as
  // outstanding once a revision has replaced it.
  const latestReview = log
    ? log.reviews.find((r) => r.submission_id === log.latestSubmissionId) ?? null
    : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside>
        <p data-testid="queue-count" className="mb-2 text-[11px] uppercase tracking-wider text-white/40">
          {rows.length} assigned to you
        </p>
        <ul role="list" className="space-y-1.5">
          {rows.map((o) => (
            <li key={o.id}>
              <button
                type="button" data-testid={`row-${o.id}`}
                aria-current={selected === o.id ? "true" : undefined}
                onClick={() => setSelected(o.id)}
                className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                  selected === o.id ? "bg-amber-500/10 ring-1 ring-amber-500/40" : `${CARD} hover:bg-white/5`
                }`}
              >
                <span className="block text-sm font-medium text-white">
                  {o.research_notes?.split("\n")[0]?.split("—")[0]?.trim() || "Developer opportunity"}
                </span>
                <span className="mt-0.5 block text-[11px] text-white/50">
                  {o.opportunity_type.replace(/_/g, " ").toLowerCase()} · {o.stage}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="space-y-4">
        {detailError && (
          <p role="alert" data-testid="detail-error" className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">{detailError}</p>
        )}

        {d && (
          <>
            {/* ---------------------------------------------------- PROJECT */}
            <section data-testid="section-project" className={`${CARD} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{primary?.project_name ?? "Developer opportunity"}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/60">
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/30">
                      {d.opportunity.opportunity_type.replace(/_/g, " ")}
                    </span>
                    <span>Stage <strong className="font-semibold text-white">{d.opportunity.stage}</strong></span>
                    {d.projects.length > 1 && <span data-testid="parcel-count">{d.projects.length} parcels</span>}
                  </div>
                </div>
                {mapHref(primaryAddress) ? (
                  <a data-testid="view-map" href={mapHref(primaryAddress)!} target="_blank" rel="noopener noreferrer"
                    className="rounded-md bg-amber-500/15 px-3.5 py-2 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/25">
                    View map
                  </a>
                ) : (
                  <span data-testid="view-map-unavailable" className="rounded-md px-3.5 py-2 text-sm text-white/40 ring-1 ring-white/10">No address to map</span>
                )}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <div><dt className="text-[11px] uppercase tracking-wider text-white/40">Developer</dt>
                  <dd data-testid="developer-name" className="mt-0.5 text-sm text-white">{d.derived.developer.name ?? "Not named"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-white/40">Permit stage</dt>
                  <dd className="mt-0.5 text-sm text-white">{d.filings[0]?.permit_stage ?? "None on record"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-white/40">Filings</dt>
                  <dd className="mt-0.5 text-sm text-white">{d.filings.length}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-white/40">Assigned</dt>
                  <dd className="mt-0.5 text-sm text-white">{fmt(d.opportunity.assigned_at)}</dd></div>
              </dl>

              <details data-testid="parcels" className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-amber-300">
                  Parcels, permits and sources ({d.projects.length} parcel{d.projects.length === 1 ? "" : "s"})
                </summary>
                <ul role="list" className="mt-3 space-y-3">
                  {d.projects.map((p) => {
                    const f = d.filings.filter((x) => x.project_id === p.id);
                    const addr = p.addresses?.[0] ?? null;
                    return (
                      <li key={p.id} data-testid={`parcel-${p.parcel_id}`} className={`${SOFT} p-3`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="text-sm font-semibold text-white">{p.project_name ?? "Unnamed parcel"}</span>
                            {p.link?.is_primary && <span className="ml-2 text-[10px] uppercase tracking-wide text-sky-300">primary</span>}
                            <p className="mt-0.5 text-xs text-white/60">{addr ?? "No address on record"}</p>
                            <p className="font-mono text-xs text-white/40">Folio {p.parcel_id ?? "—"}</p>
                          </div>
                          <span className="flex gap-2">
                            {mapHref(addr) && <a data-testid={`map-${p.parcel_id}`} href={mapHref(addr)!} target="_blank" rel="noopener noreferrer" className="rounded px-2 py-1 text-xs text-white ring-1 ring-white/10 hover:bg-white/5">Map</a>}
                            {parcelHref(p.parcel_id) && <a data-testid={`pa-${p.parcel_id}`} href={parcelHref(p.parcel_id)!} target="_blank" rel="noopener noreferrer" className="rounded px-2 py-1 text-xs text-white ring-1 ring-white/10 hover:bg-white/5">Parcel record</a>}
                          </span>
                        </div>
                        {f.length === 0 ? (
                          <p data-testid={`no-permits-${p.parcel_id}`} className="mt-2 text-xs text-white/50">No filing on record for this parcel.</p>
                        ) : (
                          <ul role="list" data-testid={`permits-${p.parcel_id}`} className="mt-2 space-y-1">
                            {f.slice(0, 6).map((x, i) => (
                              <li key={i} className="text-xs text-white/70">
                                <span className="font-semibold text-white">{x.permit_stage ?? "stage unknown"}</span>
                                {" · "}{x.application_date ? `applied ${fmt(x.application_date)}` : x.stage_verified_at ? `stage confirmed ${fmt(x.stage_verified_at)}` : "no date on record"}
                                {x.filing_type && <> · {x.filing_type}</>}
                                {x.contractor_text && <div className="text-white/50">Contractor: {x.contractor_text}</div>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {d.derived.sources.length > 0 && (
                  <ul role="list" data-testid="sources" className="mt-3 space-y-1">
                    {d.derived.sources.map((s, i) => (
                      <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-300 underline">{s.label}</a></li>
                    ))}
                  </ul>
                )}
              </details>
            </section>

            {/* ---------------------------------------------------- CONTACT */}
            <section data-testid="section-contact" className={`${CARD} p-5`}>
              <h3 className="mb-3 text-base font-semibold text-white">Contact</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div data-testid="fact-developer" className={`${SOFT} p-3`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Developer</span>
                    <Chip value={d.derived.developer.status.confidence} />
                  </div>
                  <p className="mt-1.5 text-sm text-white">{d.derived.developer.name ?? "No developer is named by an independent source"}</p>
                  {d.derived.developer.status.note && <p className="mt-1 text-xs text-white/55">{d.derived.developer.status.note}</p>}
                </div>
                <div data-testid="owners" className={`${SOFT} p-3`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Owner of record</span>
                  {d.owners.length === 0 ? <p className="mt-1.5 text-sm text-white/60">No owner party recorded.</p> : (
                    <ul role="list" className="mt-1.5 space-y-1.5">
                      {d.owners.map((o, i) => {
                        const nm = Array.isArray(o.dev_developers) ? o.dev_developers[0]?.entity_name : o.dev_developers?.entity_name;
                        return (
                          <li key={i} className="text-sm text-white">
                            {nm ?? "(unnamed)"}{" "}
                            <Chip value={o.identity_verified ? "VERIFIED" : "UNKNOWN"}>{o.identity_verified ? "identity verified" : "identity unverified"}</Chip>
                            <span className="block text-xs text-white/40">{o.source_name ?? "source not recorded"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div data-testid="fact-contact" className={`${SOFT} p-3`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Decision-maker</span>
                  <p className="mt-1.5 text-sm text-white">{d.derived.contact.value ?? "No officer is named in any corporate record"}</p>
                  <p className="mt-1 text-xs text-white/55">No verified business phone or email on file. Nothing is inferred here.</p>
                </div>
                <div data-testid="fact-representation" className={`${SOFT} p-3`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Representation</span>
                    <Chip value={d.derived.representation.confidence} />
                  </div>
                  <p className="mt-1.5 text-sm text-white">{d.derived.representation.confidence === "UNKNOWN" ? "Not established either way" : d.derived.representation.value}</p>
                  {d.derived.representation.note && <p className="mt-1 text-xs text-white/55">{d.derived.representation.note}</p>}
                </div>
              </div>
              <p className="mt-3 text-xs text-white/40">
                Owner, developer and contractor are three different parties, each from its own record.
                A contractor is never promoted to developer.
              </p>
            </section>

            {/* ------------------------------------------------- NEXT STEPS */}
            <section data-testid="section-next" className={`${CARD} p-5`}>
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-base font-semibold text-white">Next steps</h3>
                <span data-testid="progress" className="text-xs font-semibold tabular-nums text-white/60">
                  {d.derived.progress.done}/{d.derived.progress.total} complete
                </span>
              </div>
              <div aria-hidden className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${d.derived.progress.total ? (d.derived.progress.done / d.derived.progress.total) * 100 : 0}%` }} />
              </div>
              <ul role="list" data-testid="checklist" className="space-y-2">
                {d.derived.checklist.map((t) => (
                  <li key={t.id} data-testid={`task-${t.id}`} className={`${SOFT} p-3`}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" data-testid={`check-${t.id}`} checked={t.done}
                        onChange={(e) => toggle(t.id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 flex-none accent-amber-400" />
                      <span>
                        <span className={`block text-sm ${t.done ? "text-white/40 line-through" : "text-white"}`}>{t.label}</span>
                        <span className="mt-0.5 block text-xs text-white/55">{t.why}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div data-testid="next-step" className={`mt-4 ${SOFT} p-3`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Next step</span>
                <p className="mt-1 text-sm text-white">{d.derived.nextAction.label}</p>
                <p className="mt-0.5 text-xs text-white/55">{d.derived.nextAction.because}</p>
                {d.derived.nextAction.brokerOnly && (
                  <p data-testid="broker-only" className="mt-1 text-xs text-white/40">This step is a broker decision.</p>
                )}
              </div>

              <details data-testid="research" className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-amber-300">Research notes</summary>
                {d.opportunity.research_notes
                  ? <p data-testid="research-read" className={`mt-2 whitespace-pre-line ${SOFT} p-3 text-sm leading-relaxed text-white/85`}>{d.opportunity.research_notes}</p>
                  : <p data-testid="research-empty" className="mt-2 text-sm text-white/50">No research recorded yet.</p>}
                {!editing && (
                  <button type="button" data-testid="edit-research" onClick={() => setEditing(true)}
                    className="mt-2 rounded-md px-3 py-1.5 text-sm text-white ring-1 ring-white/10 hover:bg-white/5">Edit research notes</button>
                )}
                {editing && (
                  <div className="mt-2">
                    <label htmlFor="dev-notes" className="text-xs text-white/60">Research notes</label>
                    <textarea id="dev-notes" data-testid="research-notes" rows={12} value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 w-full rounded-md border border-[#1a1a2e] bg-[#0d0d14] p-3 text-sm leading-relaxed text-white" />
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy} onClick={save}
                        className="rounded-md bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/30 disabled:opacity-40">Save research</button>
                      <button type="button" disabled={busy} onClick={() => { setNotes(d.opportunity.research_notes ?? ""); setEditing(false); }}
                        className="rounded-md px-3 py-1.5 text-sm text-white/70 ring-1 ring-white/10">Cancel</button>
                    </div>
                  </div>
                )}
              </details>

              {/* ------------------------------- P12A · BROKER REVIEW ----- */}
              {/* 🔒 One write: submit. There is no accept control and no
                  request-changes control in this file at all — those are
                  broker work, and `research/reviews` POST refuses an agent
                  token. Absent, not hidden, like the four gates. */}
              <div data-testid="submission" className={`mt-4 ${SOFT} p-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Broker review
                  </span>
                  {log && (
                    <span
                      data-testid={`submission-state-${log.state}`}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                        log.state === 'accepted' ? 'text-emerald-300 ring-emerald-500/30'
                          : log.state === 'changes_requested' ? 'text-amber-300 ring-amber-500/30'
                            : log.state === 'awaiting_review' ? 'text-sky-300 ring-sky-500/30'
                              : 'text-white/50 ring-white/10'
                      }`}
                    >
                      {SUBMISSION_LABEL[log.state]}
                    </span>
                  )}
                </div>

                {!log ? (
                  <p data-testid="submission-loading" className="mt-1.5 text-xs text-white/40">Checking…</p>
                ) : (
                  <>
                    <p data-testid="submission-explainer" className="mt-1.5 text-xs leading-relaxed text-white/55">
                      {log.state === 'not_submitted'
                        ? 'Your notes and ticks above save as you work. Submitting takes a snapshot of them for your broker to read — it does not lock anything.'
                        : log.state === 'awaiting_review'
                          ? 'Submitted. Your broker reads the snapshot you sent; carry on working meanwhile — nothing here is frozen.'
                          : log.state === 'changes_requested'
                            ? 'Your broker asked for changes. Make them, then submit again — the new submission replaces this one in the review queue.'
                            : 'Your broker accepted this research. Contacting the owner is a separate decision and still needs OUTREACH approved.'}
                    </p>

                    {/* ---- the feedback to act on ------------------------ */}
                    {log.state === 'changes_requested' && latestReview?.note && (
                      <div data-testid="broker-feedback" className="mt-2 rounded-md bg-amber-500/5 p-2.5 ring-1 ring-amber-500/20">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                          What your broker asked for
                        </span>
                        <p data-testid="broker-feedback-note" className="mt-1 whitespace-pre-line text-sm leading-relaxed text-white/85">
                          {latestReview.note}
                        </p>
                        <p className="mt-1 text-[11px] text-white/40">{fmt(latestReview.reviewed_at)}</p>
                      </div>
                    )}
                    {log.state === 'accepted' && latestReview?.note && (
                      <div data-testid="broker-accept-note" className="mt-2 rounded-md bg-emerald-500/5 p-2.5 ring-1 ring-emerald-500/20">
                        <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">{latestReview.note}</p>
                      </div>
                    )}

                    {/* ---- the one write -------------------------------- */}
                    {(log.state === 'not_submitted' || log.state === 'changes_requested') ? (
                      <button
                        type="button" data-testid="submit-research" disabled={busy}
                        onClick={submit}
                        className="mt-2.5 rounded-md bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
                      >
                        {log.state === 'changes_requested' ? 'Submit revision for review' : 'Submit for broker review'}
                      </button>
                    ) : (
                      <p data-testid="submit-unavailable" className="mt-2.5 text-xs text-white/40">
                        {log.state === 'awaiting_review'
                          ? 'Waiting on your broker — there is nothing further to send.'
                          : 'Accepted. There is nothing further to send.'}
                      </p>
                    )}

                    {log.submissions.length > 0 && (
                      <details data-testid="submission-history" className="mt-2.5">
                        <summary className="cursor-pointer text-xs font-medium text-amber-300">
                          Submission history ({log.submissions.length})
                        </summary>
                        <ol role="list" className="mt-2 space-y-1.5">
                          {log.submissions.map((s) => {
                            const r = log.reviews.find((x) => x.submission_id === s.id) ?? null
                            return (
                              <li key={s.id} data-testid={`history-${s.id}`} className="text-xs leading-relaxed text-white/60">
                                <span className="text-white/85">{fmt(s.submitted_at)}</span>
                                {' · '}{s.tasks_done} of {SUBMISSION_TASK_TOTAL} tasks
                                {' · '}
                                <span className={!r ? 'text-sky-300' : r.decision === 'accepted' ? 'text-emerald-300' : 'text-amber-300'}>
                                  {!r ? 'awaiting review' : r.decision === 'accepted' ? 'accepted' : 'changes requested'}
                                </span>
                                {r?.note && <div className="text-white/50">{r.note}</div>}
                              </li>
                            )
                          })}
                        </ol>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
                          Append-only — a submission cannot be edited or withdrawn, so a correction is a
                          new revision rather than a rewritten past.
                        </p>
                      </details>
                    )}
                  </>
                )}
              </div>

              {/* ------------------------------- P12A · SOURCE DOCUMENTS -- */}
              {/* 🔒 Sent as `addSource`, one record at a time. Vault merges it
                  into the evidence it holds and validates the URL; this side
                  never sends the whole array. */}
              <div data-testid="add-source" className={`mt-3 ${SOFT} p-3`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  Source documents ({d.derived.sources.length})
                </span>
                {d.derived.sources.length === 0 ? (
                  <p data-testid="source-list-empty" className="mt-1.5 text-xs text-white/50">
                    None recorded yet. A finding a broker can act on names where it came from.
                  </p>
                ) : (
                  <ul role="list" data-testid="source-list" className="mt-1.5 space-y-1">
                    {d.derived.sources.map((s, i) => (
                      <li key={`${s.url}-${i}`}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          data-testid="source-link"
                          className="text-xs text-amber-300 underline">{s.label}</a>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2.5 space-y-2">
                  <div>
                    <label htmlFor="src-label" className="text-xs text-white/60">What it is</label>
                    <input
                      id="src-label" data-testid="source-label" type="text" value={sourceLabel}
                      onChange={(e) => setSourceLabel(e.target.value)}
                      placeholder="Sunbiz officer record"
                      maxLength={SOURCE_LABEL_MAX}
                      className="mt-1 w-full rounded-md border border-[#1a1a2e] bg-[#0d0d14] px-2.5 py-1.5 text-sm text-white placeholder:text-white/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="src-url" className="text-xs text-white/60">Link</label>
                    <input
                      id="src-url" data-testid="source-url" type="url" value={sourceUrl}
                      onChange={(e) => { setSourceUrl(e.target.value); setSourceError(null); }}
                      placeholder="https://…"
                      className="mt-1 w-full rounded-md border border-[#1a1a2e] bg-[#0d0d14] px-2.5 py-1.5 text-sm text-white placeholder:text-white/30"
                    />
                  </div>
                  {sourceError && (
                    <p role="alert" data-testid="source-error" className="text-xs font-medium text-amber-300">{sourceError}</p>
                  )}
                  <button
                    type="button" data-testid="add-source-button" disabled={busy || !sourceUrl.trim()}
                    onClick={addSource}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-40"
                  >
                    Add source
                  </button>
                  <p className="text-[11px] leading-relaxed text-white/35">
                    A link to a page anyone can open — a county record, a corporate filing, a permit.
                    Only http:// and https:// addresses are accepted.
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Follow-ups</span>
                {d.followups.length === 0
                  ? <p data-testid="followups-empty" className="mt-1 text-sm text-white/55">No follow-up linked to this relationship yet.</p>
                  : (
                    <ul role="list" data-testid="followups" className="mt-1 space-y-1">
                      {d.followups.map((f) => (
                        <li key={f.id} className="text-xs text-white/70">
                          <span className="text-white">{f.title}</span> · {f.status}{f.due_at && <> · due {fmt(f.due_at)}</>}
                        </li>
                      ))}
                    </ul>
                  )}
                <a href={followUpsHref} data-testid="followups-link" className="mt-2 inline-block text-xs font-medium text-amber-300 underline">Open My Follow-Ups</a>
              </div>
            </section>

            {/* ------------------------------------- BROKER DECISIONS (read-only) */}
            <section data-testid="section-decisions" className={`${CARD} p-5`}>
              <h3 className="mb-1 text-base font-semibold text-white">Broker decisions</h3>
              <p className="mb-3 text-xs text-white/50">
                Read-only. Four independent decisions, made by your broker in Vault. An earlier
                approval never implies a later one.
              </p>
              <ul role="list" className="space-y-1.5">
                {GATES.map((g) => {
                  const st = latestDecision(d.approvals, g);
                  const tone = !st ? "text-white/50" : st.decision === "approved" ? "text-emerald-300" : "text-red-300";
                  return (
                    <li key={g} data-testid={`gate-${g}`} className={`flex items-center gap-3 ${SOFT} px-3 py-2`}>
                      <span className="w-24 text-sm font-semibold text-white">{g}</span>
                      <span data-testid={`gate-state-${g}`} className={`text-xs font-medium ${tone}`}>{st ? st.decision : "not decided"}</span>
                      {st && <span className="text-xs text-white/40">{fmt(st.decided_at)}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
