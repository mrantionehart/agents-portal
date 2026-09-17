// ============================================================================
// COMM-1C — useTextPractice (Agent Portal port)
// ============================================================================
// A faithful port of Vault's text-practice state machine. All grading, scoring,
// scenario selection, and session lifecycle stay server-side in Vault; this hook
// only orchestrates the existing learner API calls and holds view state. The
// browser persists ONLY the session id (in sessionStorage), never any evidence.
//
// Assessment mode: pass opts.initialSessionId to enter a server-pre-created
// mode='assessment' session (created by /start-assessment). The hook never sets
// mode — Vault stamped it at creation; a spoofed id simply fails closed at Vault.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ACQUISITION_CERTIFICATION_ID,
  beginText,
  completeText,
  getTextResult,
  getTextState,
  prepareText,
  RingApiError,
  sendTurn,
  type Coaching,
  type RingLevel,
} from "@/lib/ring/vault-ring-client";

export type RingPhase =
  | "idle"
  | "preparing"
  | "briefing"
  | "beginning"
  | "active"
  | "sending"
  | "analyzing"
  | "analysis_failed"
  | "done"
  | "error";

export interface RingMessage {
  id: number;
  role: "counterparty" | "learner";
  content: string;
}
export interface RingSession {
  sessionId: string;
  scenarioLabel: string;
  attemptNumber?: number;
  level?: RingLevel | null;
}

export interface UseTextPractice {
  phase: RingPhase;
  session: RingSession | null;
  messages: RingMessage[];
  counterpartyTyping: boolean;
  ended: boolean;
  coaching: Coaching | null;
  analysisLongWait: boolean;
  error: string | null;
  sendError: string | null;
  enter: (level?: RingLevel | null) => void;
  begin: () => void;
  send: (text: string) => Promise<boolean>;
  complete: () => void;
  retryAnalysis: () => void;
  reset: () => void;
}

const SESSION_EXPIRED_MESSAGE = "Your session expired. Sign in again — your progress is saved.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

// Learner-safe copy for recoverable turn errors.
const REFUSAL_COPY: Record<string, string> = {
  model_failure: "The prospect didn't respond. Try sending that again.",
  superseded: "This round was updated in another tab. We refreshed it for you.",
  turn_limit_reached: "You've reached the end of this conversation. End the round to see coaching.",
  empty_message: "Type a message before sending.",
};

const RECOVERABLE_TURN_CODES = new Set(["model_failure", "superseded", "turn_limit_reached"]);

// Polling cadence (ms) — mirrors Vault.
const POLL_FIRST = 1500;
const POLL_STEADY = 2500;
const POLL_EASED = 5000;
const POLL_EASE_AFTER = 40000;
const LONG_WAIT_AFTER = 25000;

function storageKeyFor(certificationId: string, discriminator?: string): string {
  const base = `ring:text:session:${certificationId}`;
  return discriminator ? `${base}:${discriminator}` : base;
}
function readStoredSessionId(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function storeSessionId(key: string, id: string): void {
  try {
    window.sessionStorage.setItem(key, id);
  } catch {
    /* private mode — non-fatal */
  }
}
function clearStoredSessionId(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
}

function messageCopyForError(err: unknown): string {
  if (err instanceof RingApiError) {
    if (err.status === 401) return SESSION_EXPIRED_MESSAGE;
    if (err.code && REFUSAL_COPY[err.code]) return REFUSAL_COPY[err.code];
  }
  return GENERIC_ERROR;
}

export function useTextPractice(
  certificationId: string = ACQUISITION_CERTIFICATION_ID,
  opts?: { readonly initialSessionId?: string },
): UseTextPractice {
  const isAssessment = !!opts?.initialSessionId;
  const storageKey = storageKeyFor(certificationId, isAssessment ? "assessment" : undefined);

  const [phase, setPhase] = useState<RingPhase>("idle");
  const [session, setSession] = useState<RingSession | null>(null);
  const [messages, setMessages] = useState<RingMessage[]>([]);
  const [counterpartyTyping, setTyping] = useState(false);
  const [ended, setEnded] = useState(false);
  const [coaching, setCoaching] = useState<Coaching | null>(null);
  const [analysisLongWait, setLongWait] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const msgId = useRef(0);
  const inFlight = useRef(false);
  const pollingSession = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzeStartedAt = useRef(0);

  const nextId = () => (msgId.current += 1);

  const appendMessage = useCallback((role: "counterparty" | "learner", content: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role, content }]);
  }, []);

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("error");
    setTyping(false);
  }, []);

  const clearPollTimer = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const settleReady = useCallback(
    (c: Coaching) => {
      clearPollTimer();
      pollingSession.current = null;
      setCoaching(c);
      setPhase("done");
      setTyping(false);
      clearStoredSessionId(storageKey);
    },
    [storageKey],
  );

  const pollResult = useCallback(
    async (sessionId: string) => {
      if (pollingSession.current !== sessionId) return; // stale guard
      try {
        const r = await getTextResult(certificationId, sessionId);
        if (pollingSession.current !== sessionId) return;
        if (r.status === "ready") {
          settleReady(r.coaching);
        } else if (r.status === "failed") {
          clearPollTimer();
          pollingSession.current = null;
          setPhase("analysis_failed");
        } else {
          const elapsed = Date.now() - analyzeStartedAt.current;
          if (elapsed > LONG_WAIT_AFTER) setLongWait(true);
          const delay =
            elapsed > POLL_EASE_AFTER ? POLL_EASED : r.pollAfterMs || POLL_STEADY;
          pollTimer.current = setTimeout(() => void pollResult(sessionId), delay);
        }
      } catch (err) {
        if (err instanceof RingApiError && err.status === 404) {
          clearPollTimer();
          pollingSession.current = null;
          fail(GENERIC_ERROR);
          return;
        }
        // Network blip — grading is safe server-side; keep polling.
        if (pollingSession.current === sessionId) {
          pollTimer.current = setTimeout(() => void pollResult(sessionId), POLL_STEADY);
        }
      }
    },
    [certificationId, settleReady, fail],
  );

  const beginAnalyzing = useCallback(
    (sessionId: string, pollAfterMs: number) => {
      pollingSession.current = sessionId;
      analyzeStartedAt.current = Date.now();
      setLongWait(false);
      setPhase("analyzing");
      clearPollTimer();
      pollTimer.current = setTimeout(() => void pollResult(sessionId), pollAfterMs || POLL_FIRST);
    },
    [pollResult],
  );

  const startCompletion = useCallback(
    async (sessionId: string, options?: { retry?: boolean }) => {
      setPhase("analyzing");
      analyzeStartedAt.current = Date.now();
      setLongWait(false);
      try {
        const r = await completeText(certificationId, sessionId, options?.retry ?? false);
        if (r.status === "ready") {
          settleReady(r.coaching);
        } else if (r.status === "failed") {
          setPhase("analysis_failed");
        } else {
          beginAnalyzing(sessionId, r.pollAfterMs);
        }
      } catch (err) {
        fail(messageCopyForError(err));
      }
    },
    [certificationId, settleReady, beginAnalyzing, fail],
  );

  const resyncFromServer = useCallback(
    async (sessionId: string) => {
      try {
        const s = await getTextState(certificationId, sessionId);
        setMessages(
          s.messages.map((m) => ({ id: nextId(), role: m.role, content: m.content })),
        );
        setEnded(s.ended);
        if (s.sealed) {
          void startCompletion(sessionId);
        } else {
          setPhase("active");
        }
      } catch {
        /* leave state as-is; the learner can retry the turn */
      }
    },
    [certificationId, startCompletion],
  );

  // ── Public actions ─────────────────────────────────────────────────────────

  const enter = useCallback(
    async (level: RingLevel | null = null) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setError(null);
      setSendError(null);
      setCoaching(null);
      setMessages([]);
      setEnded(false);
      setPhase("preparing");
      try {
        const r = await prepareText(certificationId, level);
        storeSessionId(storageKey, r.sessionId);
        setSession({
          sessionId: r.sessionId,
          scenarioLabel: r.scenarioLabel,
          attemptNumber: r.attemptNumber,
          level: (r.level as RingLevel | null) ?? null,
        });
        setPhase("briefing");
      } catch (err) {
        if (err instanceof RingApiError && err.notEnabled) {
          fail("Text practice isn't available right now.");
        } else {
          fail(messageCopyForError(err));
        }
      } finally {
        inFlight.current = false;
      }
    },
    [certificationId, storageKey, fail],
  );

  const begin = useCallback(async () => {
    if (!session) return;
    setPhase("beginning");
    setTyping(true);
    try {
      const r = await beginText(certificationId, session.sessionId);
      // On a fresh begin, seed the opening message. On a resumed begin the
      // transcript is already present, so don't double-append.
      setMessages((prev) => (prev.length === 0 ? [{ id: nextId(), role: "counterparty", content: r.openingMessage }] : prev));
      setPhase("active");
    } catch (err) {
      fail(messageCopyForError(err));
    } finally {
      setTyping(false);
    }
  }, [certificationId, session, fail]);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (!session) return false;
      const trimmed = text.trim();
      if (!trimmed) {
        setSendError(REFUSAL_COPY.empty_message);
        return false;
      }
      setSendError(null);
      const optimistic: RingMessage = { id: nextId(), role: "learner", content: trimmed };
      setMessages((prev) => [...prev, optimistic]);
      setTyping(true);
      setPhase("sending");
      try {
        const r = await sendTurn(certificationId, session.sessionId, trimmed);
        appendMessage("counterparty", r.counterpartyMessage);
        setEnded(r.ended);
        setPhase("active");
        return true;
      } catch (err) {
        // Roll back the optimistic learner bubble.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        if (err instanceof RingApiError && err.code && RECOVERABLE_TURN_CODES.has(err.code)) {
          setSendError(REFUSAL_COPY[err.code] ?? GENERIC_ERROR);
          if (err.code === "turn_limit_reached") setEnded(true);
          if (err.code === "superseded") void resyncFromServer(session.sessionId);
          setPhase("active");
          return false;
        }
        fail(messageCopyForError(err));
        return false;
      } finally {
        setTyping(false);
      }
    },
    [certificationId, session, appendMessage, resyncFromServer, fail],
  );

  const complete = useCallback(() => {
    if (!session) return;
    void startCompletion(session.sessionId);
  }, [session, startCompletion]);

  const retryAnalysis = useCallback(() => {
    if (!session) return;
    void startCompletion(session.sessionId, { retry: true });
  }, [session, startCompletion]);

  const reset = useCallback(() => {
    clearPollTimer();
    pollingSession.current = null;
    clearStoredSessionId(storageKey);
    setSession(null);
    setMessages([]);
    setCoaching(null);
    setEnded(false);
    setError(null);
    setSendError(null);
    setLongWait(false);
    setPhase("idle");
  }, [storageKey]);

  // ── Resume on mount (and when an assessment session id arrives) ──────────────
  useEffect(() => {
    let cancelled = false;
    const stored = opts?.initialSessionId ?? readStoredSessionId(storageKey);
    if (!stored) return;
    if (opts?.initialSessionId) storeSessionId(storageKey, opts.initialSessionId);
    (async () => {
      try {
        const s = await getTextState(certificationId, stored);
        if (cancelled) return;
        setSession({
          sessionId: s.sessionId,
          scenarioLabel: s.scenarioLabel,
          level: (s.level as RingLevel | null) ?? null,
        });
        setMessages(s.messages.map((m) => ({ id: nextId(), role: m.role, content: m.content })));
        setEnded(s.ended);
        if (s.sealed) {
          void startCompletion(stored); // refresh-during-analysis path (idempotent)
        } else if (s.status === "active") {
          setPhase("active");
        } else {
          setPhase("briefing");
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof RingApiError && err.status === 404) {
          clearStoredSessionId(storageKey);
          // An assessment session that 404s is unknown/not-owned — fail closed.
          if (opts?.initialSessionId) fail("This assessment isn't available.");
        }
        // else: leave idle; the entry view lets the learner start fresh.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.initialSessionId]);

  // Cleanup timers on unmount.
  useEffect(() => () => clearPollTimer(), []);

  return {
    phase,
    session,
    messages,
    counterpartyTyping,
    ended,
    coaching,
    analysisLongWait,
    error,
    sendError,
    enter,
    begin,
    send,
    complete,
    retryAnalysis,
    reset,
  };
}
