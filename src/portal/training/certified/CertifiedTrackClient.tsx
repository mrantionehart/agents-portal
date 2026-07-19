// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Track detail client
// ============================================================================
// Renders one V4 track's ordered lesson list, with locked / unlocked /
// completed state driven from Vault's progress projection. Selecting a
// lesson navigates to the unified lesson page.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { CertApiError, fetchCatalog, fetchProgress } from "./api";
import type {
  CertifiedCatalog,
  CertifiedLesson,
  CertifiedModule,
  CertifiedProgress,
} from "./types";
import {
  findLessonProgress,
  findTrackProgressPct,
  isPrerequisiteUnlocked,
  lessonStatusLabel,
} from "./progress-helpers";

interface CertifiedTrackClientProps {
  trackId: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found"; message: string }
  | { kind: "error"; message: string; retry: () => void }
  | {
      kind: "loaded";
      catalog: CertifiedCatalog;
      progress: CertifiedProgress;
      track: CertifiedModule;
    };

export default function CertifiedTrackClient({
  trackId,
}: CertifiedTrackClientProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [catalog, progress] = await Promise.all([
        fetchCatalog(),
        fetchProgress(),
      ]);
      const track = catalog.tracks.find((t) => t.id === trackId);
      if (!track) {
        setState({ kind: "not_found", message: `Unknown track: ${trackId}` });
        return;
      }
      setState({ kind: "loaded", catalog, progress, track });
    } catch (e) {
      const msg =
        e instanceof CertApiError
          ? `${e.message} (HTTP ${e.status})`
          : e instanceof Error
          ? e.message
          : "Failed to load track.";
      setState({ kind: "error", message: msg, retry: () => void load() });
    }
  }, [trackId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading")
    return (
      <div className="max-w-[720px] mx-auto py-16 text-center text-sm text-[#71717A]">
        Loading track…
      </div>
    );

  if (state.kind === "not_found")
    return (
      <div className="max-w-[720px] mx-auto space-y-4">
        <Link
          href="/training"
          className="text-xs text-[#71717A] hover:text-[#F1F1F3]"
        >
          ← Back to Training
        </Link>
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {state.message}
        </div>
      </div>
    );

  if (state.kind === "error")
    return (
      <div className="max-w-[720px] mx-auto rounded border border-rose-500/30 bg-rose-500/10 p-5">
        <p className="text-sm text-rose-300">{state.message}</p>
        <button
          type="button"
          onClick={state.retry}
          className="mt-3 rounded border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30"
        >
          Retry
        </button>
      </div>
    );

  const { catalog, progress, track } = state;
  const trackPct = findTrackProgressPct(progress, trackId);

  return (
    <div className="max-w-[720px] mx-auto space-y-6">
      <div>
        <Link
          href="/training"
          className="text-xs text-[#71717A] hover:text-[#F1F1F3]"
        >
          ← Back to Training
        </Link>
      </div>
      <header>
        <div className="text-[11px] uppercase tracking-wide text-[#C9A84C]">
          {track.id}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-[#F1F1F3]">
          {track.title}
        </h1>
        {track.description && (
          <p className="mt-2 text-sm text-[#A1A1AA]">{track.description}</p>
        )}
        <div className="mt-4 flex items-center gap-3" data-cert-track-progress>
          <div className="flex-1">
            <div className="h-2 w-full overflow-hidden rounded bg-[#11111a]">
              <div
                className="h-full rounded bg-[#C9A84C] transition-all"
                style={{ width: `${trackPct}%` }}
                data-cert-track-progress-bar
              />
            </div>
          </div>
          <span className="text-xs text-[#A1A1AA]">{trackPct}%</span>
        </div>
      </header>

      <ol
        className="divide-y divide-[#1a1a2e] rounded-lg border border-[#1a1a2e] bg-[#0b0b10]"
        data-cert-lesson-list
      >
        {track.lessons.map((lesson) => (
          <TrackLessonRow
            key={lesson.id}
            trackId={trackId}
            lesson={lesson}
            catalog={catalog}
            progress={progress}
          />
        ))}
      </ol>
    </div>
  );
}

function TrackLessonRow({
  trackId,
  lesson,
  catalog,
  progress,
}: {
  trackId: string;
  lesson: CertifiedLesson;
  catalog: CertifiedCatalog;
  progress: CertifiedProgress;
}) {
  void catalog;
  const lp = findLessonProgress(progress, lesson.id);
  const unlocked = isPrerequisiteUnlocked(progress, lesson);
  const status = lp?.status ?? "not_started";
  const statusLabel = lessonStatusLabel(status);
  const href = `/training/certified/${encodeURIComponent(trackId)}/${encodeURIComponent(lesson.id)}`;

  const badgeCls =
    status === "completed"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : !unlocked
      ? "border-[#252538] bg-[#050507] text-[#71717A]"
      : "border-[#252538] bg-[#11111a] text-[#A1A1AA]";

  const Row = (
    <div
      className={`flex items-center justify-between gap-4 p-4 ${
        unlocked ? "hover:bg-[#11111a]" : "opacity-70"
      }`}
      data-cert-lesson-row={lesson.id}
    >
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-[#71717A]">
          {lesson.id}
        </div>
        <div className="mt-0.5 text-sm font-medium text-[#F1F1F3]">
          {lesson.title}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-[#71717A]">
          {lesson.requirements.map((r) => (
            <span
              key={r}
              className="rounded bg-[#050507] px-1.5 py-0.5"
              data-cert-lesson-requirement={r}
            >
              {r}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] ${badgeCls}`}
        >
          {unlocked ? statusLabel : "Locked"}
        </span>
      </div>
    </div>
  );

  return (
    <li>
      {unlocked ? (
        <Link href={href} className="block">
          {Row}
        </Link>
      ) : (
        <div>{Row}</div>
      )}
    </li>
  );
}
