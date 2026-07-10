// ============================================================================
// TRANSACTION ASSISTANT 4.0D — draft review card
// ============================================================================
// Renders an assistant-proposed draft as a REVIEW-ONLY card. The agent can
// Copy, Copy to Clipboard, or Edit the text. There is NO Send / Email / Notify
// path — this component cannot dispatch anything. Body is rendered as plain
// text (React-escaped); no markdown, no HTML.
// ============================================================================

"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Copy, Pencil } from "lucide-react";

import type { AssistantDraft } from "./assistant-types";

export interface AssistantDraftCardProps {
  draft: AssistantDraft;
  /** Injected in tests; defaults to the browser clipboard. */
  writeClipboard?: (text: string) => Promise<void>;
}

async function defaultWriteClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

export default function AssistantDraftCard({ draft, writeClipboard }: AssistantDraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState<null | "body" | "full">(null);

  const write = writeClipboard ?? defaultWriteClipboard;
  const fullText = draft.subject ? `Subject: ${draft.subject}\n\n${body}` : body;

  async function copy(which: "body" | "full") {
    try {
      await write(which === "full" ? fullText : body);
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
      <div className="flex items-center gap-2 mb-1.5">
        <Pencil className="h-3.5 w-3.5 text-[#C9A84C]" />
        <span className="text-[11px] uppercase tracking-wider text-[#C9A84C]">
          Draft · {draft.channel} · to {draft.audience}
        </span>
        <span className="ml-auto text-[10px] text-[#71717A]">Review only — nothing is sent</span>
      </div>

      {draft.subject && !editing && (
        <div className="text-xs font-medium text-[#F1F1F3] mb-1">{draft.subject}</div>
      )}

      {editing ? (
        <textarea
          data-testid="assistant-draft-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-h-[120px] rounded-md bg-[#0b0b10] border border-[#252538] px-3 py-2 text-xs text-[#F1F1F3] focus:outline-none focus:border-[#C9A84C]/40"
        />
      ) : (
        <div className="whitespace-pre-wrap text-xs text-[#C7C7CC] leading-relaxed">{body}</div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy("body")}
          data-testid="assistant-draft-copy"
          className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#0b0b10] px-2.5 py-1 text-[11px] text-[#C7C7CC] hover:text-[#F1F1F3]"
        >
          {copied === "body" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />} Copy
        </button>
        <button
          type="button"
          onClick={() => copy("full")}
          data-testid="assistant-draft-copy-clipboard"
          className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#0b0b10] px-2.5 py-1 text-[11px] text-[#C7C7CC] hover:text-[#F1F1F3]"
        >
          {copied === "full" ? <Check className="h-3 w-3 text-emerald-400" /> : <ClipboardCopy className="h-3 w-3" />} Copy to Clipboard
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          data-testid="assistant-draft-edit"
          className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#0b0b10] px-2.5 py-1 text-[11px] text-[#C7C7CC] hover:text-[#F1F1F3]"
        >
          <Pencil className="h-3 w-3" /> {editing ? "Done" : "Edit"}
        </button>
      </div>
    </div>
  );
}
