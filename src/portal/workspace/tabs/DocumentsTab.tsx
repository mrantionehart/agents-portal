// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Documents tab
// ============================================================================
// Wraps the existing R4 DocumentsPanel byte-for-byte. No new fetches,
// no fill UI. The per-form Drawer + agent-write surface ship in
// Workflow 3.2.
// ============================================================================

import DocumentsPanel from "@/src/portal/documents/DocumentsPanel";
import type { DocumentRow } from "@/src/portal/documents/types";

export interface DocumentsTabProps {
  documents: DocumentRow[];
  documentsError: string | null;
  paperworkPackageUrl: string;
}

export default function DocumentsTab({
  documents,
  documentsError,
  paperworkPackageUrl,
}: DocumentsTabProps) {
  return (
    <DocumentsPanel
      documents={documents}
      error={documentsError}
      paperworkPackageUrl={paperworkPackageUrl}
    />
  );
}
