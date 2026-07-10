// ============================================================================
// TRANSACTION ASSISTANT 4.0E.2 — rich draft review card
// ============================================================================
// Renders the full grounded draft (title / audience / channel / subject / body
// / confidence / warnings / collapsible facts_used) as a REVIEW-ONLY card.
// Copy / Copy to Clipboard / Copy Subject / Copy Body / Edit — there is NO
// Send / Email / Notify / SMS / automation path. Body + facts render as plain
// text (React-escaped); no markdown, no HTML, no raw context.
// ============================================================================

"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, ClipboardCopy, Copy, Pencil } from "lucide-react";

import type { AssistantDraft, DraftAudience } from "./assistant-types";
import { confidenceLabel, confidenceTone, displayAudience, friendlySource, type Tone } from "./assistant-view";

export interface AssistantDraftCardProps {
  draft: AssistantDraft;
  /** From the requested draft type / free-text intent — drives the
   *  presentation-only audience fallback. Never overrides an explicit audience. */
  expectedAudience?: DraftAudience;
  /** Injected in tests; defaults to the browser clipboard. */
  writeClipboard?: (text: string) => Promise<void>;
}

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  muted: "bg-white/[0.04] text-[#A1A1AA] border-white/[0.08]",
};

async function defaultWriteClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

type CopyKind = "body" | "full" | "subject";

export default function AssistantDraftCard({ draft, expectedAudience, writeClipboard }: AssistantDraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState<CopyKind | null>(null);
  const [showFacts, setShowFacts] = useState(false);

  const write = writeClipboard ?? defaultWriteClipboard;
  const audience = displayAudience(draft.audience, expectedAudience);
  const fullText = draft.subject ? `Subject: ${draft.subject}\n\n${body}` : body;

  async function copy(which: CopyKind) {
    const text = which === "full" ? fullText : which === "subject" ? (draft.subject ?? "") : body;
    try {
      await write(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard denied — no-op; nothing is ever sent */
    }
  }

  return (
    <div
      data-testid="assistant-draft-card"
      className="mt-2 rounded-md border border-[#C9A84C]/30 bg-[#C9A84C]/[0.06] p-3"
    >
      {/* header: title + meta + review-only */}
      <div className="flex items-center gap-2 mb-1">
        <Pencil className="h-3.5 w-3.5 text-[#C9A84C] shrink-0" />
        <span data-testid="assistant-draft-title" className="text-xs font-medium text-[#F1F1F3]">{draft.title}</span>
        <span className="ml-auto text-[10px] text-[#71717A]">Review only — nothing is sent</span>
      </div>
      <div className="mb-1.5 flex items-center gap-2 flex-wrap">
        <span data-testid="assistant-draft-meta" className="text-[10px] uppercase tracking-wider text-[#C9A84C]">
          {draft.channel} · to {audience}
        </span>
        <span
          data-testid="assistant-draft-confidence"
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CLASS[confidenceTone(draft.confidence)]}`}
        >
          Confidence {confidenceLabel(draft.confidence)}
        </span>
      </div>

      {/* warnings — only when present */}
      {draft.warnings.length > 0 && (
        <div data-testid="assistant-draft-warnings" className="mb-1.5 rounded-md border border-amber-700/40 bg-amber-900/15 px-2.5 py-1.5 text-[11px] text-amber-200 space-y-1">
          {draft.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">{w}</span>
            </div>
          ))}
        </div>
      )}

      {draft.subject && !editing && (
        <div data-testid="assistant-draft-subject" className="text-xs font-medium text-[#F1F1F3] mb-1">{draft.subject}</div>
      )}

      {editing ? (
        <textarea
          data-testid="assistant-draft-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-h-[120px] rounded-md bg-[#0b0b10] border border-[#252538] px-3 py-2 text-xs text-[#F1F1F3] focus:outline-none focus:border-[#C9A84C]/40"
        />
      ) : (
        <div data-testid="assistant-draft-body" className="whitespace-pre-wrap text-xs text-[#C7C7CC] leading-relaxed">{body}</div>
      )}

      {/* buttons — copy variants + edit. NEVER send/email/notify. */}
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyBtn testid="assistant-draft-copy" active={copied === "body"} onClick={() => copy("body")} icon={<Copy className="h-3 w-3" />}>Copy</CopyBtn>
        <CopyBtn testid="assistant-draft-copy-clipboard" active={copied === "full"} onClick={() => copy("full")} icon={<ClipboardCopy className="h-3 w-3" />}>Copy to Clipboard</CopyBtn>
        {draft.subject && (
          <CopyBtn testid="assistant-draft-copy-subject" active={copied === "subject"} onClick={() => copy("subject")} icon={<Copy className="h-3 w-3" />}>Copy Subject</CopyBtn>
        )}
        <CopyBtn testid="assistant-draft-copy-body" active={false} onClick={() => copy("body")} icon={<Copy className="h-3 w-3" />}>Copy Body</CopyBtn>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          data-testid="assistant-draft-edit"
          className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#0b0b10] px-2.5 py-1 text-[11px] text-[#C7C7CC] hover:text-[#F1F1F3]"
        >
          <Pencil className="h-3 w-3" /> {editing ? "Done" : "Edit"}
        </button>
      </div>

      {/* facts used — collapsed by default, friendly source names */}
      {draft.facts_used.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowFacts((v) => !v)}
            data-testid="assistant-draft-facts-toggle"
            aria-expanded={showFacts}
            className="inline-flex items-center gap-1 text-[11px] text-[#71717A] hover:text-[#A1A1AA]"
          >
            {showFacts ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showFacts ? "Hide facts used" : `Show facts used (${draft.facts_used.length})`}
          </button>
          {showFacts && (
            <div data-testid="assistant-draft-facts" className="mt-1.5 space-y-1.5">
              {draft.facts_used.map((f, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  <span className="text-[#71717A]">{friendlySource(f.source)}: </span>
                  <span className="text-[#C7C7CC] whitespace-pre-wrap">{f.fact}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyBtn({
  testid,
  active,
  onClick,
  icon,
  children,
}: {
  testid: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#0b0b10] px-2.5 py-1 text-[11px] text-[#C7C7CC] hover:text-[#F1F1F3]"
    >
      {active ? <Check className="h-3 w-3 text-emerald-400" /> : icon} {children}
    </button>
  );
}
