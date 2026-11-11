"use client";

// /training/property-intelligence/[cert]/[lessonId] — a PDI lesson.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { CertApiError } from "../certified/api";
import { ContentBlocks } from "./ContentBlocks";
import { NotYetAvailable } from "./PdiLandingClient";
import PracticalSubmissionPanel from "./PracticalSubmissionPanel";
import { acknowledgeLesson, fetchLessonContent, type LessonContentResponse } from "./pdi-api";
import { pdiCourse, pdiCourseHref, pdiTrainingEnabled } from "./pdi-config";

type State =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string }
  | { kind: "ready"; content: LessonContentResponse };

export default function PdiLessonClient({ certificationId, lessonId }: { certificationId: string; lessonId: string }) {
  const course = pdiCourse(certificationId);
  const enabled = pdiTrainingEnabled();
  const isPractical = course?.practicalLessonId === lessonId;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [ack, setAck] = useState<"idle" | "pending" | "done" | "error">("idle");

  const load = useCallback(async () => {
    try {
      setState({ kind: "ready", content: await fetchLessonContent(certificationId, lessonId) });
    } catch (e) {
      if (e instanceof CertApiError && (e.status === 403 || e.status === 404)) setState({ kind: "unavailable" });
      else setState({ kind: "error", message: e instanceof Error ? e.message : "Failed to load lesson." });
    }
  }, [certificationId, lessonId]);

  useEffect(() => {
    if (!enabled || !course || isPractical) return;
    void load();
  }, [enabled, course, isPractical, load]);

  if (!enabled || !course) return <NotYetAvailable />;

  const back = (
    <Link href={pdiCourseHref(certificationId)} className="text-xs text-[#A1A1AA] underline">← {course.code} lessons</Link>
  );

  if (isPractical) {
    return (
      <div className="max-w-[760px]">
        {back}
        <h1 className="text-2xl font-semibold text-[#F1F1F3] mt-2">Graded practical</h1>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Research your broker-approved training parcel using official public sources only, complete the course worksheets, and submit your report. The Broker of Record grades it.
        </p>
        <PracticalSubmissionPanel certificationId={certificationId} lessonId={lessonId} />
      </div>
    );
  }
  if (state.kind === "unavailable") return <NotYetAvailable />;
  if (state.kind === "loading") return <p className="text-sm text-[#A1A1AA]">Loading lesson…</p>;
  if (state.kind === "error") return <p role="alert" className="text-sm text-rose-300">{state.message}</p>;

  const { content } = state;
  const needsAck = content.requirements.includes("acknowledgement");
  return (
    <article className="max-w-[760px]">
      {back}
      <h1 className="text-2xl font-semibold text-[#F1F1F3] mt-2">{content.title}</h1>
      <p className="text-sm text-[#A1A1AA] mt-1 mb-4">{content.objective}</p>
      <ContentBlocks blocks={content.blocks} />
      {needsAck && (
        <div className="mt-6">
          <button
            type="button"
            disabled={ack === "pending" || ack === "done"}
            className="rounded bg-[#C9A84C] px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
            onClick={async () => {
              setAck("pending");
              try {
                await acknowledgeLesson(certificationId, lessonId);
                setAck("done");
              } catch {
                setAck("error");
              }
            }}
          >
            {ack === "done" ? "Marked complete" : "I have read this lesson"}
          </button>
          {ack === "error" && <p role="alert" className="mt-2 text-sm text-rose-300">Could not record completion. Finish the previous lesson first, then try again.</p>}
        </div>
      )}
    </article>
  );
}
