// ============================================================================
// TRANSACTION ASSISTANT 4.0D — Workspace AI panel (grounded)
// ============================================================================
// Thin client over the Vault 4.0C grounded assistant endpoint
//   POST /api/platform/transactions/[id]/assistant
// (replaces the legacy streaming chat call). It renders the grounded envelope —
// answer, confidence, warnings, collapsible evidence, sources, navigation-only
// suggested actions, and a review-only draft card.
//
// Guarantees:
//   • Auth via the lock-free getAccessToken() helper — never the lock-based
//     session read that can hang on the navigator LockManager.
//   • Plain-text rendering only — React escapes everything. No markdown, no
//     HTML, no raw JSON context, no internal terminology.
//   • Conversation is memory-only (refresh clears it). No persistence.
//   • ?prompt= is auto-sent exactly once, then stripped from the URL so a
//     refresh never resends and history navigation stays clean.
//   • Suggested actions ONLY navigate. Drafts are review-only. Nothing here
//     can send, email, notify, approve, or execute an action.
// ============================================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";

import { askAssistant } from "./ai/assistant-api";
import type {
  AssistantEnvelope,
  AssistantMessage,
  AssistantSuggestedAction,
} from "./ai/assistant-types";
import {
  confidenceLabel,
  confidenceTone,
  friendlySource,
  isNavigableTab,
  tabHref,
  type Tone,
} from "./ai/assistant-view";
import AssistantDraftCard from "./ai/AssistantDraftCard";

const INTRO =
  "I know this transaction's full status. Ask me what to do next, why something's blocked, or who we're waiting on. I can also draft a message for you to review — I never send anything.";

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  muted: "bg-white/[0.04] text-[#A1A1AA] border-white/[0.08]",
};

export interface AIAssistantPanelProps {
  transactionId: string;
  /** From ?prompt= — auto-sent exactly once on mount, then stripped. */
  initialPrompt?: string | null;
  // ── injectables (tests) ──
  fetchImpl?: typeof fetch;
  getToken?: () => Promise<string | null>;
  timeoutMs?: number;
  writeClipboard?: (text: string) => Promise<void>;
}

/** Build the memory-only history sent to the server (answers only, no meta). */
function buildHistory(messages: AssistantMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant" && m.kind === "answer") out.push({ role: "assistant", content: m.envelope.answer });
  }
  return out;
}

export default function AIAssistantPanel({
  transactionId,
  initialPrompt,
  fetchImpl,
  getToken,
  timeoutMs,
  writeClipboard,
}: AIAssistantPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: "assistant", kind: "intro", content: INTRO },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const autoSentRef = useRef(false);

  async function send(raw: string) {
    const msg = raw.trim();
    if (!msg || busyRef.current) return; // re-entrancy guard → no duplicate requests
    busyRef.current = true;
    setBusy(true);

    const history = buildHistory(messages);
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");

    const result = await askAssistant({ transactionId, message: msg, history, fetchImpl, getToken, timeoutMs });

    setMessages((m) => [
      ...m,
      result.ok
        ? { role: "assistant", kind: "answer", envelope: result.envelope }
        : { role: "assistant", kind: "error", error: result.error },
    ]);
    busyRef.current = false;
    setBusy(false);
  }

  // Auto-send the chip prompt exactly once, then strip ?prompt= from the URL
  // (history.replaceState — no server round-trip, no state loss) so a refresh
  // never resends and back/forward stays clean.
  useEffect(() => {
    const p = (initialPrompt ?? "").trim();
    if (!p || autoSentRef.current) return;
    autoSentRef.current = true;
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", `/workspace/${transactionId}?tab=ai`);
    }
    void send(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, transactionId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div
      id="ai-assistant"
      data-testid="assistant-panel"
      className="rounded-lg border border-[#1a1a2e] bg-[#11111a] flex flex-col h-[560px]"
    >
      <header className="px-4 py-3 border-b border-[#1a1a2e] flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#C9A84C]" />
        <span className="text-sm font-medium text-[#F1F1F3]">Transaction Assistant</span>
        <span className="ml-auto text-[10px] tracking-wider uppercase text-[#71717A]">this transaction</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div
                key={i}
                data-testid="msg-user"
                className="ml-8 rounded-md bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-3 py-2 text-[#E8D5A3] whitespace-pre-wrap"
              >
                {m.content}
              </div>
            );
          }
          if (m.kind === "intro") {
            return (
              <div key={i} className="mr-8 rounded-md bg-[#0b0b10] border border-[#1a1a2e] px-3 py-2 text-[#A1A1AA] whitespace-pre-wrap">
                {m.content}
              </div>
            );
          }
          if (m.kind === "error") {
            return (
              <div
                key={i}
                data-testid="msg-error"
                role="alert"
                className="mr-8 rounded-md bg-rose-900/20 border border-rose-700/40 px-3 py-2 text-rose-200 inline-flex items-start gap-2"
              >
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="whitespace-pre-wrap">{m.error.message}</span>
              </div>
            );
          }
          return <AnswerBlock key={i} envelope={m.envelope} transactionId={transactionId} router={router} writeClipboard={writeClipboard} />;
        })}

        {busy && (
          <div data-testid="assistant-busy" className="mr-8 rounded-md bg-[#0b0b10] border border-[#1a1a2e] px-3 py-2 text-[#71717A] inline-flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-[#1a1a2e] p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Ask about this transaction…"
          data-testid="assistant-input"
          className="flex-1 rounded-md bg-[#0b0b10] border border-[#1a1a2e] px-3 py-1.5 text-sm text-[#F1F1F3] placeholder:text-[#71717A] focus:outline-none focus:border-[#252538] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          data-testid="assistant-send"
          className="rounded-md bg-[#C9A84C] text-[#0b0b10] px-3 py-1.5 text-sm font-medium hover:bg-[#E8D5A3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-[180ms]"
        >
          Send
        </button>
      </form>

      <div className="border-t border-[#1a1a2e] px-4 py-2 text-[10px] text-[#71717A]">
        The assistant explains status and can draft messages for your review. It never sends, approves, or changes anything.
      </div>
    </div>
  );
}

// ── one grounded answer ──────────────────────────────────────────────────────

function AnswerBlock({
  envelope,
  transactionId,
  router,
  writeClipboard,
}: {
  envelope: AssistantEnvelope;
  transactionId: string;
  router: ReturnType<typeof useRouter>;
  writeClipboard?: (text: string) => Promise<void>;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const hasEvidence = envelope.evidence.length > 0 || envelope.sources.length > 0;

  return (
    <div data-testid="msg-answer" className="mr-8 rounded-md bg-[#0b0b10] border border-[#1a1a2e] px-3 py-2 text-[#C7C7CC] space-y-2">
      {/* the natural-language answer (plain text — React-escaped) */}
      <div className="whitespace-pre-wrap leading-relaxed text-[#E4E4E7]">{envelope.answer}</div>

      {/* confidence — label only, never a percentage */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          data-testid="assistant-confidence"
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CLASS[confidenceTone(envelope.confidence)]}`}
        >
          Confidence {confidenceLabel(envelope.confidence)}
        </span>
      </div>

      {/* warnings — only when present */}
      {envelope.warnings.length > 0 && (
        <div data-testid="assistant-warnings" className="rounded-md border border-amber-700/40 bg-amber-900/15 px-2.5 py-1.5 text-[11px] text-amber-200 space-y-1">
          {envelope.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* suggested actions — navigation ONLY */}
      {envelope.suggested_actions.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="assistant-actions">
          {envelope.suggested_actions.map((a: AssistantSuggestedAction, i) => {
            const nav = isNavigableTab(a.tab);
            return (
              <button
                key={i}
                type="button"
                disabled={!nav}
                onClick={() => nav && router.push(tabHref(transactionId, a.tab!))}
                data-testid="assistant-action"
                className="rounded-md border border-[#252538] bg-[#11111a] px-2.5 py-1 text-[11px] text-[#C7C7CC] hover:text-[#F1F1F3] hover:border-[#C9A84C]/40 disabled:opacity-50 disabled:cursor-default transition-colors"
              >
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {/* draft — review-only card */}
      {envelope.draft && <AssistantDraftCard draft={envelope.draft} writeClipboard={writeClipboard} />}

      {/* evidence — collapsed by default */}
      {hasEvidence && (
        <div>
          <button
            type="button"
            onClick={() => setShowEvidence((v) => !v)}
            data-testid="assistant-evidence-toggle"
            aria-expanded={showEvidence}
            className="inline-flex items-center gap-1 text-[11px] text-[#71717A] hover:text-[#A1A1AA]"
          >
            {showEvidence ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showEvidence ? "Hide evidence" : `Show evidence${envelope.evidence.length ? ` (${envelope.evidence.length})` : ""}`}
          </button>

          {showEvidence && (
            <div data-testid="assistant-evidence" className="mt-1.5 space-y-1.5">
              {envelope.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {envelope.sources.map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-[#252538] bg-[#11111a] text-[#A1A1AA]">
                      {friendlySource(s)}
                    </span>
                  ))}
                </div>
              )}
              {envelope.evidence.map((e, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  <span className="text-[#71717A]">{friendlySource(e.source)}: </span>
                  <span className="text-[#C7C7CC] whitespace-pre-wrap">{e.fact}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
