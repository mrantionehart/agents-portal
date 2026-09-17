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
import { Loader2, Send, Swords } from "lucide-react";

import { ACQUISITION_CERTIFICATION_ID } from "@/lib/ring/vault-ring-client";
import { useTextPractice } from "../_lib/use-text-practice";

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

export function RingExperience({ certificationId = ACQUISITION_CERTIFICATION_ID, assessment }: RingExperienceProps) {
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
