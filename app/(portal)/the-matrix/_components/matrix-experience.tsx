// ============================================================================
// Matrix Simulator — the learner experience (Agent Portal)
// ============================================================================
// Presentation only. useMatrixPractice owns the flow and calls the existing
// Vault matrix-sim routes. Matrix-inspired: HartFelt-dark surfaces with a green
// accent (no proprietary Matrix graphics or copyrighted course text). Dark by
// default behind matrixSimulatorEnabled().
// ============================================================================

"use client";

import { type ReactNode } from "react";
import { Loader2, Save, Send, Table2, CheckCircle2, AlertTriangle } from "lucide-react";

import { useMatrixPractice } from "../_lib/use-matrix-practice";
import { matrixSimulatorEnabled } from "../_lib/matrix-flags";
import type { LearnerSafeField, MatrixFieldValue } from "@/lib/matrix/vault-matrix-client";

const CARD = "rounded-lg border border-[#13231a] bg-[#0b0f0c]";
const GREEN = "bg-[#22c55e] text-[#04120a]";
const GREEN_TEXT = "text-[#4ade80]";

export function MatrixExperience({ preview = false }: { preview?: boolean } = {}) {
  const ring = useMatrixPractice({ preview });

  if (!matrixSimulatorEnabled()) {
    return (
      <div className={`${CARD} p-6`}>
        <h2 className="text-base font-semibold text-[#E6F5EC]">Matrix Simulator</h2>
        <p className="mt-2 text-sm text-[#9db3a6]">Practical MLS listing practice is coming soon.</p>
      </div>
    );
  }

  let content: ReactNode;
  if (ring.phase === "idle") {
    content = <EntryView onStart={(scenarioId) => void ring.enter(scenarioId)} />;
  } else if (ring.phase === "preparing") {
    content = <Centered><Loader2 className="h-5 w-5 animate-spin text-[#22c55e]" aria-hidden="true" /><p className="mt-3 text-sm text-[#9db3a6]">Loading your exercise…</p></Centered>;
  } else if ((ring.phase === "editing" || ring.phase === "submitting") && ring.exercise) {
    content = <ExerciseForm ring={ring} />;
  } else if (ring.phase === "done" && ring.result) {
    content = <ResultView ring={ring} />;
  } else {
    content = (
      <Centered>
        <p className="text-sm text-[#E6F5EC]">{ring.error ?? "Something went wrong."}</p>
        <button type="button" onClick={() => void ring.enter()} className={`mt-4 inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold ${GREEN}`}>Try again</button>
      </Centered>
    );
  }

  if (!ring.preview) return content;
  return (
    <div className="space-y-3" data-matrix-broker-preview>
      <div className="rounded-lg border border-[#2a4a16] bg-[#131f0a] px-4 py-3" data-testid="matrix-preview-banner">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a3e635]">Broker preview · nothing is saved</p>
        <p className="mt-0.5 text-xs text-[#9db3a6]">
          You are previewing exactly what an agent sees and is scored on. No attempt, submission, or
          credential is recorded, and no agent&rsquo;s progress is touched. Reset any time.
        </p>
      </div>
      {content}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className={`${CARD} flex flex-col items-center justify-center px-6 py-12 text-center`}>{children}</div>;
}

// Each module is a separately-scored practical scenario family. All three use
// the same engine, server-side scoring, ≥85% / zero-critical standard, and
// Broker-of-Record approval — they differ only in the scenario + field schema.
const MATRIX_MODULES: ReadonlyArray<{
  scenarioId: string;
  module: "A" | "B" | "C";
  title: string;
  description: string;
}> = [
  {
    scenarioId: "matrix-fl-rental-a1",
    module: "A",
    title: "Module A — Residential Lease (RNT)",
    description:
      "Complete a fictional Florida residential-lease (RNT) MLS listing: verify Fill-from-Tax data, confirm the folio-derived MLS area, correct the prior agent's mistakes, and submit for Broker of Record review.",
  },
  {
    scenarioId: "matrix-fl-sales-b1",
    module: "B",
    title: "Module B — Residential Sales (RE1/RE2)",
    description:
      "Complete a fictional Florida residential-sale listing: property search, folio/MLS-area verification, classification, details, required fields, Fill-from-Tax validation, photos, remarks, and error correction, then submit for review.",
  },
  {
    scenarioId: "matrix-fl-maint-c1",
    module: "C",
    title: "Module C — Listing Maintenance",
    description:
      "Maintain a fictional active Florida listing: status/price changes (within 2 business days), corrections, photo management, supplements, and authorization, then escalate to the broker.",
  },
];

function EntryView({ onStart }: { onStart: (scenarioId: string) => void }) {
  return (
    <div className={`${CARD} p-6`} data-matrix-module-picker>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#22c55e]/15 text-[#22c55e]">
          <Table2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[#E6F5EC]">Choose a practical module</h2>
          <p className="mt-1 text-sm text-[#9db3a6]">
            Each module is scored separately (≥85%, zero critical errors) and certified by your Broker
            of Record. Practice only — fictional data, no live MLS; any step that needs live MLS
            verification is labelled in the exercise.
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {MATRIX_MODULES.map((m) => (
          <li
            key={m.scenarioId}
            className="rounded-md border border-[#13231a] bg-[#060a07] p-4"
            data-matrix-module={m.scenarioId}
          >
            <h3 className="text-sm font-semibold text-[#E6F5EC]">{m.title}</h3>
            <p className="mt-1 text-xs text-[#9db3a6]">{m.description}</p>
            <button
              type="button"
              onClick={() => onStart(m.scenarioId)}
              aria-label={`Start Module ${m.module}`}
              data-matrix-module-start={m.scenarioId}
              className={`mt-3 inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold ${GREEN}`}
            >
              Start Module {m.module}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExerciseForm({ ring }: { ring: ReturnType<typeof useMatrixPractice> }) {
  const ex = ring.exercise!;
  const hintByField = new Map(ex.hints.map((h) => [h.fieldId, h.hint]));
  const busy = ring.phase === "submitting";

  return (
    <div className={`${CARD} p-6`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#22c55e]">Your scenario</p>
      <h2 className="mt-1 text-lg font-semibold text-[#E6F5EC]">{ex.scenarioLabel}</h2>
      <p className="mt-2 text-sm text-[#9db3a6]">{ex.briefing}</p>

      <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void ring.submit(); }}>
        {ex.fields.map((f) => (
          <Field
            key={f.id}
            field={f}
            value={ring.values[f.id] ?? ""}
            hint={hintByField.get(f.id)}
            error={ring.fieldErrors[f.id]}
            onChange={(v) => ring.setValue(f.id, v)}
          />
        ))}

        <div className="flex items-center gap-3 border-t border-[#13231a] pt-4">
          {!ring.preview && (
            <button
              type="button"
              onClick={() => void ring.saveDraft()}
              disabled={ring.saving || busy}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#1f3a2b] px-4 text-sm font-medium text-[#9db3a6] disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden="true" /> {ring.saving ? "Saving…" : "Save Incomplete"}
            </button>
          )}
          <button type="submit" disabled={busy} className={`inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold disabled:opacity-60 ${GREEN}`}>
            <Send className="h-4 w-4" aria-hidden="true" /> {busy ? "Scoring…" : ring.preview ? "Score (preview)" : "Submit for Review"}
          </button>
          {!ring.preview && ring.savedAt && !ring.saving && <span className="text-xs text-[#4ade80]">Draft saved</span>}
        </div>
      </form>
    </div>
  );
}

function Field({
  field, value, hint, error, onChange,
}: {
  field: LearnerSafeField;
  value: MatrixFieldValue | "";
  hint?: string;
  error?: string;
  onChange: (v: MatrixFieldValue | "") => void;
}) {
  const base = "mt-1 w-full rounded-md border bg-[#060a07] px-3 py-2 text-sm text-[#E6F5EC] focus:outline-none";
  const border = error ? "border-[#b91c1c] focus:border-[#ef4444]" : "border-[#1f3a2b] focus:border-[#22c55e]";
  const ro = field.autoPopulated;

  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-medium text-[#c7dbcf]">
        {field.label}{field.required && <span className="text-[#ef4444]">*</span>}
        {ro && <span className="rounded bg-[#22c55e]/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#4ade80]">AutoPop · verify</span>}
      </label>

      {field.type === "enum" ? (
        <select aria-label={field.label} disabled={ro} value={String(value)} onChange={(e) => onChange(e.target.value)} className={`${base} ${border}`}>
          <option value="">— select —</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea aria-label={field.label} readOnly={ro} rows={2} value={String(value)} onChange={(e) => onChange(e.target.value)} className={`${base} ${border}`} />
      ) : (
        <input
          aria-label={field.label}
          readOnly={ro}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={String(value)}
          onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
          className={`${base} ${border}`}
        />
      )}

      {hint && <p className="mt-1 text-xs text-[#eab308]">{hint}</p>}
      {error && <p className="mt-1 text-xs text-[#f87171]" role="alert">{error}</p>}
      {field.help && !hint && <p className="mt-1 text-xs text-[#6b8577]">{field.help}</p>}
    </div>
  );
}

function ResultView({ ring }: { ring: ReturnType<typeof useMatrixPractice> }) {
  const r = ring.result!;
  const preview = ring.preview;
  return (
    <div className={`${CARD} p-6`} data-testid={preview ? "matrix-preview-result" : "matrix-result"}>
      <div className="flex items-center gap-2">
        {r.passed
          ? <CheckCircle2 className="h-5 w-5 text-[#22c55e]" aria-hidden="true" />
          : <AlertTriangle className="h-5 w-5 text-[#eab308]" aria-hidden="true" />}
        <h2 className="text-lg font-semibold text-[#E6F5EC]">{preview ? "Preview score" : "Submitted for review"}</h2>
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${r.passed ? GREEN_TEXT : "text-[#eab308]"}`}>{r.scorePct}%</p>
      <p className="mt-1 text-sm text-[#9db3a6]">
        {preview
          ? `${r.passed ? "Meets the bar (≥85%, zero critical errors)." : `Below the bar${r.criticalErrorCount > 0 ? ` — ${r.criticalErrorCount} critical error(s)` : ""}.`} This is a broker preview — nothing was saved, submitted, or certified.`
          : r.passed
            ? "Meets the bar (≥85%, zero critical errors). A Broker of Record will review and certify."
            : `Not yet passing${r.criticalErrorCount > 0 ? ` — ${r.criticalErrorCount} critical error(s)` : ""}. Review the coaching and try again.`}
      </p>

      {r.coaching.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#22c55e]">Still to correct</h3>
          <ul className="mt-2 space-y-1.5">
            {r.coaching.map((c) => (
              <li key={c.fieldId} className="text-sm text-[#9db3a6]">
                {c.label}{c.critical && <span className="ml-2 rounded bg-[#b91c1c]/20 px-1.5 py-0.5 text-[10px] uppercase text-[#f87171]">critical</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && ring.review && ring.review.length > 0 && (
        <div className="mt-5" data-testid="matrix-preview-answer-review">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a3e635]">Answer review (broker only)</h3>
          <ul className="mt-2 space-y-1.5">
            {ring.review.map((g) => (
              <li key={g.fieldId} className="flex flex-wrap items-center gap-x-2 text-xs">
                {g.correct
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" aria-hidden="true" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-[#eab308]" aria-hidden="true" />}
                <span className="text-[#c7dbcf]">{g.label}</span>
                {!g.correct && (
                  <span className="text-[#9db3a6]">
                    — expected <span className="text-[#4ade80]">{String(g.expected)}</span>, got{" "}
                    <span className="text-[#f87171]">{g.actual === "" || g.actual === null ? "(blank)" : String(g.actual)}</span>
                  </span>
                )}
                {g.critical && <span className="rounded bg-[#b91c1c]/20 px-1.5 py-0.5 text-[10px] uppercase text-[#f87171]">critical</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={() => void ring.enter()} className={`mt-6 inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold ${GREEN}`}>
        {preview ? "Reset preview" : "Try another"}
      </button>
    </div>
  );
}
