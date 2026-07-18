// ============================================================================
// V4 TRAINING MODE — TrainingWizardPage (client component)
// ============================================================================
// The client mount for `/training/wizard`. Owns the full training
// session lifecycle:
//
//   1. Read URL params (session? lesson? activity? evaluator_key?
//      criterion_version?).
//   2. If `?session=` is missing, POST /api/activity-sessions/start with
//      the URL-supplied provenance, then router.replace() to include
//      the returned id.
//   3. If `?session=` is present, GET /api/activity-sessions/[id] to
//      verify it's active + not expired. On success, mount <WizardShell>
//      with a training store + training submit adapter + the training
//      banner.
//   4. Handle every failure path (unauthorized / not_found / expired /
//      revoked / network / missing params) with a specific screen.
//
// The wizard body itself is UNCHANGED — this page just wires it up. The
// only file it modifies is the URL query; no localStorage, no
// transaction rows, no attestation writes.
// ============================================================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import WizardShell from "../../workspace/new/WizardShell";
import type { UseWizardSessionConfig } from "../../workspace/new/useWizardSession";
import { stepHref as productionStepHref } from "../../workspace/new/wizard-steps";
import type { StepId } from "../../workspace/new/wizard-steps";

import TrainingBanner from "./TrainingBanner";
import {
  SessionApiError,
  getSession,
  startSession,
  type ActivitySession,
  type StartSessionInput,
} from "./session-api";
import { createTrainingSessionApiStore } from "./training-store";
import { createTrainingSubmitAdapter } from "./submit-adapter";
import type { StoreErrorCode } from "./session-store";

/** Where the training route lives. */
const TRAINING_BASE = "/training/wizard";
/** Where cancel + completion redirect to. */
const TRAINING_EXIT = "/training";

// ─── Loading + failure UI ─────────────────────────────────────────────────

function CenteredMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[540px] py-16 text-center">
      <h1 className="text-lg font-semibold text-[#F1F1F3]">{title}</h1>
      {detail && (
        <p className="mt-3 text-sm text-[#71717A]" role="status">
          {detail}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function FailureScreen({
  code,
  detail,
  onExit,
}: {
  code: StoreErrorCode | "missing_params";
  detail?: string;
  onExit: () => void;
}) {
  const title = ((): string => {
    switch (code) {
      case "session_expired":
        return "This training session has expired";
      case "session_not_found":
        return "Training session not found";
      case "session_not_active":
        return "Training session is no longer active";
      case "unauthorized":
        return "Please sign in";
      case "forbidden":
        return "You don't have access to this training session";
      case "network_error":
        return "Network error";
      case "missing_params":
        return "Missing training parameters";
      default:
        return "Something went wrong";
    }
  })();

  return (
    <CenteredMessage
      title={title}
      detail={detail}
      action={
        <button
          onClick={onExit}
          className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#F1F1F3] hover:bg-white/10"
        >
          Back to training
        </button>
      }
    />
  );
}

// ─── URL helpers ──────────────────────────────────────────────────────────

interface TrainingSearchParams {
  session: string | null;
  lesson: string | null;
  activity: string | null;
  evaluator_key: string | null;
  criterion_version: string | null;
  certification: string | null;
  version: string | null;
}

function readParams(
  searchParams: URLSearchParams | null,
): TrainingSearchParams {
  return {
    session: searchParams?.get("session") ?? null,
    lesson: searchParams?.get("lesson") ?? null,
    activity: searchParams?.get("activity") ?? null,
    evaluator_key: searchParams?.get("evaluator_key") ?? null,
    criterion_version: searchParams?.get("criterion_version") ?? null,
    certification:
      searchParams?.get("certification") ?? "hartfelt-platform-certified",
    version: searchParams?.get("version") ?? "1.0.0",
  };
}

function makeTrainingStepHref(sessionId: string) {
  return (step: StepId) => {
    // Reuse production step ids so the query flag is symmetric.
    const legacy = productionStepHref(step);
    const query = new URLSearchParams();
    query.set("session", sessionId);
    if (legacy.includes("?step=")) {
      query.set("step", step);
    }
    return `${TRAINING_BASE}?${query.toString()}`;
  };
}

// ─── Main page ────────────────────────────────────────────────────────────

type Phase =
  | { kind: "loading" }
  | { kind: "starting" }
  | { kind: "ready"; row: ActivitySession }
  | { kind: "failure"; code: StoreErrorCode | "missing_params"; detail?: string };

export default function TrainingWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => readParams(searchParams), [searchParams]);

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const goToTrainingIndex = useCallback(() => {
    router.push(TRAINING_EXIT);
  }, [router]);

  // Bootstrap: load-or-start the session.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (params.session) {
        // Existing session — try to load it.
        try {
          const row = await getSession(params.session);
          if (cancelled) return;
          if (row.status !== "active") {
            setPhase({
              kind: "failure",
              code:
                row.status === "expired"
                  ? "session_expired"
                  : "session_not_active",
              detail: `Session status is '${row.status}'.`,
            });
            return;
          }
          if (Date.parse(row.timestamps.expires_at) <= Date.now()) {
            setPhase({
              kind: "failure",
              code: "session_expired",
              detail: "Session deadline has passed.",
            });
            return;
          }
          setPhase({ kind: "ready", row });
        } catch (err) {
          if (cancelled) return;
          if (err instanceof SessionApiError) {
            setPhase({
              kind: "failure",
              code: err.code,
              detail: err.message,
            });
            return;
          }
          setPhase({
            kind: "failure",
            code: "unknown",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      // No session id — need to start one. Require the provenance params.
      if (
        !params.lesson ||
        !params.activity ||
        !params.evaluator_key ||
        !params.criterion_version ||
        !params.certification ||
        !params.version
      ) {
        setPhase({
          kind: "failure",
          code: "missing_params",
          detail:
            "This training URL is missing required parameters (lesson, activity, evaluator_key, criterion_version).",
        });
        return;
      }

      setPhase({ kind: "starting" });
      const input: StartSessionInput = {
        certification_id: params.certification,
        certification_version: params.version,
        lesson_id: params.lesson,
        activity_type: params.activity,
        evaluator_key: params.evaluator_key,
        criterion_version: params.criterion_version,
      };
      try {
        const started = await startSession(input);
        if (cancelled) return;
        // Replace URL so the newly-created session becomes resumable via
        // refresh + back / forward. This DOES NOT create a history
        // entry.
        const query = new URLSearchParams();
        query.set("session", started.id);
        router.replace(`${TRAINING_BASE}?${query.toString()}`);
        // Immediately fetch the full projection for the banner + timestamps.
        const row = await getSession(started.id);
        if (cancelled) return;
        setPhase({ kind: "ready", row });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SessionApiError) {
          setPhase({
            kind: "failure",
            code: err.code,
            detail: err.message,
          });
          return;
        }
        setPhase({
          kind: "failure",
          code: "unknown",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [
    params.session,
    params.lesson,
    params.activity,
    params.evaluator_key,
    params.criterion_version,
    params.certification,
    params.version,
    router,
  ]);

  if (phase.kind === "loading" || phase.kind === "starting") {
    return (
      <CenteredMessage
        title="Preparing training session…"
        detail="Loading your practice environment."
      />
    );
  }

  if (phase.kind === "failure") {
    return (
      <FailureScreen
        code={phase.code}
        detail={phase.detail}
        onExit={goToTrainingIndex}
      />
    );
  }

  // Ready — mount the wizard with the training store + adapter.
  const row = phase.row;
  const sessionId = row.id;
  const store = createTrainingSessionApiStore({ sessionId });
  const wizardConfig: UseWizardSessionConfig = {
    store,
    stepHref: makeTrainingStepHref(sessionId),
    exitHref: TRAINING_EXIT,
    onLoadError: (code, detail) => {
      // Rare — only fires if the API session vanishes mid-session.
      setPhase({ kind: "failure", code, detail });
    },
    onSaveError: (code) => {
      // Auto-expire only for expiry/not-active — other codes are
      // typically transient and surface via the save state indicator on
      // a future PR.
      if (code === "session_expired" || code === "session_not_active") {
        setPhase({
          kind: "failure",
          code,
          detail: "Your session ended while editing. Please start a new one.",
        });
      }
    },
  };
  const submitAdapter = createTrainingSubmitAdapter({
    sessionId,
    successHref: `${TRAINING_EXIT}?completed=1`,
  });
  const banner = (
    <TrainingBanner
      lessonId={row.provenance.lesson_id}
      activityType={row.provenance.activity_type}
      expiresAt={row.timestamps.expires_at}
      onExpired={() =>
        setPhase({
          kind: "failure",
          code: "session_expired",
          detail: "This training session has expired.",
        })
      }
    />
  );

  return (
    <WizardShell
      wizardConfig={wizardConfig}
      submitAdapter={submitAdapter}
      banner={banner}
    />
  );
}
