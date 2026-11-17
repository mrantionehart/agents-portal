"use client";

// /training/property-intelligence/[cert] — one PDI course's lesson ladder.
import { useEffect, useState } from "react";
import Link from "next/link";

import { CertApiError, fetchCatalog, fetchProgress } from "../certified/api";
import { findLessonProgress, lessonStatusLabel } from "../certified/progress-helpers";
import type { CertifiedCatalog, CertifiedProgress } from "../certified/types";
import { NotYetAvailable } from "./PdiLandingClient";
import { pdiCourse, pdiLessonHref, pdiQuizHref, pdiTrainingEnabled } from "./pdi-config";

type State =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string }
  | { kind: "ready"; catalog: CertifiedCatalog; progress: CertifiedProgress };

export default function PdiCourseClient({ certificationId }: { certificationId: string }) {
  const course = pdiCourse(certificationId);
  const enabled = pdiTrainingEnabled();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!enabled || !course) return;
    let alive = true;
    Promise.all([fetchCatalog(certificationId), fetchProgress(certificationId)]).then(
      ([catalog, progress]) => alive && setState({ kind: "ready", catalog, progress }),
      (e) => {
        if (!alive) return;
        if (e instanceof CertApiError && (e.status === 403 || e.status === 404)) setState({ kind: "unavailable" });
        else setState({ kind: "error", message: e instanceof Error ? e.message : "Failed to load course." });
      },
    );
    return () => {
      alive = false;
    };
  }, [enabled, course, certificationId]);

  if (!enabled || !course || state.kind === "unavailable") return <NotYetAvailable />;
  if (state.kind === "loading") return <p className="text-sm text-[#A1A1AA]">Loading course…</p>;
  if (state.kind === "error") return <p role="alert" className="text-sm text-rose-300">{state.message}</p>;

  const lessons = state.catalog.tracks.flatMap((t) => t.lessons);
  return (
    <div className="max-w-[760px]">
      <Link href="/training/property-intelligence" className="text-xs text-[#A1A1AA] underline">← All PDI courses</Link>
      <h1 className="text-2xl font-semibold text-[#F1F1F3] mt-2">{course.code} · {course.title}</h1>
      <p className="text-sm text-[#A1A1AA] mt-1">{course.requirement}{course.prerequisite ? ` — ${course.prerequisite}` : ""}</p>
      <ol className="mt-4 space-y-2">
        {lessons.map((l) => {
          const p = findLessonProgress(state.progress, l.id);
          const href = l.requires_quiz ? pdiQuizHref(certificationId, l.id) : pdiLessonHref(certificationId, l.id);
          return (
            <li key={l.id}>
              <Link href={href} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">
                <span className="text-sm text-[#F1F1F3]">{l.title}</span>
                <span className="text-xs text-[#A1A1AA]">{lessonStatusLabel(p?.status ?? "not_started")}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
