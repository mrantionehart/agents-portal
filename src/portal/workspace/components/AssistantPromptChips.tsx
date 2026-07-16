// ============================================================================
// TRANSACTION ASSISTANT 4.0D — suggested-prompt chips
// ============================================================================
// A single row of one-tap prompt chips shown BENEATH the Coordinator hero.
// Each chip is a plain <Link> to ?tab=ai&prompt=<encoded> — the AI panel
// detects the prompt, prefills, auto-sends once, then strips it from the URL.
// Navigation only; the chip never calls the assistant itself. Coordinator and
// Coach are untouched — this row sits between them and the Coordinator.
// ============================================================================

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { ASSISTANT_PROMPT_CHIPS } from "../ai/assistant-view";

export interface AssistantPromptChipsProps {
  transactionId: string;
}

export default function AssistantPromptChips({ transactionId }: AssistantPromptChipsProps) {
  return (
    <div
      aria-label="Ask the assistant"
      data-testid="assistant-prompt-chips"
      data-training-id="portal.workspace.assistant.prompt-chips"
      className="mb-3 flex flex-wrap items-center gap-2"
    >
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#71717A]">
        <Sparkles className="h-3 w-3 text-[#C9A84C]" /> Ask
      </span>
      {ASSISTANT_PROMPT_CHIPS.map((c) => (
        <Link
          key={c.id}
          href={`/workspace/${transactionId}?tab=ai&prompt=${encodeURIComponent(c.prompt)}`}
          data-testid={`assistant-chip-${c.id}`}
          className="
            rounded-full border border-[#252538] bg-[#0b0b10]
            px-3 py-1 text-xs text-[#C7C7CC]
            hover:border-[#C9A84C]/40 hover:text-[#F1F1F3]
            transition-colors duration-[160ms]
          "
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}
