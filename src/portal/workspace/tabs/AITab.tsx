// ============================================================================
// AGENT PORTAL 3.0 — Transaction Assistant tab (4.0D)
// ============================================================================
// Wraps the grounded AIAssistantPanel. Forwards an optional initialPrompt
// (from ?prompt=, set by the suggested-prompt chips) so the panel can auto-send
// it exactly once. No new endpoints, no new chat surface.
// ============================================================================

import AIAssistantPanel from "@/src/portal/workspace/AIAssistantPanel";

export interface AITabProps {
  transactionId: string;
  initialPrompt?: string | null;
}

export default function AITab({ transactionId, initialPrompt }: AITabProps) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-2">AI Assistant</h2>
      <AIAssistantPanel transactionId={transactionId} initialPrompt={initialPrompt} />
      <p className="mt-3 text-[10px] text-[#71717A] leading-relaxed">
        The assistant explains this transaction&apos;s status and can draft messages for your review. It never
        sends envelopes, never approves, and never changes anything — every action stays in your hands.
      </p>
    </section>
  );
}
