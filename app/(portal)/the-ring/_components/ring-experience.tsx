// ============================================================================
// COMM-1C — RingExperience (Agent Portal)
// ============================================================================
// The learner-facing Ring conversation, reimplemented against the Portal design
// system. All logic lives in useTextPractice, which calls the existing Vault
// learner APIs. This component is presentation only: it renders each phase and
// wires buttons to the hook. No scoring, coaching, or scenario logic here.
//
// Two modes:
//   • practice   — the learner starts a developmental round (never certifies).
//   • assessment — enters a server-created mode='assessment' session; a banner
//                  marks it, the entry chooser is skipped, and pass/fail actions
//                  are supplied by the caller (the assessment page).
// ============================================================================

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Mic, MicOff, MessageSquare, Phone, PhoneOff, Send, Swords } from "lucide-react";

import { ACQUISITION_CERTIFICATION_ID } from "@/lib/ring/vault-ring-client";
import { useTextPractice } from "../_lib/use-text-practice";
import { useVoicePractice } from "../_lib/use-voice-practice";
import { voicePracticeEnabled } from "../_lib/ring-flags";
import { isRetryableCallState } from "../_lib/practice-call-machine";

export interface RingExperienceProps {
  readonly certificationId?: string;
  readonly assessment?: {
    readonly sessionId: string;
    readonly label: string;
    readonly onComplete?: () => void;
    readonly resultActions?: ReactNode;
  };
}

const CARD = "rounded-lg border border-[#1a1a2e] bg-[#11111a]";
const GOLD = "bg-[#C9A84C] text-[#0b0b10]";

type Channel = "text" | "voice";

/**
 * COMM-1D — the practice entry. With the voice flag OFF (default) or in
 * assessment mode, this is byte-for-byte the COMM-1C text experience: no
 * chooser, straight into text. With the voice flag ON and in practice mode, the
 * learner first picks a channel — Voice Call or Text Conversation — and the
 * matching experience runs. Certification assessment stays text-only in this
 * slice (voice-certification is a separate, later authorization).
 */
export function RingExperience({ certificationId = ACQUISITION_CERTIFICATION_ID, assessment }: RingExperienceProps) {
  const offerChooser = !assessment && voicePracticeEnabled();
  const [channel, setChannel] = useState<Channel | null>(offerChooser ? null : "text");

  if (channel === null) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <ChannelChooser onPick={setChannel} />
      </div>
    );
  }
  if (channel === "voice") {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <VoiceExperience certificationId={certificationId} onSwitchChannel={() => setChannel("text")} />
      </div>
    );
  }
  return <TextExperience certificationId={certificationId} assessment={assessment} />;
}

function ChannelChooser({ onPick }: { onPick: (c: Channel) => void }) {
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#C9A84C]/15 text-[#C9A84C]">
          <Swords className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[#F1F1F3]">Practice</h2>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            Choose how you want to practice this round. Coaching after every round, either way —
            practice sharpens your skills but never counts toward certification.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick("voice")}
          className={`${CARD} flex flex-col items-start gap-2 p-4 text-left transition hover:border-[#C9A84C]/60`}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#C9A84C]/15 text-[#C9A84C]">
            <Phone className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-[#F1F1F3]">Voice Call</span>
          <span className="text-xs leading-relaxed text-[#A1A1AA]">
            Speak with an AI seller in a live call. You&rsquo;ll be asked for your microphone.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onPick("text")}
          className={`${CARD} flex flex-col items-start gap-2 p-4 text-left transition hover:border-[#C9A84C]/60`}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#C9A84C]/15 text-[#C9A84C]">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-[#F1F1F3]">Text Conversation</span>
          <span className="text-xs leading-relaxed text-[#A1A1AA]">
            Type the conversation at your own pace. No microphone needed.
          </span>
        </button>
      </div>
    </div>
  );
}

function TextExperience({ certificationId = ACQUISITION_CERTIFICATION_ID, assessment }: RingExperienceProps) {
  const ring = useTextPractice(
    certificationId,
    assessment ? { initialSessionId: assessment.sessionId } : undefined,
  );
  const isAssessment = !!assessment;

  // Fire the caller's onComplete exactly once when grading lands.
  const firedComplete = useRef(false);
  useEffect(() => {
    if (ring.phase === "done" && isAssessment && !firedComplete.current) {
      firedComplete.current = true;
      assessment?.onComplete?.();
    }
  }, [ring.phase, isAssessment, assessment]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {isAssessment && (
        <div className="mb-4 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-2 text-sm font-medium text-[#E8D5A3]">
          Seller Lead Certification · Certification Assessment · {assessment!.label}
        </div>
      )}

      {(ring.phase === "idle" || ring.phase === "preparing") &&
        (isAssessment ? (
          <CenteredNote>
            <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C]" aria-hidden="true" />
            <p className="mt-3 text-sm text-[#A1A1AA]">Loading your certification assessment…</p>
          </CenteredNote>
        ) : (
          <EntryView busy={ring.phase === "preparing"} onStart={() => ring.enter(null)} />
        ))}

      {ring.phase === "briefing" && ring.session && (
        <BriefingView label={ring.session.scenarioLabel} onBegin={ring.begin} />
      )}

      {(ring.phase === "beginning" || ring.phase === "active" || ring.phase === "sending") && ring.session && (
        <ConversationView ring={ring} />
      )}

      {ring.phase === "analyzing" && <AnalyzingView longWait={ring.analysisLongWait} />}

      {ring.phase === "analysis_failed" && (
        <CenteredNote>
          <p className="text-sm text-[#F1F1F3]">We couldn&rsquo;t finish scoring this round.</p>
          <button
            type="button"
            onClick={ring.retryAnalysis}
            className={`mt-4 inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold ${GOLD}`}
          >
            Try again
          </button>
        </CenteredNote>
      )}

      {ring.phase === "done" && ring.coaching && (
        <ResultsView
          coaching={ring.coaching}
          heading={isAssessment ? "Certification assessment complete" : undefined}
          actions={isAssessment ? assessment!.resultActions : undefined}
          onRematch={isAssessment ? undefined : () => ring.enter(ring.session?.level ?? null)}
        />
      )}

      {ring.phase === "error" && (
        <CenteredNote>
          <p className="text-sm text-[#F1F1F3]">{ring.error}</p>
          {!isAssessment && (
            <button
              type="button"
              onClick={() => (ring.session ? ring.begin() : ring.enter(null))}
              className={`mt-4 inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold ${GOLD}`}
            >
              Try again
            </button>
          )}
        </CenteredNote>
      )}
    </div>
  );
}

function CenteredNote({ children }: { children: ReactNode }) {
  return <div className={`${CARD} flex flex-col items-center justify-center px-6 py-12 text-center`}>{children}</div>;
}

function EntryView({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#C9A84C]/15 text-[#C9A84C]">
          <Swords className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[#F1F1F3]">Practice</h2>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            Practice realistic seller conversations. Coaching after every round — practice sharpens
            your skills but never counts toward certification.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className={`mt-5 inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold disabled:opacity-60 ${GOLD}`}
      >
        {busy ? "Starting…" : "Start Practice"}
      </button>
    </div>
  );
}

function BriefingView({ label, onBegin }: { label: string; onBegin: () => void }) {
  return (
    <div className={`${CARD} p-6`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C9A84C]">Your scenario</p>
      <h2 className="mt-1 text-lg font-semibold text-[#F1F1F3]">{label}</h2>
      <p className="mt-2 text-sm text-[#A1A1AA]">
        You&rsquo;re about to speak with a prospective seller. Lead the conversation — ask, listen,
        and move toward the next step.
      </p>
      <button type="button" onClick={onBegin} className={`mt-5 inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold ${GOLD}`}>
        Enter The Ring
      </button>
    </div>
  );
}

function ConversationView({ ring }: { ring: ReturnType<typeof useTextPractice> }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const canEndRound = ring.messages.some((m) => m.role === "learner");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [ring.messages, ring.counterpartyTyping]);

  async function submit() {
    const text = draft;
    if (!text.trim() || ring.phase === "sending") return;
    setDraft("");
    const ok = await ring.send(text);
    if (!ok) setDraft(text); // restore draft on recoverable failure
  }

  return (
    <div className={`${CARD} flex h-[70vh] max-h-[640px] flex-col`}>
      <div className="border-b border-[#1a1a2e] px-4 py-3">
        <p className="text-sm font-medium text-[#F1F1F3]">{ring.session?.scenarioLabel}</p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {ring.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "learner" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "learner" ? "bg-[#C9A84C] text-[#0b0b10]" : "bg-[#1c1c28] text-[#E5E5E7]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {ring.counterpartyTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[#1c1c28] px-4 py-2 text-sm text-[#71717A]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            </div>
          </div>
        )}
        {ring.ended && (
          <p className="pt-2 text-center text-xs text-[#71717A]">The prospect has ended the conversation.</p>
        )}
      </div>
      {ring.sendError && (
        <p className="border-t border-[#1a1a2e] bg-[#1a1a12] px-4 py-2 text-xs text-[#eab308]">{ring.sendError}</p>
      )}
      <div className="border-t border-[#1a1a2e] p-3">
        {ring.ended ? (
          <button type="button" onClick={ring.complete} className={`inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-semibold ${GOLD}`}>
            End round &amp; see coaching
          </button>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                rows={2}
                placeholder="Type your reply…"
                className="min-h-[44px] flex-1 resize-none rounded-md border border-[#1a1a2e] bg-[#0a0a0f] px-3 py-2 text-sm text-[#F1F1F3] placeholder:text-[#52525b] focus:border-[#C9A84C] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!draft.trim() || ring.phase === "sending"}
                aria-label="Send"
                className={`inline-flex h-11 w-11 items-center justify-center rounded-md disabled:opacity-40 ${GOLD}`}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={ring.complete}
              disabled={!canEndRound}
              className="mt-2 text-xs text-[#71717A] hover:text-[#A1A1AA] disabled:opacity-40"
            >
              End round early
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AnalyzingView({ longWait }: { longWait: boolean }) {
  return (
    <CenteredNote>
      <span className="relative inline-flex h-10 w-10 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A84C]/40" />
        <span className="relative inline-flex h-6 w-6 rounded-full bg-[#C9A84C]" />
      </span>
      <p className="mt-4 text-sm text-[#F1F1F3]">Scoring your conversation…</p>
      {longWait && <p className="mt-1 text-xs text-[#71717A]">Still working — this one&rsquo;s taking a little longer.</p>}
    </CenteredNote>
  );
}

function CoachingSection({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C9A84C]">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed text-[#A1A1AA]">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultsView({
  coaching,
  heading,
  actions,
  onRematch,
}: {
  coaching: { strengths: string[]; improvements: string[]; missedOpportunities: string[]; coaching: string[] };
  heading?: string;
  actions?: ReactNode;
  onRematch?: () => void;
}) {
  return (
    <div className={`${CARD} p-6`}>
      <h2 className="text-lg font-semibold text-[#F1F1F3]">{heading ?? "Round complete"}</h2>
      <p className="mt-1 text-xs text-[#71717A]">Developmental coaching — no score.</p>
      <div className="mt-5 space-y-5">
        <CoachingSection title="What you did well" items={coaching.strengths} />
        <CoachingSection title="To improve" items={coaching.improvements} />
        <CoachingSection title="Missed opportunities" items={coaching.missedOpportunities} />
        <CoachingSection title="Coaching" items={coaching.coaching} />
      </div>
      <div className="mt-6 border-t border-[#1a1a2e] pt-5">
        {actions ?? (
          onRematch && (
            <button type="button" onClick={onRematch} className={`inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold ${GOLD}`}>
              Rematch
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Voice (COMM-1D) ───────────────────────────────────────────────────────────
// Presentation only. useVoicePractice owns the flow and reaches the existing
// Vault voice routes; this renders each phase and reuses ResultsView for the
// SAME coaching the text channel shows.

function VoiceExperience({
  certificationId,
  onSwitchChannel,
}: {
  certificationId: string;
  onSwitchChannel: () => void;
}) {
  const ring = useVoicePractice(certificationId);

  if (ring.phase === "idle") {
    return <VoiceEntryView onStart={() => void ring.enter(null)} onSwitchChannel={onSwitchChannel} />;
  }
  if (ring.phase === "preparing") {
    return (
      <CenteredNote>
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C]" aria-hidden="true" />
        <p className="mt-3 text-sm text-[#A1A1AA]">Setting up your call…</p>
      </CenteredNote>
    );
  }
  if (ring.phase === "briefing" && ring.session) {
    return (
      <div className={`${CARD} p-6`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C9A84C]">Your scenario</p>
        <h2 className="mt-1 text-lg font-semibold text-[#F1F1F3]">{ring.session.scenarioLabel}</h2>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          You&rsquo;re about to speak with a prospective seller. When you start, your browser will ask
          for microphone access — allow it to begin the call.
        </p>
        <button
          type="button"
          onClick={ring.startCall}
          className={`mt-5 inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold ${GOLD}`}
        >
          <Phone className="h-4 w-4" aria-hidden="true" /> Start Call
        </button>
      </div>
    );
  }
  if (ring.phase === "in_call" && ring.session) {
    return <VoiceCallView ring={ring} />;
  }
  if (ring.phase === "analyzing") {
    return <AnalyzingView longWait={ring.analysisLongWait} />;
  }
  if (ring.phase === "analysis_failed") {
    return (
      <CenteredNote>
        <p className="text-sm text-[#F1F1F3]">We couldn&rsquo;t finish scoring this call.</p>
        <button
          type="button"
          onClick={() => void ring.retryAnalysis()}
          className={`mt-4 inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold ${GOLD}`}
        >
          Try again
        </button>
      </CenteredNote>
    );
  }
  if (ring.phase === "done" && ring.coaching) {
    return (
      <div className="space-y-4">
        <ResultsView
          coaching={ring.coaching}
          onRematch={() => void ring.enter(ring.session?.level ?? null)}
        />
        {ring.transcript && ring.transcript.turns.length > 0 && (
          <VoiceTranscriptView transcript={ring.transcript} />
        )}
      </div>
    );
  }
  // error
  return (
    <CenteredNote>
      <p className="text-sm text-[#F1F1F3]">{ring.error ?? "Something went wrong."}</p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void ring.enter(null)}
          className={`inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold ${GOLD}`}
        >
          Try again
        </button>
        <button type="button" onClick={onSwitchChannel} className="text-xs text-[#71717A] hover:text-[#A1A1AA]">
          Use text instead
        </button>
      </div>
    </CenteredNote>
  );
}

function VoiceEntryView({ onStart, onSwitchChannel }: { onStart: () => void; onSwitchChannel: () => void }) {
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#C9A84C]/15 text-[#C9A84C]">
          <Phone className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[#F1F1F3]">Voice Call Practice</h2>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            A live spoken conversation with an AI seller. Coaching after the call — practice never
            counts toward certification.
          </p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className={`inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold ${GOLD}`}
        >
          <Phone className="h-4 w-4" aria-hidden="true" /> Start Voice Practice
        </button>
        <button type="button" onClick={onSwitchChannel} className="text-xs text-[#71717A] hover:text-[#A1A1AA]">
          Use text instead
        </button>
      </div>
    </div>
  );
}

function VoiceCallView({ ring }: { ring: ReturnType<typeof useVoicePractice> }) {
  const live = ring.callState === "live";
  const settled = isRetryableCallState(ring.callState); // ended / provider_unavailable / microphone_denied
  const mm = String(Math.floor(ring.elapsedSeconds / 60)).padStart(2, "0");
  const ss = String(ring.elapsedSeconds % 60).padStart(2, "0");

  return (
    <div className={`${CARD} flex min-h-[60vh] flex-col items-center justify-center p-8 text-center`}>
      <p className="text-sm font-medium text-[#F1F1F3]">{ring.session?.scenarioLabel}</p>

      <div className="my-8 flex flex-col items-center">
        <span className="relative inline-flex h-20 w-20 items-center justify-center">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A84C]/30" />}
          <span
            className={`relative inline-flex h-16 w-16 items-center justify-center rounded-full ${
              live ? "bg-[#C9A84C] text-[#0b0b10]" : "bg-[#1c1c28] text-[#A1A1AA]"
            }`}
          >
            <Phone className="h-6 w-6" aria-hidden="true" />
          </span>
        </span>
        {live && <p className="mt-4 font-mono text-lg tabular-nums text-[#F1F1F3]">{mm}:{ss}</p>}
        <p className="mt-2 text-sm text-[#A1A1AA]">{ring.callCopy}</p>
      </div>

      {live && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={ring.toggleMute}
            aria-label={ring.muted ? "Unmute" : "Mute"}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#1a1a2e] ${
              ring.muted ? "bg-[#1c1c28] text-[#eab308]" : "bg-[#11111a] text-[#A1A1AA]"
            }`}
          >
            {ring.muted ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={ring.hangUp}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#b91c1c] px-5 text-sm font-semibold text-white"
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" /> End Call
          </button>
        </div>
      )}

      {ring.callState === "ended" && (
        <button
          type="button"
          onClick={() => void ring.complete()}
          className={`inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold ${GOLD}`}
        >
          See coaching
        </button>
      )}

      {settled && ring.callState !== "ended" && (
        <button
          type="button"
          onClick={ring.startCall}
          className={`mt-2 inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold ${GOLD}`}
        >
          Try again
        </button>
      )}
    </div>
  );
}

function VoiceTranscriptView({
  transcript,
}: {
  transcript: { turns: Array<{ idx: number; role: string; content: string }> };
}) {
  return (
    <div className={`${CARD} p-6`}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C9A84C]">Call transcript</h3>
      <div className="mt-3 space-y-3">
        {transcript.turns.map((t) => (
          <div key={t.idx} className={`flex ${t.role === "learner" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                t.role === "learner" ? "bg-[#C9A84C] text-[#0b0b10]" : "bg-[#1c1c28] text-[#E5E5E7]"
              }`}
            >
              {t.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
