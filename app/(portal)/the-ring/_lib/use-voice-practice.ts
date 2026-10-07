"use client";

// ============================================================================
// COMM-1D — useVoicePractice (Agent Portal)
// ============================================================================
// The learner-facing VOICE practice flow, as a hook. Mirrors useTextPractice in
// shape, but the conversation is a live Retell web call instead of typed turns.
// All domain logic stays in Vault: this hook only PREPAREs a session, drives the
// browser call sequence (mic → join → connect), then asks Vault to COMPLETE and
// grade it, and renders the SAME coaching Vault returns. No scoring/scenario/
// evaluator logic lives here.
//
// Channel is practice-only (mode='practice' server-side) — never certification.
// The browser call sequence is the pure machine in ./practice-call-machine; the
// Retell Web SDK is imported dynamically so it never enters the server bundle.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ACQUISITION_CERTIFICATION_ID,
  RingApiError,
  completeVoice,
  getVoiceResult,
  getVoiceTranscript,
  joinVoice,
  prepareVoice,
  type Coaching,
  type RingLevel,
  type VoiceTranscript,
} from "@/lib/ring/vault-ring-client";
import {
  PRACTICE_CALL_COPY,
  startPracticeCall,
  type CallConnectionMaterial,
  type PracticeCallState,
} from "./practice-call-machine";

export type VoicePhase =
  | "idle"
  | "preparing"
  | "briefing"
  | "in_call"
  | "analyzing"
  | "analysis_failed"
  | "done"
  | "error";

export interface VoiceSession {
  sessionId: string;
  scenarioLabel: string;
  level: RingLevel | null;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";
const UNAVAILABLE = "Voice practice isn’t available yet.";
const ANALYSIS_LONG_WAIT_MS = 12_000;

/** Learner-safe copy for a prepare/complete failure. A dark route (notEnabled)
 *  reads as "not available yet"; an expired Ring entitlement is named plainly
 *  (COMM-1C's generic-"something went wrong" gap, fixed from the start here);
 *  everything else is the neutral generic. Never leaks a status code. */
function messageForError(err: unknown): string {
  if (err instanceof RingApiError) {
    if (err.notEnabled) return UNAVAILABLE;
    if (err.code === "trial_expired") {
      return "Your Ring access has expired. Contact your broker to continue practicing.";
    }
  }
  return GENERIC_ERROR;
}

interface RetellLike {
  startCall(opts: CallConnectionMaterial): Promise<void>;
  stopCall(): void;
  mute?(): void;
  unmute?(): void;
  on(event: string, handler: (payload?: unknown) => void): void;
  removeAllListeners?(): void;
}

export interface VoicePractice {
  readonly phase: VoicePhase;
  readonly callState: PracticeCallState;
  readonly callCopy: string;
  readonly session: VoiceSession | null;
  readonly elapsedSeconds: number;
  readonly muted: boolean;
  readonly coaching: Coaching | null;
  readonly transcript: VoiceTranscript | null;
  readonly error: string | null;
  readonly analysisLongWait: boolean;
  readonly enter: (level: RingLevel | null) => Promise<void>;
  readonly startCall: () => void;
  readonly hangUp: () => void;
  readonly toggleMute: () => void;
  readonly complete: () => Promise<void>;
  readonly retryAnalysis: () => Promise<void>;
}

export function useVoicePractice(
  certificationId: string = ACQUISITION_CERTIFICATION_ID,
): VoicePractice {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [callState, setCallState] = useState<PracticeCallState>("ready");
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [elapsedSeconds, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [coaching, setCoaching] = useState<Coaching | null>(null);
  const [transcript, setTranscript] = useState<VoiceTranscript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisLongWait, setAnalysisLongWait] = useState(false);

  const clientRef = useRef<RetellLike | null>(null);
  const callStateRef = useRef<PracticeCallState>("ready");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const moveCall = useCallback((next: PracticeCallState) => {
    callStateRef.current = next;
    setCallState(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clientRef.current?.stopCall();
      if (pollTimer.current) clearTimeout(pollTimer.current);
      if (longWaitTimer.current) clearTimeout(longWaitTimer.current);
    };
  }, []);

  // Elapsed time runs only while the call is live, and resets otherwise — a
  // learner is never shown a timer for a call that is not happening.
  useEffect(() => {
    if (callState !== "live") {
      if (callState === "ended" || callState === "ready") setElapsed(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1_000);
    return () => clearInterval(t);
  }, [callState]);

  const enter = useCallback(
    async (level: RingLevel | null) => {
      setError(null);
      setCoaching(null);
      setTranscript(null);
      moveCall("ready");
      setPhase("preparing");
      try {
        const prepared = await prepareVoice(certificationId, level);
        if (!mounted.current) return;
        setSession({
          sessionId: prepared.sessionId,
          scenarioLabel: prepared.scenarioLabel,
          level: (prepared.level ?? null) as RingLevel | null,
        });
        setPhase("briefing");
      } catch (err) {
        if (!mounted.current) return;
        setError(messageForError(err));
        setPhase("error");
      }
    },
    [certificationId, moveCall],
  );

  const startCall = useCallback(() => {
    const current = session;
    if (!current) return;
    setPhase("in_call");
    void startPracticeCall(
      {
        // FIRST, and on the click, so the browser accepts it as a gesture.
        async requestMicrophone() {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Release it immediately — the SDK opens its own. This was only ever a
          // permission question, asked before anything could cost money.
          stream.getTracks().forEach((t) => t.stop());
          return true;
        },
        async join(id) {
          const material = await joinVoice(certificationId, id);
          return {
            accessToken: material.accessToken,
            ...(material.transport ? { transport: material.transport } : {}),
            ...(material.callId ? { callId: material.callId } : {}),
            ...(material.url ? { url: material.url } : {}),
            ...(material.iceServers ? { iceServers: material.iceServers } : {}),
          };
        },
        async connect(material) {
          const { RetellWebClient } = await import("retell-client-js-sdk");
          const client = new RetellWebClient() as unknown as RetellLike;
          clientRef.current = client;
          client.on("call_started", () => moveCall("live"));
          client.on("call_ready", () => moveCall("live"));
          client.on("call_ended", () => moveCall("ended"));
          client.on("error", () => {
            // A transport error is infrastructure. It ends the call; it does not
            // grade it.
            moveCall("provider_unavailable");
            client.stopCall();
          });
          await client.startCall(material);
        },
        onState: moveCall,
      },
      { sessionId: current.sessionId, from: callStateRef.current },
    );
  }, [session, certificationId, moveCall]);

  const hangUp = useCallback(() => {
    clientRef.current?.stopCall();
    moveCall("ended");
  }, [moveCall]);

  const toggleMute = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    setMuted((was) => {
      if (was) c.unmute?.();
      else c.mute?.();
      return !was;
    });
  }, []);

  const poll = useCallback(
    async (sessionId: string) => {
      try {
        const res = await getVoiceResult(certificationId, sessionId);
        if (!mounted.current) return;
        if (res.status === "ready") {
          if (longWaitTimer.current) clearTimeout(longWaitTimer.current);
          setCoaching(res.coaching);
          setPhase("done");
          // Transcript is best-effort — coaching is the result; a missing
          // transcript never blocks or fails the round.
          getVoiceTranscript(certificationId, sessionId)
            .then((t) => mounted.current && setTranscript(t))
            .catch(() => {});
          return;
        }
        if (res.status === "failed") {
          if (longWaitTimer.current) clearTimeout(longWaitTimer.current);
          setPhase("analysis_failed");
          return;
        }
        pollTimer.current = setTimeout(() => void poll(sessionId), res.pollAfterMs);
      } catch {
        if (!mounted.current) return;
        if (longWaitTimer.current) clearTimeout(longWaitTimer.current);
        setPhase("analysis_failed");
      }
    },
    [certificationId],
  );

  const complete = useCallback(
    async (retry = false) => {
      const current = session;
      if (!current) return;
      clientRef.current?.stopCall();
      setPhase("analyzing");
      setAnalysisLongWait(false);
      if (longWaitTimer.current) clearTimeout(longWaitTimer.current);
      longWaitTimer.current = setTimeout(
        () => mounted.current && setAnalysisLongWait(true),
        ANALYSIS_LONG_WAIT_MS,
      );
      try {
        const res = await completeVoice(certificationId, current.sessionId, retry);
        if (!mounted.current) return;
        if (res.status === "ready") {
          if (longWaitTimer.current) clearTimeout(longWaitTimer.current);
          setCoaching(res.coaching);
          setPhase("done");
          getVoiceTranscript(certificationId, current.sessionId)
            .then((t) => mounted.current && setTranscript(t))
            .catch(() => {});
          return;
        }
        if (res.status === "failed") {
          if (longWaitTimer.current) clearTimeout(longWaitTimer.current);
          setPhase("analysis_failed");
          return;
        }
        pollTimer.current = setTimeout(() => void poll(current.sessionId), res.pollAfterMs);
      } catch (err) {
        if (!mounted.current) return;
        if (longWaitTimer.current) clearTimeout(longWaitTimer.current);
        // A dark/forbidden complete is an error state, not a silent failure.
        setError(messageForError(err));
        setPhase("error");
      }
    },
    [session, certificationId, poll],
  );

  const retryAnalysis = useCallback(() => complete(true), [complete]);

  return {
    phase,
    callState,
    callCopy: PRACTICE_CALL_COPY[callState],
    session,
    elapsedSeconds,
    muted,
    coaching,
    transcript,
    error,
    analysisLongWait,
    enter,
    startCall,
    hangUp,
    toggleMute,
    complete: () => complete(false),
    retryAnalysis,
  };
}
