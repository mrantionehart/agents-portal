// ============================================================================
// COMM-1D — The learner's side of a voice practice call, as a pure machine
// ============================================================================
// Ported verbatim (shape + sequencing) from Vault's
// src/lib/simulation/learner/practice-call-machine.ts. The browser half of a
// Ring call CANNOT be reused cross-origin — it must live wherever the call runs
// — so the Agent Portal carries its own copy of the SEQUENCE only. Every piece
// of Ring DOMAIN logic (scenario, evaluator, coaching, transcript, citations)
// still lives in Vault and is reached through vault-ring-client; nothing here
// grades, scores, or decides anything.
//
// SEQUENCING IS THE WHOLE POINT:
//   Start → prepare → REQUEST MICROPHONE → granted → join → ephemeral token →
//   connect IMMEDIATELY (the token dies ~30s after creation).
//
// A learner who denies the microphone never reaches join, so there is no
// provider call, no binding, no spend and no consumed attempt — by construction,
// not by cleanup. A denied microphone and an unreachable provider are states of
// the machinery; neither is a failed practice or a consumed attempt, and neither
// is ever phrased as something the learner did.
// ============================================================================

export type PracticeCallState =
  | "ready"
  | "requesting_microphone"
  | "connecting"
  | "live"
  | "reconnecting"
  | "ended"
  | "provider_unavailable"
  | "microphone_denied";

/** States a learner can start from. Anything else means a call is in flight. */
const STARTABLE = new Set<PracticeCallState>([
  "ready",
  "ended",
  "provider_unavailable",
  "microphone_denied",
]);

/** What /practice/join returns and what connect() needs. accessToken is the only
 *  field every response has ever carried; the rest are RETELL V3 connection
 *  details — optional, pass-through, present only when the provider sent them. */
export interface CallConnectionMaterial {
  readonly accessToken: string;
  readonly transport?: "livekit" | "gateway";
  readonly callId?: string;
  readonly url?: string;
  readonly iceServers?: ReadonlyArray<{
    readonly urls: string | readonly string[];
    readonly username?: string;
    readonly credential?: string;
  }>;
}

export interface PracticeCallDeps {
  /** Ask the BROWSER for the microphone. Resolves true when granted.
   *  Deliberately first: everything after it costs money. */
  readonly requestMicrophone: () => Promise<boolean>;
  /** POST /api/simulation/practice/join. THE ONLY THING THAT SPENDS. */
  readonly join: (sessionId: string) => Promise<CallConnectionMaterial | null>;
  /** Hand the connection material to the provider SDK and connect. */
  readonly connect: (material: CallConnectionMaterial) => Promise<void>;
  readonly onState: (state: PracticeCallState) => void;
}

export interface StartResult {
  readonly state: PracticeCallState;
  /** True only when a provider call was actually requested. */
  readonly joinRequested: boolean;
}

/**
 * Run the start sequence. Returns the state it settled in rather than throwing,
 * because every failure here is a state the learner may see and retry from.
 */
export async function startPracticeCall(
  deps: PracticeCallDeps,
  args: { readonly sessionId: string; readonly from: PracticeCallState },
): Promise<StartResult> {
  if (!STARTABLE.has(args.from)) {
    // Already connecting or live. A second click is not a second call.
    return { state: args.from, joinRequested: false };
  }

  deps.onState("requesting_microphone");
  let granted: boolean;
  try {
    granted = await deps.requestMicrophone();
  } catch {
    granted = false;
  }
  if (!granted) {
    // STOP. No join, therefore no provider call, no binding, no spend.
    deps.onState("microphone_denied");
    return { state: "microphone_denied", joinRequested: false };
  }

  deps.onState("connecting");
  let material: CallConnectionMaterial | null;
  try {
    material = await deps.join(args.sessionId);
  } catch {
    material = null;
  }
  if (!material) {
    deps.onState("provider_unavailable");
    return { state: "provider_unavailable", joinRequested: true };
  }

  try {
    // IMMEDIATELY. The token is already ticking.
    await deps.connect(material);
  } catch {
    deps.onState("provider_unavailable");
    return { state: "provider_unavailable", joinRequested: true };
  }

  return { state: "connecting", joinRequested: true };
}

/** States the call has SETTLED in, from which the learner may start again. */
export function isRetryableCallState(state: PracticeCallState): boolean {
  return (
    state === "microphone_denied" || state === "provider_unavailable" || state === "ended"
  );
}

/** What the learner is told, per state. Read as a set: not one of these says the
 *  learner did something wrong, because not one of these states means they did. */
export const PRACTICE_CALL_COPY: Readonly<Record<PracticeCallState, string>> = {
  ready: "Ready when you are.",
  requesting_microphone: "Allow microphone access to begin.",
  connecting: "Connecting…",
  live: "Connected.",
  reconnecting: "Connection interrupted — reconnecting…",
  ended: "Call ended.",
  provider_unavailable:
    "The call service is unavailable right now. Nothing was recorded — try again in a moment.",
  microphone_denied:
    "Practice needs your microphone. Allow access in your browser, then start again.",
};
