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

export function MatrixExperience() {
  const ring = useMatrixPractice();

  if (!matrixSimulatorEnabled()) {
    return (
      <div className={`${CARD} p-6`}>
        <h2 className="text-base font-semibold text-[#E6F5EC]">Matrix Simulator</h2>
        <p className="mt-2 text-sm text-[#9db3a6]">Practical MLS listing practice is coming soon.</p>
      </div>
    );
  }

  if (ring.phase === "idle") {
    return <EntryView onStart={() => void ring.enter()} />;
  }
  if (ring.phase === "preparing") {
    return <Centered><Loader2 className="h-5 w-5 animate-spin text-[#22c55e]" aria-hidden="true" /><p className="mt-3 text-sm text-[#9db3a6]">Loading your exercise…</p></Centered>;
  }
  if ((ring.phase === "editing" || ring.phase === "submitting") && ring.exercise) {
    return <ExerciseForm ring={ring} />;
  }
  if (ring.phase === "done" && ring.result) {
    return <ResultView ring={ring} />;
  }
  return (
    <Centered>
      <p className="text-sm text-[#E6F5EC]">{ring.error ?? "Something went wrong."}</p>
      <button type="button" onClick={() => void ring.enter()} className={`mt-4 inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold ${GREEN}`}>Try again</button>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className={`${CARD} flex flex-col items-center justify-center px-6 py-12 text-center`}>{children}</div>;
}

function EntryView({ onStart }: { onStart: () => void }) {
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#22c55e]/15 text-[#22c55e]">
          <Table2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[#E6F5EC]">Rental Listing Practical</h2>
          <p className="mt-1 text-sm text-[#9db3a6]">
            Complete a fictional residential-rental MLS listing: verify the AutoPop data, correct the
            prior agent&rsquo;s mistakes, and submit for Broker of Record review. Practice only — no live MLS.
          </p>
        </div>
      </div>
      <button type="button" onClick={onStart} className={`mt-5 inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold ${GREEN}`}>
        Start Exercise
      </button>
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
          <button
            type="button"
            onClick={() => void ring.saveDraft()}
            disabled={ring.saving || busy}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#1f3a2b] px-4 text-sm font-medium text-[#9db3a6] disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" /> {ring.saving ? "Saving…" : "Save Incomplete"}
          </button>
          <button type="submit" disabled={busy} className={`inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold disabled:opacity-60 ${GREEN}`}>
            <Send className="h-4 w-4" aria-hidden="true" /> {busy ? "Submitting…" : "Submit for Review"}
          </button>
          {ring.savedAt && !ring.saving && <span className="text-xs text-[#4ade80]">Draft saved</span>}
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
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-center gap-2">
        {r.passed
          ? <CheckCircle2 className="h-5 w-5 text-[#22c55e]" aria-hidden="true" />
          : <AlertTriangle className="h-5 w-5 text-[#eab308]" aria-hidden="true" />}
        <h2 className="text-lg font-semibold text-[#E6F5EC]">Submitted for review</h2>
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${r.passed ? GREEN_TEXT : "text-[#eab308]"}`}>{r.scorePct}%</p>
      <p className="mt-1 text-sm text-[#9db3a6]">
        {r.passed
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

      <button type="button" onClick={() => void ring.enter()} className={`mt-6 inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold ${GREEN}`}>
        Try another
      </button>
    </div>
  );
}
