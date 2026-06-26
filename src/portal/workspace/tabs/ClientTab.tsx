// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Client tab
// ============================================================================
// Wraps the existing AP2.1D ClientIntelligencePanel byte-for-byte. R3A
// SAFE_COLUMNS allowlist continues to enforce broker-only field
// omission (broker_notes / red_flags / profitability / decision_notes /
// ai_relationship_summary_broker remain invisible to agent tier).
// READ-ONLY. No client edits.
// ============================================================================

import ClientIntelligencePanel from "@/src/portal/workspace/ClientIntelligencePanel";
import type { ClientIntelligenceResult } from "@/src/portal/workspace/client-intelligence";

export interface ClientTabProps {
  clientIntelligence: ClientIntelligenceResult;
  fallbackClientName: string | null;
}

export default function ClientTab({
  clientIntelligence,
  fallbackClientName,
}: ClientTabProps) {
  return (
    <ClientIntelligencePanel
      result={clientIntelligence}
      fallbackClientName={fallbackClientName}
    />
  );
}
