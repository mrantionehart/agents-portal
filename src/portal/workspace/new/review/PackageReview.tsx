// ============================================================================
// TRANSACTION OS 3.3C — Package Review (client renderer)
// ============================================================================
// Renders ONE buildFormPackage result: required (locked) / optional (selectable)
// / suggested riders / searchable pool / package gates, with the "why" (reason)
// and live status per form. Selections are CLIENT-SIDE only — nothing is
// materialized, generated, or sent. The Generate Package button is exposed and
// gated, but its action belongs to the next phase (3.3D).
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Plus,
  Check,
  Search,
  FileText,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Send,
  Eye,
  Link2,
  Pencil,
} from "lucide-react";

import type { PackageForm, PackageReviewData } from "./types";
import {
  computeDisplayBlueprint,
  filterSearchable,
  formStatusLabel,
  formStatusTone,
  formNeedsCompletion,
  gatesView,
  actionLabel,
  type StatusTone,
} from "./package-view";
import {
  generatePackage,
  sendPackage,
  getConnectUrl,
  getPreviewUrl,
  type SelectedForm,
  type FormOutcome,
} from "./generate-send-orchestrator";

const TONE_CLASS: Record<StatusTone, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  muted: "bg-white/[0.04] text-[#A1A1AA] border-white/[0.08]",
};

/** Merge fresh outcomes over prior ones, keyed by form_id. */
function mergeOutcomes(prev: FormOutcome[], next: FormOutcome[]): FormOutcome[] {
  const byId = new Map(prev.map((o) => [o.form_id, o]));
  for (const o of next) byId.set(o.form_id, o);
  return [...byId.values()];
}

function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]}`}>
      {label}
    </span>
  );
}

function FormRow({
  form,
  data,
  selectable,
  checked,
  onToggle,
  transactionId,
}: {
  form: PackageForm;
  data: PackageReviewData;
  selectable: boolean;
  checked: boolean;
  onToggle?: () => void;
  transactionId: string;
}) {
  const tone = formStatusTone(form.form_id, data.form_status);
  const statusLabel = formStatusLabel(form.form_id, data.form_status);
  const needsCompletion = formNeedsCompletion(form.form_id, data.form_status);
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-3">
      {selectable ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`${checked ? "Remove" : "Add"} ${form.label}`}
          onClick={onToggle}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            checked
              ? "border-[#C9A84C]/60 bg-[#C9A84C]/20 text-[#E8D5A3]"
              : "border-[#252538] bg-transparent text-transparent hover:border-[#C9A84C]/40"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span
          className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[#71717A]"
          title="Required — locked"
          aria-label="Required, locked"
        >
          <Lock className="h-3.5 w-3.5" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#F1F1F3]">{form.label}</span>
          <span className="text-[11px] uppercase tracking-wide text-[#71717A]">
            {form.category}
          </span>
          {form.suggested && !form.required && (
            <span className="rounded-full bg-[#C9A84C]/15 px-2 py-0.5 text-[11px] text-[#E8D5A3]">
              Suggested
            </span>
          )}
          <StatusBadge tone={tone} label={statusLabel} />
        </div>
        <p className="mt-1 text-xs text-[#A1A1AA]">{form.reason}</p>
        {needsCompletion && (
          <Link
            href={`/workspace/${transactionId}?tab=documents&form=${form.form_id}`}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#E8D5A3] hover:underline"
          >
            <Pencil className="h-3 w-3" /> Complete required fields
          </Link>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1a1a2e] bg-[#11111a] p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F1F1F3]">
        {icon}
        {title}
        <span className="ml-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-[#A1A1AA]">
          {count}
        </span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export interface PackageReviewProps {
  data: PackageReviewData;
  transactionId: string;
}

export default function PackageReview({ data, transactionId }: PackageReviewProps) {
  const { package_plan: plan } = data;

  const [optionalSelected, setOptionalSelected] = useState<Set<string>>(
    () => new Set(plan.optional_forms.filter((f) => f.selected).map((f) => f.form_id))
  );
  const [riderSelected, setRiderSelected] = useState<Set<string>>(
    () => new Set(plan.suggested_riders.filter((f) => f.selected).map((f) => f.form_id))
  );
  const [searchSelected, setSearchSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  const blueprint = useMemo(
    () =>
      computeDisplayBlueprint(
        plan.required_forms,
        optionalSelected,
        new Set<string>([...riderSelected, ...searchSelected])
      ),
    [plan.required_forms, optionalSelected, riderSelected, searchSelected]
  );

  const gates = gatesView(plan.package_gates);
  const searchResults = useMemo(
    () => filterSearchable(plan.searchable_forms, query),
    [plan.searchable_forms, query]
  );

  // ── Generate & Send (3.3D) ────────────────────────────────────────────────
  const router = useRouter();
  const [busy, setBusy] = useState<null | "generating" | "sending">(null);
  const [outcomes, setOutcomes] = useState<FormOutcome[]>([]);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  /** The forms in the package (required ∪ selected optional/riders/search),
   *  resolving each form_instance_id from live status or a prior generate. */
  const buildForms = (): SelectedForm[] =>
    blueprint.all_selected.map((fid) => {
      const st = data.form_status[fid];
      const prior = outcomes.find((o) => o.form_id === fid);
      return {
        form_id: fid,
        form_instance_id: prior?.form_instance_id ?? st?.form_instance_id,
        generatable: st?.generatable,
        disposition: st?.disposition,
      };
    });

  const handleGenerate = async () => {
    setBusy("generating");
    setBanner(null);
    const res = await generatePackage(transactionId, buildForms());
    setOutcomes(res);
    setBusy(null);
    const failed = res.filter((o) => !o.ok);
    if (failed.length) setBanner(`${failed.length} form(s) could not be generated.`);
  };

  const handleSend = async () => {
    setBusy("sending");
    setBanner(null);
    setNeedsConnect(false);
    const { results, needsConnect: nc } = await sendPackage(transactionId, buildForms());
    setBusy(null);
    setOutcomes((prev) => mergeOutcomes(prev, results));
    if (nc) {
      setNeedsConnect(true);
      setBanner("Connect your DocuSign account to send for signature.");
      return;
    }
    const failed = results.filter((o) => !o.ok && !o.skipped);
    if (failed.length) {
      setBanner(`${failed.length} form(s) could not be sent.`);
      return;
    }
    router.push(`/workspace/${transactionId}`);
  };

  const handleConnect = async () => {
    const url = await getConnectUrl();
    if (url) window.location.href = url;
    else setBanner("Could not start the DocuSign connection.");
  };

  const handlePreview = async (o: FormOutcome) => {
    if (!o.form_instance_id) return;
    const url = await getPreviewUrl(transactionId, o.form_instance_id);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div className="mx-auto max-w-[860px] space-y-5" data-testid="package-review">
      <header>
        <Link
          href={`/workspace/${transactionId}`}
          className="inline-flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-[#F1F1F3]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[#F1F1F3]">Package Review</h1>
        <p className="mt-1 text-sm text-[#A1A1AA]">
          Review the transaction package before generating documents.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#71717A]">
          <span>{plan.summary.required_count} required</span>
          <span>{plan.summary.optional_count} optional</span>
          <span>{plan.summary.rider_count} riders</span>
          <span className="text-[#E8D5A3]">
            {blueprint.total_in_package} in package
          </span>
        </div>
      </header>

      {/* Package gates */}
      <section className="rounded-xl border border-[#1a1a2e] bg-[#11111a] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#C9A84C]" />
          <span className="text-sm font-semibold text-[#F1F1F3]">Package Status</span>
          <StatusBadge
            tone={gates.can_prepare_package ? "ok" : "muted"}
            label={gates.prepare_label}
          />
          {gates.can_send_for_signature && (
            <StatusBadge tone="ok" label="Ready for signature" />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-[#71717A]">
          <span>{gates.ready_count} ready</span>
          <span>{gates.blocked_count} blocked</span>
        </div>
        {gates.recommended_actions.length > 0 && (
          <ul className="mt-3 space-y-1">
            {gates.recommended_actions.map((a) => (
              <li key={a} className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                {actionLabel(a)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section
        title="Required Forms"
        icon={<Lock className="h-4 w-4 text-[#71717A]" />}
        count={plan.required_forms.length}
      >
        {plan.required_forms.length === 0 ? (
          <p className="text-xs text-[#71717A]">No required forms for this transaction.</p>
        ) : (
          plan.required_forms.map((f) => (
            <FormRow
              key={f.form_id}
              form={f}
              data={data}
              selectable={false}
              checked
              transactionId={transactionId}
            />
          ))
        )}
      </Section>

      <Section
        title="Optional Forms"
        icon={<FileText className="h-4 w-4 text-[#71717A]" />}
        count={plan.optional_forms.length}
      >
        {plan.optional_forms.length === 0 ? (
          <p className="text-xs text-[#71717A]">No optional forms available.</p>
        ) : (
          plan.optional_forms.map((f) => (
            <FormRow
              key={f.form_id}
              form={f}
              data={data}
              selectable
              checked={optionalSelected.has(f.form_id)}
              onToggle={() => toggle(optionalSelected, setOptionalSelected, f.form_id)}
              transactionId={transactionId}
            />
          ))
        )}
      </Section>

      <Section
        title="Suggested Riders"
        icon={<FileText className="h-4 w-4 text-[#71717A]" />}
        count={plan.suggested_riders.length}
      >
        {plan.suggested_riders.length === 0 ? (
          <p className="text-xs text-[#71717A]">No riders suggested.</p>
        ) : (
          plan.suggested_riders.map((f) => (
            <FormRow
              key={f.form_id}
              form={f}
              data={data}
              selectable
              checked={riderSelected.has(f.form_id)}
              onToggle={() => toggle(riderSelected, setRiderSelected, f.form_id)}
              transactionId={transactionId}
            />
          ))
        )}
      </Section>

      {/* Searchable pool */}
      <section className="rounded-xl border border-[#1a1a2e] bg-[#11111a] p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F1F1F3]">
          <Search className="h-4 w-4 text-[#71717A]" />
          Add a Form
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52525b]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the form registry…"
            aria-label="Search forms"
            className="w-full rounded-lg border border-[#1a1a2e] bg-transparent py-2.5 pl-9 pr-4 text-sm text-[#F1F1F3] placeholder:text-[#52525b] focus:border-[#C9A84C]/50 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
          />
        </div>
        <div className="mt-3 space-y-2">
          {searchResults.length === 0 ? (
            <p className="text-xs text-[#71717A]">No matching forms.</p>
          ) : (
            searchResults.slice(0, 25).map((f) => {
              const added = searchSelected.has(f.form_id);
              return (
                <div
                  key={f.form_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-3"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-[#F1F1F3]">{f.label}</span>
                    <span className="ml-2 text-[11px] uppercase tracking-wide text-[#71717A]">
                      {f.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(searchSelected, setSearchSelected, f.form_id)}
                    aria-label={`${added ? "Remove" : "Add"} ${f.label}`}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      added
                        ? "border-[#C9A84C]/40 bg-[#C9A84C]/15 text-[#E8D5A3]"
                        : "border-[#252538] text-[#A1A1AA] hover:text-[#F1F1F3]"
                    }`}
                  >
                    {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {added ? "Added" : "Add"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Generate & Send (3.3D) — orchestrates the existing engines. */}
      <footer className="space-y-3 pb-8" data-testid="package-actions">
        {banner && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {banner}
          </div>
        )}

        {outcomes.length > 0 && (
          <ul className="space-y-1.5" data-testid="generate-outcomes">
            {outcomes.map((o) => (
              <li
                key={o.form_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {o.ok ? (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                  )}
                  <span className="truncate text-[#F1F1F3]">{o.form_id}</span>
                  {!o.ok && o.error && (
                    <span className="truncate text-xs text-red-400">{o.error}</span>
                  )}
                </span>
                {o.ok && o.form_instance_id && (
                  <button
                    type="button"
                    onClick={() => handlePreview(o)}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-[#252538] px-2 py-1 text-xs text-[#A1A1AA] hover:text-[#F1F1F3]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {needsConnect && (
          <button
            type="button"
            onClick={handleConnect}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-500/25 transition-colors"
          >
            <Link2 className="h-4 w-4" />
            Connect DocuSign
          </button>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!gates.can_prepare_package || busy !== null}
            title={
              gates.can_prepare_package
                ? "Materialize + generate the package PDFs"
                : "Complete the required forms before generating"
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-[#252538] px-4 py-2 text-sm font-medium text-[#F1F1F3] hover:bg-white/[0.04] transition-colors disabled:pointer-events-none disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            {busy === "generating" ? "Generating…" : "Generate Package"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!gates.can_send_for_signature || busy !== null}
            title={
              gates.can_send_for_signature
                ? "Send the package for signature"
                : "The package isn't ready to send yet"
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-4 py-2 text-sm font-medium text-[#E8D5A3] hover:bg-[#C9A84C]/25 transition-colors disabled:pointer-events-none disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {busy === "sending" ? "Sending…" : "Send for Signature"}
          </button>
        </div>
      </footer>
    </div>
  );
}
