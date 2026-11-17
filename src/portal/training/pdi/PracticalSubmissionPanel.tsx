"use client";

// ============================================================================
// PDI graded practical — learner submission panel
// ============================================================================
// Shows the broker-approved training parcels, the learner's past submissions
// and "n of 3". Grades and rubrics are never shown here: the Broker of Record
// grades in Vault. No deadline (broker direction).
// ============================================================================

import { useCallback, useEffect, useState } from "react";

import { CertApiError } from "../certified/api";
import {
  fetchPracticalSubmissions,
  submitPractical,
  type PracticalSubmissionState,
} from "./pdi-api";
import { PDI_STANDING_REMINDER } from "./pdi-config";

const MIN = 200;
const MAX = 60000;

export const SUBMIT_ERROR_COPY: Record<string, string> = {
  invalid_report: `Your report must be between ${MIN} and ${MAX.toLocaleString("en-US")} characters.`,
  invalid_parcel: "Choose one of the training parcels your broker approved.",
  assessment_not_passed: "Pass the course assessment before submitting the practical.",
  already_passed: "Your practical has already been approved — no further submission is needed.",
  submission_limit_reached: "You have used all 3 submissions for this version. Talk to your broker about coaching.",
  no_assignment: "This course is not assigned to you.",
};

export default function PracticalSubmissionPanel({ certificationId, lessonId }: { certificationId: string; lessonId: string }) {
  const [data, setData] = useState<PracticalSubmissionState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parcelId, setParcelId] = useState("");
  const [report, setReport] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchPracticalSubmissions(certificationId, lessonId));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof CertApiError && e.status === 403 ? SUBMIT_ERROR_COPY.no_assignment : "Could not load your practical.");
    }
  }, [certificationId, lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) return <p role="alert" className="text-sm text-rose-300">{loadError}</p>;
  if (!data) return <p className="text-sm text-[#A1A1AA]">Loading practical…</p>;

  const used = data.submissions.length;
  const remaining = data.max_submissions - used;
  const parcelLabel = (id: string) => {
    const p = data.approved_parcels.find((x) => x.id === id);
    return p ? `${p.county} · ${p.parcelReference}` : "parcel no longer listed";
  };

  return (
    <section aria-label="Graded practical submission" className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold text-[#F1F1F3]">Submit your practical report</h2>
      <p className="text-xs text-[#C9A84C] mt-1">{PDI_STANDING_REMINDER}</p>
      <p className="text-sm text-[#A1A1AA] mt-2">Submissions used: {used} of {data.max_submissions}</p>

      {data.submissions.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-[#A1A1AA]">
          {data.submissions.map((s) => (
            <li key={s.id}>
              Submission {s.submissionNumber} — {parcelLabel(s.trainingParcelId)} —{" "}
              {new Date(s.submittedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} — awaiting or graded by your broker
            </li>
          ))}
        </ul>
      )}

      {data.approved_parcels.length === 0 ? (
        <p className="mt-3 text-sm text-[#A1A1AA]">Your broker has not approved a training parcel yet. You can submit once one is approved.</p>
      ) : remaining <= 0 ? (
        <p className="mt-3 text-sm text-[#A1A1AA]">{SUBMIT_ERROR_COPY.submission_limit_reached}</p>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setMessage(null);
            try {
              await submitPractical(certificationId, lessonId, { training_parcel_id: parcelId, report_text: report });
              setMessage({ ok: true, text: "Submitted. Your broker will review it." });
              setReport("");
              await load();
            } catch (err) {
              const code = err instanceof CertApiError ? err.code : null;
              setMessage({ ok: false, text: (code && SUBMIT_ERROR_COPY[code]) || "Your report could not be submitted. Please try again." });
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block text-sm text-[#F1F1F3]">
            Training parcel
            <select
              aria-label="Training parcel"
              className="mt-1 block w-full rounded border border-white/15 bg-black/30 px-2 py-1"
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              required
            >
              <option value="">Choose an approved parcel…</option>
              {data.approved_parcels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.county} · {p.parcelReference}{p.label ? ` — ${p.label}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-[#F1F1F3]">
            Report
            <textarea
              aria-label="Practical report"
              className="mt-1 block w-full rounded border border-white/15 bg-black/30 px-2 py-1"
              rows={14}
              value={report}
              maxLength={MAX}
              onChange={(e) => setReport(e.target.value)}
            />
          </label>
          <p className="text-xs text-[#A1A1AA]">{report.length.toLocaleString("en-US")} characters (minimum {MIN})</p>
          <button
            type="submit"
            disabled={pending || !parcelId || report.trim().length < MIN}
            className="rounded bg-[#C9A84C] px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit for broker review"}
          </button>
        </form>
      )}
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</p>
      )}
    </section>
  );
}
