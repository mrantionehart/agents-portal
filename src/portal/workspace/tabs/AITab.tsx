// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — AI tab
// ============================================================================
// Wraps the existing AIAssistantPanel byte-for-byte. No new tools, no
// new endpoints. Preserves the broker-confirmation language and the
// existing /api/ai/chat contract (Vault P10C/D/E shipped 3 tools).
// New Copilot tools (summarize_transaction, explain_compliance,
// explain_blocker, explain_commission_status, etc.) ship in Workflow 3.7.
// ============================================================================

import AIAssistantPanel from "@/src/portal/workspace/AIAssistantPanel";

export interface AITabProps {
  transactionId: string;
}

export default function AITab({ transactionId }: AITabProps) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-2">
        AI Assistant
      </h2>
      <AIAssistantPanel transactionId={transactionId} />
      <p className="mt-3 text-[10px] text-[#71717A] leading-relaxed">
        Broker confirmation is required for every change. The Copilot
        never auto-sends envelopes, never auto-approves, and never
        overrides statutory paths. Read tools surface state; write tools
        require explicit confirmation.
      </p>
    </section>
  );
}
