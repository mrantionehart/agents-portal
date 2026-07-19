// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Checklist reflection page client (Gate B)
// ============================================================================
// Session lifecycle for the 14 Family B checklist lessons:
//   1. First arrival with ?lesson=<id>&activity=scenario&evaluator_key=<k>&criterion_version=<v>
//      → POST /api/activity-sessions/start
//      → replace URL with ?session=<id>
//   2. Subsequent arrivals with ?session=<id>
//      → GET session
//      → render UI hydrated from `state.completed_steps` + `state.reflections`
//   3. Learner toggles step checkboxes → PATCH session `completed_steps`
//   4. Learner types reflection → local state; PATCH on blur or Save
//   5. Submit → POST session complete → back to lesson page
//
// The AP holds only ephemeral UI state. Every write goes through Vault.
// Every server-side outcome (session_missing_step, session_invalid_state,
// session_criterion_malformed, expired/revoked/completed) is surfaced with
// a specific message per SessionApiError.code.
// ============================================================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  CertApiError,
  fetchCatalog,
} from "@/src/portal/training/certified/api";
import {
  SessionApiError,
  completeSession,
  getSession,
  patchSession,
  startSession,
  type ActivitySession,
} from "@/src/portal/training/wizard/session-api";
import type {
  CertifiedCatalog,
  CertifiedLesson,
  LessonSessionUiSpec,
} from "../types";
import { HARTFELT_PLATFORM_CERTIFIED_ID } from "../types";

const HARTFELT_PLATFORM_CERTIFIED_VERSION = "1.0.0";

// ─── State machine ────────────────────────────────────────────────────────

type PhaseState =
  | { kind: "loading" }
  | { kind: "starting" }
  | { kind: "error"; message: string; code?: string | null; retry?: () => void }
  | { kind: "invalid_params"; message: string }
  | {
      kind: "active";
      session: ActivitySession;
      lesson: CertifiedLesson;
      spec: LessonSessionUiSpec;
      catalog: CertifiedCatalog;
    }
  | {
      kind: "completed";
      lesson: CertifiedLesson;
      returnHref: string;
    };

interface StartParams {
  lessonId: string;
  activityType: string;
  evaluatorKey: string;
  criterionVersion: string;
  certificationId: string;
  certificationVersion: string;
}

function parseParams(
  q: URLSearchParams,
):
  | { kind: "resume"; sessionId: string }
  | { kind: "start"; params: StartParams }
  | { kind: "invalid"; message: string } {
  const sessionId = q.get("session");
  if (sessionId) return { kind: "resume", sessionId };
  const lessonId = q.get("lesson");
  const activityType = q.get("activity");
  const evaluatorKey = q.get("evaluator_key");
  const criterionVersion = q.get("criterion_version");
  if (!lessonId || !activityType || !evaluatorKey || !criterionVersion) {
    return {
      kind: "invalid",
      message:
        "This link is missing required parameters. Reopen the checklist from your lesson page.",
    };
  }
  const certificationId = q.get("certification") ?? HARTFELT_PLATFORM_CERTIFIED_ID;
  const certificationVersion = q.get("version") ?? HARTFELT_PLATFORM_CERTIFIED_VERSION;
  return {
    kind: "start",
    params: {
      lessonId,
      activityType,
      evaluatorKey,
      criterionVersion,
      certificationId,
      certificationVersion,
    },
  };
}

// Lookup a lesson + its session_ui_spec from a Vault catalog.
function findLessonBrief(
  catalog: CertifiedCatalog,
  lessonId: string,
): { lesson: CertifiedLesson; spec: LessonSessionUiSpec; trackId: string } | null {
  for (const track of catalog.tracks) {
    for (const lesson of track.lessons) {
      if (lesson.id === lessonId && lesson.session_ui_spec) {
        return { lesson, spec: lesson.session_ui_spec, trackId: track.id };
      }
    }
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ChecklistPageClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [phase, setPhase] = useState<PhaseState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const bootstrap = useCallback(async () => {
    const q = new URLSearchParams(search?.toString() ?? "");
    const parsed = parseParams(q);
    if (parsed.kind === "invalid") {
      setPhase({ kind: "invalid_params", message: parsed.message });
      return;
    }
    try {
      const catalog = await fetchCatalog();
      if (parsed.kind === "resume") {
        const session = await getSession(parsed.sessionId);
        if (session.status === "completed") {
          const brief = findLessonBrief(catalog, session.provenance.lesson_id);
          setPhase({
            kind: "completed",
            lesson: brief?.lesson ?? synthLesson(session.provenance.lesson_id),
            returnHref: brief
              ? `/training/certified/${brief.trackId}/${brief.lesson.id}`
              : "/training",
          });
          return;
        }
        const brief = findLessonBrief(catalog, session.provenance.lesson_id);
        if (!brief) {
          setPhase({
            kind: "error",
            message: `Lesson ${session.provenance.lesson_id} is missing a checklist configuration on Vault.`,
          });
          return;
        }
        setPhase({ kind: "active", session, lesson: brief.lesson, spec: brief.spec, catalog });
        return;
      }
      // start path
      const brief = findLessonBrief(catalog, parsed.params.lessonId);
      if (!brief) {
        setPhase({
          kind: "error",
          message: `Lesson ${parsed.params.lessonId} either does not exist or does not have a checklist activity configured.`,
        });
        return;
      }
      setPhase({ kind: "starting" });
      const started = await startSession({
        certification_id: parsed.params.certificationId,
        certification_version: parsed.params.certificationVersion,
        lesson_id: parsed.params.lessonId,
        activity_type: parsed.params.activityType,
        evaluator_key: parsed.params.evaluatorKey,
        criterion_version: parsed.params.criterionVersion,
        state: { reflections: {} },
      });
      // Fetch the newly-created session to get the full ActivitySession shape.
      const session = await getSession(started.id);
      const newQ = new URLSearchParams();
      newQ.set("session", started.id);
      router.replace(`/training/checklist?${newQ.toString()}`);
      setPhase({ kind: "active", session, lesson: brief.lesson, spec: brief.spec, catalog });
    } catch (e) {
      const err = classifyError(e);
      setPhase({ kind: "error", message: err.message, code: err.code, retry: () => void bootstrap() });
    }
  }, [router, search]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (phase.kind === "loading" || phase.kind === "starting") {
    return (
      <div className="max-w-[640px] mx-auto py-16 text-center text-sm text-[#71717A]">
        {phase.kind === "loading" ? "Loading checklist…" : "Starting your training session…"}
      </div>
    );
  }
  if (phase.kind === "invalid_params") {
    return (
      <FullPageMessage
        title="Missing parameters"
        message={phase.message}
        homeHref="/training"
      />
    );
  }
  if (phase.kind === "error") {
    return (
      <div className="max-w-[640px] mx-auto space-y-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-5">
        <p className="text-sm text-rose-200">{phase.message}</p>
        {phase.code && (
          <p className="text-[11px] text-rose-300/70">Code: {phase.code}</p>
        )}
        {phase.retry && (
          <button
            type="button"
            onClick={phase.retry}
            className="rounded border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30"
          >
            Retry
          </button>
        )}
        <Link
          href="/training"
          className="inline-block text-xs text-rose-100/70 underline"
        >
          Back to Training
        </Link>
      </div>
    );
  }
  if (phase.kind === "completed") {
    return (
      <FullPageMessage
        title="Checklist submitted"
        message="Your training session was recorded. You can return to the lesson."
        homeHref={phase.returnHref}
        homeLabel="Back to lesson"
      />
    );
  }

  return (
    <ActiveChecklist
      phase={phase}
      busy={busy}
      setBusy={setBusy}
      onSessionUpdate={(nextSession) =>
        setPhase({ ...phase, session: nextSession })
      }
      onCompleted={(returnHref) =>
        setPhase({ kind: "completed", lesson: phase.lesson, returnHref })
      }
    />
  );
}

// ─── Active checklist UI ──────────────────────────────────────────────────

function ActiveChecklist({
  phase,
  busy,
  setBusy,
  onSessionUpdate,
  onCompleted,
}: {
  phase: Extract<PhaseState, { kind: "active" }>;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onSessionUpdate: (s: ActivitySession) => void;
  onCompleted: (returnHref: string) => void;
}) {
  const { session, lesson, spec, catalog } = phase;
  const trackId = useMemo(() => {
    for (const t of catalog.tracks) {
      if (t.lessons.some((l) => l.id === lesson.id)) return t.id;
    }
    return null;
  }, [catalog, lesson.id]);

  const [reflections, setReflections] = useState<Record<string, string>>(() => {
    const raw = (session.state as { reflections?: unknown }).reflections;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
    return {};
  });
  const [error, setError] = useState<{ message: string; code?: string | null } | null>(null);

  const completedSteps = useMemo(
    () => new Set<string>(session.completed_steps ?? []),
    [session.completed_steps],
  );

  const isStepDone = (step: string) => completedSteps.has(step);

  const reflectionOk = (step: string) => {
    if (!spec.requires_reflection) return true;
    const text = (reflections[step] ?? "").trim();
    return text.length >= spec.minimum_reflection_length;
  };

  const stepReady = (step: string) => {
    return isStepDone(step) && reflectionOk(step);
  };

  const allStepsReady = spec.required_steps.every(stepReady);

  const toggleStep = useCallback(
    async (step: string, checked: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const nextSet = new Set(session.completed_steps ?? []);
        if (checked) nextSet.add(step);
        else nextSet.delete(step);
        const nextSession = await patchSession(session.id, {
          completed_steps: Array.from(nextSet),
        });
        onSessionUpdate(nextSession);
      } catch (e) {
        const err = classifyError(e);
        setError(err);
      } finally {
        setBusy(false);
      }
    },
    [session.id, session.completed_steps, onSessionUpdate, setBusy],
  );

  const persistReflections = useCallback(
    async (next: Record<string, string>) => {
      setBusy(true);
      setError(null);
      try {
        const nextSession = await patchSession(session.id, {
          state: { ...session.state, reflections: next },
        });
        onSessionUpdate(nextSession);
      } catch (e) {
        const err = classifyError(e);
        setError(err);
      } finally {
        setBusy(false);
      }
    },
    [session.id, session.state, onSessionUpdate, setBusy],
  );

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Persist final reflections first so server-side validation reads
      // the most recent typed text.
      if (spec.requires_reflection) {
        await patchSession(session.id, {
          state: { ...session.state, reflections },
        });
      }
      await completeSession(session.id);
      const href = trackId
        ? `/training/certified/${trackId}/${lesson.id}`
        : "/training";
      onCompleted(href);
    } catch (e) {
      const err = classifyError(e);
      setError(err);
    } finally {
      setBusy(false);
    }
  }, [
    session.id,
    session.state,
    spec.requires_reflection,
    reflections,
    trackId,
    lesson.id,
    onCompleted,
    setBusy,
  ]);

  const backHref = trackId
    ? `/training/certified/${trackId}/${lesson.id}`
    : "/training";

  return (
    <div className="max-w-[640px] mx-auto space-y-5" data-cert-checklist-active>
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="text-xs text-[#71717A] hover:text-[#F1F1F3]"
        >
          ← Back to lesson
        </Link>
        <span
          className="rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#C9A84C]"
          data-cert-training-mode-banner
        >
          Training session
        </span>
      </div>
      <header>
        <div className="text-[11px] uppercase tracking-wide text-[#C9A84C]">
          {lesson.id}
        </div>
        <h1 className="mt-1 text-xl font-semibold text-[#F1F1F3]">
          {lesson.title}
        </h1>
        <p className="mt-1 text-xs text-[#A1A1AA]">
          Nothing you enter here changes real data. Reflection text stays on
          the session record — it is never included on your certification
          history.
        </p>
      </header>

      <ol className="space-y-3" data-cert-checklist-steps>
        {spec.required_steps.map((step, idx) => (
          <li
            key={step}
            className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-4"
            data-cert-checklist-step={step}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={isStepDone(step)}
                disabled={busy}
                onChange={(e) => void toggleStep(step, e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#C9A84C]"
                data-cert-checklist-step-checkbox={step}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[#71717A]">Step {idx + 1}</div>
                <div className="text-sm font-medium text-[#F1F1F3]">{step}</div>
              </div>
            </label>
            {spec.requires_reflection && (
              <div className="mt-3">
                <label
                  htmlFor={`refl-${step}`}
                  className="mb-1 block text-[11px] uppercase tracking-wide text-[#71717A]"
                >
                  Reflection ({spec.minimum_reflection_length}+ characters)
                </label>
                <textarea
                  id={`refl-${step}`}
                  className="w-full rounded border border-[#1a1a2e] bg-[#050507] p-2 text-sm text-[#F1F1F3] focus:border-[#C9A84C]/60 focus:outline-none"
                  rows={3}
                  value={reflections[step] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setReflections((prev) => ({ ...prev, [step]: e.target.value }))
                  }
                  onBlur={() => void persistReflections(reflections)}
                  data-cert-checklist-reflection={step}
                />
                <div className="mt-1 text-[10px] text-[#71717A]">
                  {(reflections[step] ?? "").trim().length} /{" "}
                  {spec.minimum_reflection_length} characters
                  {reflectionOk(step) ? " ✓" : ""}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      {error && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200" role="alert">
          {error.message}
          {error.code && (
            <span className="ml-2 text-rose-300/70">({error.code})</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !allStepsReady}
          className="rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f] disabled:cursor-not-allowed disabled:opacity-60"
          data-cert-checklist-submit
        >
          {busy ? "Submitting…" : "Submit checklist"}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function classifyError(e: unknown): { message: string; code?: string | null } {
  if (e instanceof SessionApiError) {
    // Prefer the raw server-provided code (`apiCode`) — it distinguishes
    // criterion / step / reflection failures that the store's 7-value enum
    // collapses to "session_not_active" or "unknown".
    const apiCode = e.apiCode;
    if (apiCode) {
      switch (apiCode) {
        case "session_not_found":
          return { message: "This training session doesn't belong to you or no longer exists.", code: apiCode };
        case "session_expired":
        case "expired":
          return { message: "This training session expired. Start a new one from the lesson page.", code: apiCode };
        case "session_revoked":
        case "revoked":
          return { message: "This training session was revoked. Start a new one from the lesson page.", code: apiCode };
        case "session_completed":
        case "already_completed":
          return { message: "This session is already submitted.", code: apiCode };
        case "session_missing_step":
          return { message: "Some required steps aren't marked complete yet.", code: apiCode };
        case "session_invalid_state":
          return { message: "One or more reflections don't meet the minimum length.", code: apiCode };
        case "session_criterion_malformed":
        case "session_criterion_unsupported":
        case "session_validator_unavailable":
        case "session_criterion_version_mismatch":
          return { message: "This lesson's checklist criterion is misconfigured on the server.", code: apiCode };
        case "active_session_exists":
          return { message: "You already have an active session for this lesson. Return to the lesson page and continue that one.", code: apiCode };
      }
    }
    // Fall back to the classified enum for auth / network / unknown paths.
    switch (e.code) {
      case "unauthorized":
        return { message: "You need to sign in again.", code: e.code };
      case "forbidden":
        return { message: "You're not allowed to modify this session.", code: e.code };
      case "network_error":
        return { message: "Network error contacting the training service.", code: e.code };
      default:
        return { message: e.message || "Session action failed.", code: apiCode ?? e.code };
    }
  }
  if (e instanceof CertApiError) {
    return { message: e.message, code: e.code };
  }
  if (e instanceof Error) return { message: e.message };
  return { message: "Unknown error." };
}

function synthLesson(lessonId: string): CertifiedLesson {
  return {
    id: lessonId,
    module_id: "",
    video_num: "",
    sort_order: 0,
    title: lessonId,
    description: null,
    objective_md: null,
    duration_seconds: null,
    practical_attestation_type: "attest",
    requires_quiz: false,
    quiz_id: null,
    related_route: null,
    prerequisite_lesson_id: null,
    media_status: "ok",
    has_media: false,
    system: "portal",
    requirements: [],
    session_ui_spec: null,
    practical_ui_spec: null,
  };
}

function FullPageMessage({
  title,
  message,
  homeHref,
  homeLabel,
}: {
  title: string;
  message: string;
  homeHref: string;
  homeLabel?: string;
}) {
  return (
    <div className="max-w-[560px] mx-auto py-20 text-center">
      <h1 className="text-lg font-semibold text-[#F1F1F3]">{title}</h1>
      <p className="mt-2 text-sm text-[#A1A1AA]">{message}</p>
      <Link
        href={homeHref}
        className="mt-6 inline-block rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f]"
      >
        {homeLabel ?? "Continue"}
      </Link>
    </div>
  );
}
