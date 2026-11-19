"use client";

// ============================================================================
// /training/property-intelligence — the three PDI courses
// ============================================================================
// Shows ONLY courses whose catalog Vault serves to this learner (a live
// assignment). A refused course (403 no_assignment, or any error) is hidden.
// PDI-1 and PDI-2 are assigned automatically (Broker policy). PDI-3 is optional:
// when it is not assigned, Vault says whether this learner may request it, and
// the card offers the request (Vault re-checks eligibility and prerequisites).
// With the flag off, no Vault call is made at all.
// ============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";

import { fetchCatalog } from "../certified/api";
import { fetchPdi3Availability, requestPdi3, type Pdi3Availability } from "./pdi-api";
import {
  PDI3_CERTIFICATION_ID,
  PDI_CATEGORY_LABEL,
  PDI_COURSES,
  PDI_STANDING_REMINDER,
  pdiCourseHref,
  pdiTrainingEnabled,
  type PdiCourseMeta,
} from "./pdi-config";

type State = { kind: "loading" } | { kind: "ready"; available: PdiCourseMeta[]; pdi3: Pdi3Availability | null };

export function NotYetAvailable() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center">
      <p className="text-[#F1F1F3] font-medium">Not yet available</p>
      <p className="text-sm text-[#A1A1AA] mt-1">PDI training is assigned automatically once your account is active and your licence is verified. Check back soon.</p>
    </div>
  );
}

export default function PdiLandingClient() {
  const enabled = pdiTrainingEnabled();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [reload, setReload] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void Promise.all([
      Promise.all(PDI_COURSES.map((c) => fetchCatalog(c.certificationId).then(() => c, () => null))),
      fetchPdi3Availability().catch(() => null),
    ]).then(([rows, pdi3]) => {
      if (alive) setState({ kind: "ready", available: rows.filter((c): c is PdiCourseMeta => c !== null), pdi3 });
    });
    return () => {
      alive = false;
    };
  }, [enabled, reload]);

  async function onRequestPdi3() {
    setRequesting(true);
    setRequestError(null);
    try {
      await requestPdi3();
      setReload((n) => n + 1);
    } catch {
      setRequestError("PDI-3 could not be requested. Please try again or contact your broker.");
    } finally {
      setRequesting(false);
    }
  }

  const pdi3Meta = PDI_COURSES.find((c) => c.certificationId === PDI3_CERTIFICATION_ID)!;
  const showPdi3Card =
    state.kind === "ready" &&
    state.available.length > 0 &&
    !state.available.some((c) => c.certificationId === PDI3_CERTIFICATION_ID) &&
    state.pdi3 !== null &&
    (state.pdi3.state === "available" || (state.pdi3.state === "locked" && state.pdi3.reason === "prerequisites"));

  return (
    <div className="max-w-[760px]">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-[#F1F1F3]">{PDI_CATEGORY_LABEL}</h1>
        <p className="text-sm text-[#A1A1AA] mt-1">{PDI_STANDING_REMINDER}</p>
      </header>
      {!enabled ? (
        <NotYetAvailable />
      ) : state.kind === "loading" ? (
        <p className="text-sm text-[#A1A1AA]">Loading your courses…</p>
      ) : state.available.length === 0 ? (
        <NotYetAvailable />
      ) : (
        <ul className="space-y-3">
          {state.available.map((c) => (
            <li key={c.certificationId}>
              <Link href={pdiCourseHref(c.certificationId)} className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#F1F1F3]">{c.code} · {c.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.requirement === "Optional" ? "bg-white/10 text-[#A1A1AA]" : "bg-[#C9A84C]/20 text-[#C9A84C]"}`}>
                    {c.requirement}
                  </span>
                </div>
                <p className="text-sm text-[#A1A1AA] mt-1">{c.summary}</p>
                {c.prerequisite ? <p className="text-xs text-[#A1A1AA] mt-1">{c.prerequisite}</p> : null}
              </Link>
            </li>
          ))}
          {showPdi3Card && state.kind === "ready" && state.pdi3 ? (
            <li>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#F1F1F3]">{pdi3Meta.code} · {pdi3Meta.title}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs bg-white/10 text-[#A1A1AA]">Optional</span>
                </div>
                <p className="text-sm text-[#A1A1AA] mt-1">{pdi3Meta.summary}</p>
                {state.pdi3.state === "available" ? (
                  <button
                    type="button"
                    onClick={onRequestPdi3}
                    disabled={requesting}
                    className="mt-3 rounded-md bg-[#C9A84C] px-3 py-2 text-sm font-semibold text-[#0A0A0A] hover:bg-[#D8B76A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C] disabled:opacity-50"
                  >
                    {requesting ? "Requesting…" : "Request PDI-3"}
                  </button>
                ) : (
                  <p className="text-xs text-[#A1A1AA] mt-2">Available to request after you complete PDI-1 and PDI-2.</p>
                )}
                {requestError ? <p role="alert" className="text-xs text-red-400 mt-2">{requestError}</p> : null}
              </div>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
