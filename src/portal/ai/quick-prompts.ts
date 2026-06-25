// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — Quick prompts for the AI page
// ============================================================================
// Static, presentation-only list. Each prompt is a reusable starter the
// agent can fire into Vault's existing /api/ai/chat. NO new tools.
// ============================================================================

export type QuickPrompt = {
  id: string;
  label: string;
  prompt: string;
  /** When `true`, the prompt only makes sense inside a transaction
   *  context. The UI hides it when no transaction is selected. */
  requiresTxn?: boolean;
};

export const QUICK_PROMPTS: ReadonlyArray<QuickPrompt> = [
  {
    id: "blocking",
    label: "What's blocking my deals?",
    prompt: "Across all my active transactions, what's blocking each one? Show me by readiness tier.",
  },
  {
    id: "next-step",
    label: "What's the next step on this deal?",
    prompt: "What is the single best next action I should take on this transaction?",
    requiresTxn: true,
  },
  {
    id: "missing-fields",
    label: "What fields are missing?",
    prompt: "List every required field that is still missing or unresolved on this transaction.",
    requiresTxn: true,
  },
  {
    id: "ready-for-broker",
    label: "Is this deal ready for broker review?",
    prompt: "Is this transaction ready for broker review? If not, what's the minimum still needed?",
    requiresTxn: true,
  },
  {
    id: "draft-update",
    label: "Help me draft an update to my client",
    prompt: "Draft a short, professional status update I can send to my client about this transaction. Do not send anything.",
    requiresTxn: true,
  },
  {
    id: "compliance",
    label: "What compliance items are open?",
    prompt: "Are there any open compliance items, missing signatures, or stuck envelopes I should be aware of?",
  },
  {
    id: "client-temperature",
    label: "Which leads are hot right now?",
    prompt: "Which of my client profiles are tagged hot and what should I prioritize for each?",
  },
] as const;

/** Filter the list by current context — prompts that require a
 *  transaction are hidden when no txn is selected. */
export function visibleQuickPrompts(hasTxnContext: boolean): QuickPrompt[] {
  return QUICK_PROMPTS.filter((p) => (p.requiresTxn ? hasTxnContext : true));
}
