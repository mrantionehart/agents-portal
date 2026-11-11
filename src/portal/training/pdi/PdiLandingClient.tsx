"use client";

// ============================================================================
// /training/property-intelligence — the three PDI courses
// ============================================================================
// Shows ONLY courses whose catalog Vault serves to this learner (a live
// assignment). A refused course (403 no_assignment, or any error) is hidden.
// With the flag off, no Vault call is made at all.
// ============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";

import { fetchCatalog } from "../certified/api";
import {
  PDI_CATEGORY_LABEL,
  PDI_COURSES,
  PDI_STANDING_REMINDER,
  pdiCourseHref,
  pdiTrainingEnabled,
  type PdiCourseMeta,
} from "./pdi-config";

type State = { kind: "loading" } | { kind: "ready"; available: PdiCourseMeta[] };

export function NotYetAvailable() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center">
      <p className="text-[#F1F1F3] font-medium">Not yet available</p>
      <p className="text-sm text-[#A1A1AA] mt-1">Your broker assigns this training. Check back once you have been assigned.</p>
    </div>
  );
}

export default function PdiLandingClient() {
  const enabled = pdiTrainingEnabled();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void Promise.all(
      PDI_COURSES.map((c) => fetchCatalog(c.certificationId).then(() => c, () => null)),
    ).then((rows) => {
      if (alive) setState({ kind: "ready", available: rows.filter((c): c is PdiCourseMeta => c !== null) });
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

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
        </ul>
      )}
    </div>
  );
}
